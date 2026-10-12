import { describe, it, expect, beforeEach } from "vitest";
import { canAccess, cents, dayKey, validateImage } from "../src/domain/rules";
import {
  DemoRepository,
  DEMO_CASHIER,
  DEMO_MANAGER,
  type Persistence,
} from "../src/data/demoRepository";
import { exportCSV, parseProducts, template } from "../src/lib/csv";
import { forecast } from "../src/ml/forecast";
import type { CheckoutInput } from "../src/domain/types";
describe("Business workflows", () => {
  let storage: Persistence;
  let manager: DemoRepository;
  let cashier: DemoRepository;
  beforeEach(() => {
    const values = new Map<string, string>();
    storage = {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => {
        values.set(k, v);
      },
    };
    manager = new DemoRepository(DEMO_MANAGER, storage);
    cashier = new DemoRepository(DEMO_CASHIER, storage);
  });
  const sale = (overrides: Partial<CheckoutInput> = {}): CheckoutInput => ({
    request_id: crypto.randomUUID(),
    items: [
      { product_id: "product-0", quantity: 2, expected_price_cents: 2500 },
    ],
    payment: 10000,
    method: "cash",
    discount: 0,
    ...overrides,
  });
  it("uses exact cents and rejects malformed money", () => {
    expect(cents("0.29")).toBe(29);
    expect(cents("999.99")).toBe(99999);
    for (const bad of ["-1", "NaN", "1.001", "1e3", "Infinity"])
      expect(() => cents(bad)).toThrow();
  });
  it("protects manager routes and uses Manila day boundaries", () => {
    expect(canAccess("cashier", "inventory")).toBe(false);
    expect(canAccess("cashier", "pos")).toBe(true);
    expect(dayKey("2026-10-04T16:00:00Z")).toBe("2026-10-05");
  });
  it("completes a sale once and preserves original receipt details", async () => {
    const input = sale();
    const id = await cashier.checkout(input);
    expect(await cashier.checkout(input)).toBe(id);
    let state = await manager.load();
    expect(state.products[0].stock).toBe(46);
    const product = state.products[0];
    await manager.saveProduct(
      { ...product, name: "Renamed", price_cents: 9999, status: "archived" },
      46,
    );
    state = await manager.load();
    const saved = state.sales.find((s) => s.id === id)!;
    expect(saved.items[0].product_name).toBe("Cola · 330 ml");
    expect(saved.items[0].unit_price_cents).toBe(2500);
    expect(saved.change_cents).toBe(5000);
  });
  it("rejects overselling, changed prices, insufficient payment and cashier discounts", async () => {
    for (const input of [
      sale({
        items: [
          { product_id: "product-0", quantity: 49, expected_price_cents: 2500 },
        ],
      }),
      sale({
        items: [
          { product_id: "product-0", quantity: 1, expected_price_cents: 1 },
        ],
      }),
      sale({ payment: 1 }),
      sale({ discount: 100 }),
    ])
      await expect(cashier.checkout(input)).rejects.toThrow();
    expect((await manager.load()).products[0].stock).toBe(48);
  });
  it("rolls back if persistence fails midway", async () => {
    const failing = new DemoRepository(DEMO_CASHIER, {
      getItem: () => null,
      setItem: () => {
        throw new Error("Disk full");
      },
    });
    await expect(failing.checkout(sale())).rejects.toThrow("Disk full");
    expect((await failing.load()).products[0].stock).toBe(48);
  });
  it("denies cashier writes and hides product costs and other sales", async () => {
    await expect(
      cashier.adjustStock("product-0", 100, 48, "Delivery"),
    ).rejects.toThrow();
    await expect(
      cashier.manageCashier("x@example.test", "X", true),
    ).rejects.toThrow();
    const data = await cashier.load();
    expect(data.products[0].cost_cents).toBeUndefined();
    expect(data.sales.every((s) => s.cashier_id === DEMO_CASHIER.id)).toBe(
      true,
    );
  });
  it("detects stale stock adjustments and disabled accounts", async () => {
    await cashier.checkout(sale());
    await expect(
      manager.adjustStock("product-0", 50, 48, "Delivery"),
    ).rejects.toThrow("Stock changed");
    await manager.manageCashier(DEMO_CASHIER.email, DEMO_CASHIER.name, false);
    await expect(cashier.checkout(sale())).rejects.toThrow("Access denied");
  });
  it("validates entire CSV, quoted fields and duplicate SKUs", () => {
    const parsed = parseProducts(template, []);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0].price_cents).toBe(2500);
    expect(
      parseProducts(
        template + "\nDEMO-001,Duplicate,Snacks,,1,1,1,1,active",
        [],
      ).errors[0].message,
    ).toContain("Duplicate");
    expect(
      parseProducts(template.replace("25.00", "-1"), []).errors,
    ).toHaveLength(1);
    expect(parseProducts("bad,data", []).errors).toHaveLength(1);
    expect(
      parseProducts(template.replace("Sample product", '"Sample, product"'), [])
        .rows[0].name,
    ).toBe("Sample, product");
  });
  it("imports all or nothing, updates by SKU, and records imports", async () => {
    const rows = parseProducts(template, []).rows;
    await manager.importProducts(rows, "products.csv");
    let state = await manager.load();
    expect(state.imports).toHaveLength(1);
    const updated = parseProducts(
      template.replace("25.00", "30.00"),
      state.products,
    ).rows;
    await manager.importProducts(updated, "products.csv");
    state = await manager.load();
    expect(state.products.filter((p) => p.sku === "DEMO-001")).toHaveLength(1);
    expect(state.products.find((p) => p.sku === "DEMO-001")?.price_cents).toBe(
      3000,
    );
    await expect(
      manager.importProducts(
        [
          { ...rows[0], sku: "GOOD" },
          { ...rows[0], sku: "BAD", stock: -1 },
        ],
        "bad.csv",
      ),
    ).rejects.toThrow();
    expect((await manager.load()).products.some((p) => p.sku === "GOOD")).toBe(
      false,
    );
  });
  it("neutralizes spreadsheet formulas without altering numeric negatives", () => {
    expect(exportCSV([{ name: "=CMD()", delta: -2 }])).toContain("'=CMD()");
    expect(exportCSV([{ delta: -2 }])).toContain("-2");
  });
  it("rejects unsupported and oversized images", () => {
    expect(() => validateImage({ type: "image/svg+xml", size: 10 })).toThrow();
    expect(() =>
      validateImage({ type: "image/png", size: 6 * 1024 * 1024 }),
    ).toThrow();
    expect(() =>
      validateImage({ type: "image/webp", size: 100 }),
    ).not.toThrow();
  });
  it("reproducibly forecasts synthetic demand and labels insufficient real data", async () => {
    const state = await manager.load();
    const now = new Date("2026-10-05T10:00:00Z");
    const a = forecast(state.products, [], true, now);
    expect(a).toEqual(forecast(state.products, [], true, now));
    expect(a.source).toBe("synthetic");
    expect(a.results).toHaveLength(12);
    expect(
      a.results.every((p) => p.predicted_units >= 0 && p.restock_units >= 0),
    ).toBe(true);
    expect(forecast(state.products, [], false, now).source).toBe(
      "insufficient",
    );
  });
  it("trains real data with zero-sales days and excludes the incomplete day", async () => {
    const s = await manager.load();
    const now = new Date("2026-10-05T10:00:00Z");
    const first = new Date("2026-07-01T02:00:00Z");
    const p = { ...s.products[0], created_at: first.toISOString() };
    const sales = Array.from({ length: 96 }, (_, i) => ({
      ...s.sales[0],
      id: `real-${i}`,
      created_at: new Date(first.getTime() + i * 86400000).toISOString(),
      items: [{ ...s.sales[0].items[0], product_id: p.id, quantity: 5 }],
    }));
    const result = forecast([p], sales, false, now);
    expect(result.source).toBe("real");
    expect(result.results[0].predicted_units).toBeGreaterThanOrEqual(34);
    expect(result.results[0].predicted_units).toBeLessThanOrEqual(36);
  });
});
