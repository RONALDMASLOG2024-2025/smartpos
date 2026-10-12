import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Papa from "papaparse";
import type { Account } from "../src/domain/types";
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
