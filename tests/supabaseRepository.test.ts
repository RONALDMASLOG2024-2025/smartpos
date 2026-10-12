import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { SupabaseRepository } from "../src/data/supabaseRepository";
import {
  DEMO_CASHIER,
  DEMO_MANAGER,
  seedDemo,
} from "../src/data/demoRepository";
import type { Role } from "../src/domain/types";
describe("Supabase HTTP integration contract (mocked service)", () => {
  function setup(role: Role, failCheckout = false) {
    const paths: string[] = [];
    const seed = seedDemo();
    const catalogue = Array.from({ length: 1001 }, (_, i) => ({
      ...seed.products[0],
      id: `product-${String(i).padStart(4, "0")}`,
      image_path: null,
    }));
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      paths.push(url.pathname);
      const endpoint = url.pathname.split("/").pop()!;
      let payload: unknown = [];
      let status = 200;
      if (endpoint === "stores") payload = seed.store;
      else if (endpoint === "products" || endpoint === "catalogue") {
        const offset = Number(url.searchParams.get("offset") ?? 0);
        payload = catalogue.slice(offset, offset + 1000).map((p) => {
          if (role === "manager") return p;
          const { cost_cents: _cost, ...safe } = p;
          void _cost;
          return safe;
        });
      } else if (endpoint === "categories") payload = seed.categories;
      else if (endpoint === "accounts")
        payload = [role === "manager" ? DEMO_MANAGER : DEMO_CASHIER];
      else if (endpoint === "checkout") {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          p_payment: 10000,
          p_method: "cash",
          p_discount: 0,
        });
        payload = failCheckout
          ? { message: "Insufficient stock", code: "P0001" }
          : "receipt-from-rpc";
        status = failCheckout ? 400 : 200;
      }
      return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    };
    const client = createClient(
      "https://contract-test.supabase.co",
      "public-test-key",
      {
        global: { fetch: fetcher },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    return {
      repo: new SupabaseRepository(
        client,
        role === "manager" ? DEMO_MANAGER : DEMO_CASHIER,
      ),
      paths,
    };
  }
  it("loads beyond the service row cap for Manager and Cashier without exposing costs", async () => {
    for (const role of ["manager", "cashier"] as const) {
      const { repo, paths } = setup(role);
      const state = await repo.load();
      expect(state.products).toHaveLength(1001);
      if (role === "cashier") {
        expect(state.products[0]).not.toHaveProperty("cost_cents");
        expect(paths).not.toContain("/rest/v1/products");
        expect(paths).not.toContain("/rest/v1/stock_movements");
        expect(paths).not.toContain("/rest/v1/sales_history");
      } else expect(state.products[0].cost_cents).toBeDefined();
    }
  });
  it("submits exact checkout parameters and surfaces database failures", async () => {
    const input = {
      request_id: crypto.randomUUID(),
      items: [
        { product_id: "product-0", quantity: 2, expected_price_cents: 2500 },
      ],
      payment: 10000,
      method: "cash" as const,
      discount: 0,
    };
    expect(await setup("cashier").repo.checkout(input)).toBe(
      "receipt-from-rpc",
    );
    await expect(setup("cashier", true).repo.checkout(input)).rejects.toThrow(
      "Insufficient stock",
    );
  });
});
