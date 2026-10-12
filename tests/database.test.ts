import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Papa from "papaparse";
import type { Account, Product, HistoryLine } from "../src/domain/types";
import { parseHistory } from "../src/lib/historyCsv";
import { forecast } from "../src/ml/forecast";
let db: PGlite;
const manager = "10000000-0000-4000-8000-000000000001",
  cashier = "10000000-0000-4000-8000-000000000002",
  outsider = "10000000-0000-4000-8000-000000000003";
let store: string, product: string;
async function identity(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function checkout(
  quantity = 2,
  price = 2500,
  request = crypto.randomUUID(),
  discount = 0,
) {
  return db.query<{ checkout: string }>(
    "select public.checkout($1,$2::jsonb,$4,'cash',$3)",
    [
      request,
      JSON.stringify([
        { product_id: product, quantity, expected_price_cents: price },
      ]),
      discount,
      Math.max(10000, quantity * price),
    ],
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
create role anon;create role authenticated;
create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);create table auth.identities(user_id uuid,provider text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;
`);
  await db.exec(await readFile("supabase/migrations/001_smartpos.sql", "utf8"));
  await db.exec(
    await readFile(
      "supabase/migrations/002_manager_self_registration.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile("supabase/migrations/003_transaction_history.sql", "utf8"),
  );
}, 30000);
beforeEach(async () => {
  await db.exec("reset role");
  await db.exec(
    "truncate public.stores,auth.users,auth.identities,storage.objects cascade",
  );
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'manager@example.test',now()),($2,'cashier@example.test',now()),($3,'stranger@example.test',now())",
    [manager, cashier, outsider],
  );
  await db.query(
    "insert into auth.identities values($1,'google'),($2,'google'),($3,'google')",
    [manager, cashier, outsider],
  );
  store = (
    await db.query<{ id: string }>(
      "select public.provision_manager('manager@example.test','Manager','Test shop') id",
    )
  ).rows[0].id;
  await identity(manager);
  await db.query("select public.claim_account()");
  await db.query(
    "select public.manage_cashier('cashier@example.test','Cashier',true)",
  );
  const input = {
    sku: "P001",
    name: "Cola",
    price_cents: 2500,
    cost_cents: 1000,
    stock: 10,
    low_stock_threshold: 3,
    status: "active",
    description: "",
    category_id: null,
    image_path: null,
  };
  product = (
    await db.query<{ id: string }>(
      "select public.save_product($1::jsonb,null) id",
      [JSON.stringify(input)],
    )
  ).rows[0].id;
  await identity(cashier);
  await db.query("select public.claim_account()");
});
afterAll(async () => {
  await db?.close();
});
describe("Actual PostgreSQL schema, RPCs and RLS (mocked Supabase auth/storage schemas)", () => {
  const historyRow = (receipt = "H001", source = "real") => ({
    receipt,
    sold_at: "2026-07-14T10:00:00+08:00",
    sku: "P001",
    quantity: 2,
    unit_price_cents: 2500,
    source,
  });
  async function importHistory(rows: unknown[]) {
    return db.query<{
      result: { added: number; skipped: number; receipts: number };
    }>("select public.import_sales_history($1::jsonb,'history.csv') result", [
      JSON.stringify(rows),
    ]);
  }
  it("imports historical items once without changing checkout totals or stock", async () => {
    await identity(manager);
    expect((await importHistory([historyRow()])).rows[0].result).toEqual({
      added: 1,
      skipped: 0,
      receipts: 1,
    });
    expect((await importHistory([historyRow()])).rows[0].result).toEqual({
      added: 0,
      skipped: 1,
      receipts: 0,
    });
    expect(
      (await db.query("select * from public.sales_history")).rows,
    ).toHaveLength(1);
    expect(
      (await db.query<{ stock: number }>("select stock from public.products"))
        .rows[0].stock,
    ).toBe(10);
    expect(
      (await db.query("select * from public.transactions")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.stock_movements")).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select * from public.import_runs")).rows,
    ).toHaveLength(1);
    await expect(
      importHistory([historyRow("A-NEW"), { ...historyRow(), quantity: 3 }]),
    ).rejects.toThrow("different data");
    expect(
      (await db.query("select * from public.sales_history")).rows,
    ).toHaveLength(1);
  });
  it("validates history on the server and rolls back the entire batch", async () => {
    await identity(manager);
    for (const bad of [
      { ...historyRow("H002"), sku: "UNKNOWN" },
      { ...historyRow("H002"), quantity: 0 },
      { ...historyRow("H002"), quantity: 1.5 },
      { ...historyRow("H002"), unit_price_cents: -1 },
      { ...historyRow("H002"), sold_at: "2099-01-01T00:00:00Z" },
      { ...historyRow("H002"), source: "synthetic" },
      { ...historyRow("H002"), source: "invalid" },
    ])
      await expect(importHistory([historyRow(), bad])).rejects.toThrow();
    await expect(importHistory([historyRow(), historyRow()])).rejects.toThrow(
      "Duplicate SKU",
    );
    expect(
      (await db.query("select * from public.sales_history")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.import_runs")).rows,
    ).toHaveLength(0);
  });
  it("protects history from Cashiers and other tenants", async () => {
    await expect(importHistory([historyRow()])).rejects.toThrow(
      "Access denied",
    );
    await identity(manager);
    await importHistory([historyRow()]);
    await identity(cashier);
    expect(
      (await db.query("select * from public.sales_history")).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select public.remove_synthetic_history()"),
    ).rejects.toThrow("Access denied");
    await identity(outsider);
    await db.query("select public.claim_account('manager')");
    expect(
      (await db.query("select * from public.sales_history")).rows,
    ).toHaveLength(0);
    await expect(importHistory([historyRow()])).rejects.toThrow("Unknown SKU");
    await expect(
      db.query(
        "insert into public.sales_history(store_id,receipt) values($1,'hack')",
        [store],
      ),
    ).rejects.toThrow("permission denied");
  });
  it("clears synthetic training rows while preserving actual history, sales and stock", async () => {
    await identity(manager);
    await importHistory([historyRow("REAL", "real")]);
    await importHistory([historyRow("SYN", "synthetic")]);
    expect(
      (
        await db.query<{ removed: number }>(
          "select public.remove_synthetic_history() removed",
        )
      ).rows[0].removed,
    ).toBe(1);
    expect(
      (
        await db.query<{ source: string }>(
          "select source from public.sales_history",
        )
      ).rows,
    ).toEqual([{ source: "real" }]);
    expect(
      (await db.query<{ stock: number }>("select stock from public.products"))
        .rows[0].stock,
    ).toBe(10);
  });
  it("rejects historical receipt IDs already recorded by live checkout", async () => {
    const receipt = (await checkout()).rows[0].checkout;
    await identity(manager);
    await expect(importHistory([historyRow(receipt)])).rejects.toThrow(
      "live checkout",
    );
  });
  it("preserves complete receipt sets and ignores row ordering on identical reuploads", async () => {
    await db.exec("reset role");
    await db.query(
      "insert into public.products(store_id,sku,name,price_cents) values($1,'P002','Second product',1000)",
      [store],
    );
    await identity(manager);
    const lines = [
      historyRow(),
      { ...historyRow(), sku: "P002", unit_price_cents: 1000 },
    ];
    expect((await importHistory(lines)).rows[0].result.added).toBe(2);
    await expect(importHistory([lines[0]])).rejects.toThrow("different data");
    expect((await importHistory([...lines].reverse())).rows[0].result).toEqual({
      added: 0,
      skipped: 2,
      receipts: 0,
    });
    await expect(
      importHistory([
        { ...historyRow("NEW") },
        {
          ...historyRow("NEW"),
          sku: "P002",
          sold_at: "2026-07-15T10:00:00+08:00",
        },
      ]),
    ).rejects.toThrow("timestamps must match");
    expect(
      (await db.query("select * from public.sales_history")).rows,
    ).toHaveLength(2);
  });
  it("imports the full 90-day production sample through the actual PostgreSQL function", async () => {
    await db.exec("reset role");
    await db.query(
      "update public.stores set name='Sari Sari Store' where id=$1",
      [store],
    );
    await db.exec(
      await readFile("supabase/seeds/sari_sari_products.sql", "utf8"),
    );
    await identity(manager);
    const products = (
      await db.query<Product>(
        "select * from public.products where sku like 'SSS-%' order by sku",
      )
    ).rows;
    const initialStock = products.map((p) => p.stock);
    const sample = parseHistory(
      await readFile("public/samples/sari-sari-synthetic-history.csv", "utf8"),
      products,
      [],
      new Date("2026-10-12T08:00:00Z"),
    );
    expect(sample.errors).toEqual([]);
    expect((await importHistory(sample.rows)).rows[0].result).toEqual({
      added: 3324,
      skipped: 0,
      receipts: 1137,
    });
    const history = (
      await db.query<HistoryLine>("select * from public.sales_history")
    ).rows;
    expect(history).toHaveLength(3324);
    const result = forecast(
      products,
      [],
      "uploaded-synthetic",
      new Date("2026-10-12T08:00:00Z"),
      history,
    );
    expect(result.results).toHaveLength(40);
    expect(result.training_days).toBe(90);
    expect(
      (
        await db.query<Product>(
          "select * from public.products where sku like 'SSS-%' order by sku",
        )
      ).rows.map((p) => p.stock),
    ).toEqual(initialStock);
    expect(
      (await db.query("select * from public.transactions")).rows,
    ).toHaveLength(0);
  });
  it("imports the sari-sari catalog into an existing store and safely links uploaded photos on rerun", async () => {
    const sql = await readFile("supabase/seeds/sari_sari_products.sql", "utf8");
    await db.exec("reset role");
    await db.query(
      "update public.stores set name='Sari Sari Store' where id=$1",
      [store],
    );
    await db.exec(sql);
    expect(
      (await db.query("select * from public.products where sku like 'SSS-%'"))
        .rows,
    ).toHaveLength(40);
    expect(
      (await db.query("select * from public.categories")).rows,
    ).toHaveLength(9);
    expect((await db.query("select * from public.stores")).rows).toHaveLength(
      1,
    );
    expect((await db.query("select * from public.accounts")).rows).toHaveLength(
      2,
    );
    expect(
      (
        await db.query(
          "select * from public.stock_movements where reason like 'Opening stock - synthetic%'",
        )
      ).rows,
    ).toHaveLength(40);
    expect(
      (
        await db.query(
          "select * from public.products where image_path is not null",
        )
      ).rows,
    ).toHaveLength(0);
    const rice = (
      await db.query<{ id: string; price_cents: number }>(
        "select id,price_cents from public.products where sku='SSS-001'",
      )
    ).rows[0];
    product = rice.id;
    await identity(cashier);
    await checkout(1, rice.price_cents);
    await db.exec("reset role");
    await db.query(
      "insert into storage.objects(bucket_id,name) values('product-images',$1)",
      [`${store}/starter/rice.jpg`],
    );
    await db.query(
      "update public.products set image_path=$1 where sku='SSS-002'",
      [`${store}/my-existing-photo.jpg`],
    );
    await db.query(
      "update public.products set price_cents=5600 where sku='SSS-001'",
    );
    await db.exec(sql);
    const imported = (
      await db.query<{
        stock: number;
        price_cents: number;
        image_path: string;
      }>(
        "select stock,price_cents,image_path from public.products where sku='SSS-001'",
      )
    ).rows[0];
    expect(imported).toEqual({
      stock: 49,
      price_cents: 5600,
      image_path: `${store}/starter/rice.jpg`,
    });
    expect(
      (
        await db.query<{ image_path: string }>(
          "select image_path from public.products where sku='SSS-002'",
        )
      ).rows[0].image_path,
    ).toBe(`${store}/my-existing-photo.jpg`);
    expect((await db.query("select * from public.products")).rows).toHaveLength(
      41,
    );
    expect(
      (await db.query("select * from public.import_runs")).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select * from public.transactions")).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "select * from public.stock_movements where reason like 'Opening stock - synthetic%'",
        )
      ).rows,
    ).toHaveLength(40);
  });
  it("aborts the sari-sari import when the store name is missing or ambiguous", async () => {
    const sql = await readFile("supabase/seeds/sari_sari_products.sql", "utf8");
    await db.exec("reset role");
    try {
      await expect(db.exec(sql)).rejects.toThrow("found 0");
    } finally {
      await db.exec("rollback");
    }
    await db.query(
      "update public.stores set name='Sari Sari Store' where id=$1",
      [store],
    );
    await db.query("insert into public.stores(name) values('Sari Sari Store')");
    try {
      await expect(db.exec(sql)).rejects.toThrow("found 2");
    } finally {
      await db.exec("rollback");
    }
    expect((await db.query("select * from public.products")).rows).toHaveLength(
      1,
    );
    expect(
      (await db.query("select * from public.import_runs")).rows,
    ).toHaveLength(0);
  });
  it("creates a first-time Manager's own store and can authorize a Cashier", async () => {
    await db.exec("reset role");
    await db.query(
      "update auth.users set raw_user_meta_data=$1::jsonb where id=$2",
      [JSON.stringify({ full_name: "New Owner" }), outsider],
    );
    const employee = "10000000-0000-4000-8000-000000000004";
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,'new-cashier@example.test',now())",
      [employee],
    );
    await db.query("insert into auth.identities values($1,'google')", [
      employee,
    ]);
    await identity(outsider);
    const owner = (
      await db.query<Account>("select * from public.claim_account('manager')")
    ).rows[0];
    expect(owner).toMatchObject({
      user_id: outsider,
      email: "stranger@example.test",
      name: "New Owner",
      role: "manager",
      active: true,
    });
    expect(owner.store_id).not.toBe(store);
    expect((await db.query("select name from public.stores")).rows).toEqual([
      { name: "My store" },
    ]);
    expect((await db.query("select * from public.products")).rows).toHaveLength(
      0,
    );
    await db.query(
      "select public.manage_cashier('new-cashier@example.test','New Cashier',true)",
    );
    await identity(employee);
    expect(
      (await db.query<Account>("select * from public.claim_account('cashier')"))
        .rows[0],
    ).toMatchObject({
      user_id: employee,
      store_id: owner.store_id,
      role: "cashier",
    });
    await expect(
      db.query(
        "select public.manage_cashier('another@example.test','Another',true)",
      ),
    ).rejects.toThrow("Access denied");
  });
  it("returns the same Manager account on repeated registration and session reload", async () => {
    await identity(outsider);
    const owner = (
      await db.query<Account>("select * from public.claim_account('manager')")
    ).rows[0];
    const repeated = await Promise.all([
      db.query<Account>("select * from public.claim_account('manager')"),
      db.query<Account>("select * from public.claim_account('manager')"),
    ]);
    repeated.forEach((result) => expect(result.rows[0].id).toBe(owner.id));
    expect(
      (await db.query<Account>("select * from public.claim_account()")).rows[0]
        .id,
    ).toBe(owner.id);
    await db.exec("reset role");
    expect((await db.query("select * from public.stores")).rows).toHaveLength(
      2,
    );
    expect(
      (
        await db.query("select * from public.accounts where user_id=$1", [
          outsider,
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it("requires an invitation for new Cashiers and an explicit Manager choice to register", async () => {
    await identity(outsider);
    await expect(
      db.query("select public.claim_account('cashier')"),
    ).rejects.toThrow("add your email");
    await expect(db.query("select public.claim_account()")).rejects.toThrow(
      "not been approved",
    );
    await db.exec("reset role");
    expect((await db.query("select * from public.stores")).rows).toHaveLength(
      1,
    );
  });
  it("keeps existing roles and workspaces when users choose the wrong role", async () => {
    await identity(cashier);
    await expect(
      db.query("select public.claim_account('manager')"),
    ).rejects.toThrow("Choose Cashier");
    expect(
      (await db.query<Account>("select * from public.claim_account('cashier')"))
        .rows[0],
    ).toMatchObject({ store_id: store, role: "cashier" });
    await identity(manager);
    await expect(
      db.query("select public.claim_account('cashier')"),
    ).rejects.toThrow("Choose Manager");
    expect(
      (await db.query<Account>("select * from public.claim_account('manager')"))
        .rows[0],
    ).toMatchObject({ store_id: store, role: "manager" });
  });
  it("prevents disabled Cashiers from registering as Managers or rejoining", async () => {
    await identity(manager);
    await db.query(
      "select public.manage_cashier('cashier@example.test','Cashier',false)",
    );
    await identity(cashier);
    await expect(
      db.query("select public.claim_account('manager')"),
    ).rejects.toThrow("disabled");
    await expect(
      db.query("select public.claim_account('cashier')"),
    ).rejects.toThrow("disabled");
    await db.exec("reset role");
    expect((await db.query("select * from public.stores")).rows).toHaveLength(
      1,
    );
  });
  it("requires a verified Google identity and denies anonymous registration", async () => {
    await db.exec("reset role");
    await db.query("delete from auth.identities where user_id=$1", [outsider]);
    await identity(outsider);
    await expect(
      db.query("select public.claim_account('manager')"),
    ).rejects.toThrow("verified Google");
    await db.exec("reset role");
    await db.query("insert into auth.identities values($1,'google')", [
      outsider,
    ]);
    await db.query(
      "update auth.users set email_confirmed_at=null where id=$1",
      [outsider],
    );
    await identity(outsider);
    await expect(
      db.query("select public.claim_account('manager')"),
    ).rejects.toThrow("verified Google");
    await db.exec("reset role;set role anon");
    await expect(
      db.query("select public.claim_account('manager')"),
    ).rejects.toThrow("permission denied");
  });
  it("isolates a self-registered Manager from other stores and their Cashiers", async () => {
    await identity(outsider);
    await db.query("select public.claim_account('manager')");
    expect((await db.query("select * from public.products")).rows).toHaveLength(
      0,
    );
    expect((await db.query("select * from public.accounts")).rows).toHaveLength(
      1,
    );
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.manager_for($1) allowed",
          [store],
        )
      ).rows[0].allowed,
    ).toBe(false);
    await expect(
      db.query(
        "select public.manage_cashier('cashier@example.test','Takeover',true)",
      ),
    ).rejects.toThrow("another workspace");
  });
  it("runs atomic checkout and records immutable snapshots", async () => {
    const id = (await checkout()).rows[0].checkout;
    await identity(manager);
    expect(
      (await db.query<{ stock: number }>("select stock from public.products"))
        .rows[0].stock,
    ).toBe(8);
    const sale = (
      await db.query<{ total_cents: number; change_cents: number }>(
        "select total_cents,change_cents from public.transactions where id=$1",
        [id],
      )
    ).rows[0];
    expect(Number(sale.total_cents)).toBe(5000);
    expect(Number(sale.change_cents)).toBe(5000);
    expect(
      (
        await db.query(
          "select * from public.transaction_items where transaction_id=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("is idempotent and rejects reused keys with different input", async () => {
    const request = crypto.randomUUID();
    const id = (await checkout(2, 2500, request)).rows[0].checkout;
    expect((await checkout(2, 2500, request)).rows[0].checkout).toBe(id);
    await expect(checkout(1, 2500, request)).rejects.toThrow("different sale");
    await identity(manager);
    expect(
      (await db.query<{ stock: number }>("select stock from public.products"))
        .rows[0].stock,
    ).toBe(8);
  });
  it("rejects insufficient stock, stale prices, cashier discounts and null carts", async () => {
    await expect(checkout(11)).rejects.toThrow("insufficient stock");
    await expect(checkout(1, 1)).rejects.toThrow("Price changed");
    await expect(checkout(1, 2500, crypto.randomUUID(), 100)).rejects.toThrow(
      "Manager",
    );
    await expect(
      db.query("select public.checkout($1,null,10000,'cash',0)", [
        crypto.randomUUID(),
      ]),
    ).rejects.toThrow("array");
    expect(
      (await db.query("select * from public.transactions")).rows,
    ).toHaveLength(0);
  });
  it("rolls back a failure after the transaction header was inserted", async () => {
    await db.exec("reset role");
    await db.exec(
      "create function public.test_fail() returns trigger language plpgsql as $$ begin raise exception 'Injected mid-sale failure'; end $$; create trigger test_fail before insert on public.transaction_items for each row execute function public.test_fail()",
    );
    await identity(cashier);
    try {
      await expect(checkout()).rejects.toThrow("Injected");
      await identity(manager);
      expect(
        (await db.query("select * from public.transactions")).rows,
      ).toHaveLength(0);
      expect(
        (await db.query<{ stock: number }>("select stock from public.products"))
          .rows[0].stock,
      ).toBe(10);
    } finally {
      await db.exec("reset role");
      await db.exec(
        "drop trigger test_fail on public.transaction_items;drop function public.test_fail()",
      );
    }
  });
  it("protects costs, inventory writes, historical sales and provisioning", async () => {
    expect((await db.query("select * from public.products")).rows).toHaveLength(
      0,
    );
    expect(
      (await db.query("select * from public.catalogue()")).rows[0],
    ).not.toHaveProperty("cost_cents");
    await expect(
      db.query("update public.products set stock=999"),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query("select public.adjust_stock($1,99,10,'hack')", [product]),
    ).rejects.toThrow("Access denied");
    await expect(
      db.query(
        "select public.provision_manager('evil@example.test','Evil','Evil')",
      ),
    ).rejects.toThrow("permission denied");
    await expect(db.query("delete from public.transactions")).rejects.toThrow(
      "permission denied",
    );
  });
  it("restricts cashier transaction/item reads to own sales", async () => {
    await identity(manager);
    await checkout();
    await identity(cashier);
    expect(
      (await db.query("select * from public.transactions")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.transaction_items")).rows,
    ).toHaveLength(0);
    await checkout();
    expect(
      (await db.query("select * from public.transactions")).rows,
    ).toHaveLength(1);
  });
  it("rejects unauthorized and non-Google users and revoked accounts", async () => {
    await identity(outsider);
    await expect(db.query("select public.claim_account()")).rejects.toThrow(
      "not been approved",
    );
    await db.exec("reset role");
    await db.query("delete from auth.identities where user_id=$1", [cashier]);
    await identity(cashier);
    await expect(db.query("select public.claim_account()")).rejects.toThrow(
      "verified Google",
    );
    await identity(manager);
    await db.query(
      "select public.manage_cashier('cashier@example.test','Cashier',false)",
    );
    await identity(cashier);
    await expect(checkout()).rejects.toThrow("Access denied");
  });
  it("isolates another tenant and blocks cross-tenant references", async () => {
    await db.exec("reset role");
    const other = (
      await db.query<{ id: string }>(
        "select public.provision_manager('other@example.test','Other','Other shop') id",
      )
    ).rows[0].id;
    await db.query(
      "insert into public.products(store_id,sku,name,price_cents,stock) values($1,'OTHER','Other',1,999)",
      [other],
    );
    await identity(manager);
    expect((await db.query("select * from public.stores")).rows).toHaveLength(
      1,
    );
    expect((await db.query("select * from public.products")).rows).toHaveLength(
      1,
    );
    await expect(
      db.query("update public.stores set name=$1 where id=$2", [
        "Hacked",
        other,
      ]),
    ).resolves.toMatchObject({ affectedRows: 0 });
    expect(store).not.toBe(other);
  });
  it("imports all rows atomically and rejects duplicate/stale SKUs", async () => {
    await identity(manager);
    const row = {
      sku: "NEW",
      name: "New",
      category: "Snacks",
      description: "",
      price_cents: 100,
      cost_cents: 50,
      stock: 5,
      low_stock_threshold: 1,
      status: "active",
      expected_stock: null,
    };
    await expect(
      db.query("select public.import_products($1::jsonb,$2)", [
        JSON.stringify([row, { ...row, sku: "BAD", price_cents: -1 }]),
        "bad.csv",
      ]),
    ).rejects.toThrow();
    expect(
      (await db.query("select * from public.categories")).rows,
    ).toHaveLength(0);
    expect((await db.query("select * from public.products")).rows).toHaveLength(
      1,
    );
    await expect(
      db.query("select public.import_products($1::jsonb,$2)", [
        JSON.stringify([row, row]),
        "duplicate.csv",
      ]),
    ).rejects.toThrow("Duplicate");
    await db.query("select public.import_products($1::jsonb,$2)", [
      JSON.stringify([row]),
      "valid.csv",
    ]);
    expect(
      (await db.query("select * from public.import_runs")).rows,
    ).toHaveLength(1);
    await expect(
      db.query("select public.import_products($1::jsonb,$2)", [
        JSON.stringify([{ ...row, expected_stock: 99 }]),
        "stale.csv",
      ]),
    ).rejects.toThrow("Stock changed");
  });
  it("protects private image folders and manager-only upload/delete", async () => {
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('product-images',$1)",
        [`${store}/cashier.png`],
      ),
    ).rejects.toThrow("row-level security");
    await identity(manager);
    await db.query(
      "insert into storage.objects(bucket_id,name) values('product-images',$1)",
      [`${store}/valid.png`],
    );
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('product-images','other/invalid.png')",
      ),
    ).rejects.toThrow("row-level security");
    await identity(cashier);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      1,
    );
    expect((await db.query("delete from storage.objects")).affectedRows).toBe(
      0,
    );
  });
  it("serializes competing sales without overselling", async () => {
    const attempts = await Promise.allSettled([checkout(6), checkout(6)]);
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    await identity(manager);
    expect(
      (await db.query<{ stock: number }>("select stock from public.products"))
        .rows[0].stock,
    ).toBe(4);
    expect(
      (await db.query("select * from public.transactions")).rows,
    ).toHaveLength(1);
  });
  it("migrates preserved CSV history atomically without deducting stock again", async () => {
    await db.exec("reset role");
    await db.exec(
      "delete from public.stock_movements;delete from public.products",
    );
    const directory = mkdtempSync(join(tmpdir(), "smartpos-legacy-"));
    const output = join(directory, "import.sql");
    try {
      execFileSync("python", [
        "scripts/migrate_legacy.py",
        "--store-id",
        store,
        "--output",
        output,
      ]);
      await db.exec(await readFile(output, "utf8"));
      const originalSales = Papa.parse<Record<string, string>>(
        await readFile("data/transactions.csv", "utf8"),
        { header: true, skipEmptyLines: true },
      ).data;
      const originalItems = Papa.parse<Record<string, string>>(
        await readFile("data/transaction_items.csv", "utf8"),
        { header: true, skipEmptyLines: true },
      ).data;
      const originalProducts = Papa.parse<Record<string, string>>(
        await readFile("data/products.csv", "utf8"),
        { header: true, skipEmptyLines: true },
      ).data;
      expect(
        (await db.query("select * from public.transactions")).rows,
      ).toHaveLength(originalSales.length);
      const stock = (
        await db.query<{ stock: number }>(
          "select stock from public.products where sku='P002'",
        )
      ).rows[0].stock;
      expect(stock).toBe(
        Number(
          originalProducts.find((p) => p.product_id === "P002")!.stock_quantity,
        ),
      );
      expect(
        (await db.query("select * from public.transaction_items")).rows,
      ).toHaveLength(originalItems.length);
      expect(
        (await db.query("select * from public.stock_movements")).rows,
      ).toHaveLength(0);
      await expect(db.exec(await readFile(output, "utf8"))).rejects.toThrow(
        "empty workspace",
      );
      await db.exec("rollback");
    } finally {
      rmSync(output);
      rmdirSync(directory);
    }
  });
});
