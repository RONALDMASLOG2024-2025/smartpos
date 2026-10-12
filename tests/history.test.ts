import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parseHistory, historyTimestamp } from "../src/lib/historyCsv";
import { forecast } from "../src/ml/forecast";
import {
  DemoRepository,
  DEMO_MANAGER,
  DEMO_CASHIER,
  seedDemo,
} from "../src/data/demoRepository";
import type { HistoryLine, Product } from "../src/domain/types";
import { exportCSV } from "../src/lib/csv";

const header = "Receipt,Timestamp,SKU,Quantity,Unit Price,Source\n";
const base = seedDemo().products[0];
const now = new Date("2026-10-12T08:00:00Z");
describe("Historical CSV and forecasting", () => {
  it("uses Manila dates and rejects malformed or impossible timestamps", () => {
    expect(historyTimestamp("2026-07-14")).toBe("2026-07-13T16:00:00.000Z");
    expect(historyTimestamp("2026-07-14T10:30:00+08:00")).toBe(
      "2026-07-14T02:30:00.000Z",
    );
    for (const bad of [
      "2026-02-30",
      "2026-07-14T25:00:00Z",
      "2026-07-14T10:00:00",
      "2026-07-14T10:00:00+15:00",
    ])
      expect(() => historyTimestamp(bad)).toThrow();
  });
  it("validates SKUs, positive quantities, money, sources and complete receipts", () => {
    const valid = header + "H001,2026-07-14,COLA-330,2,25.00,real\n";
    const preview = parseHistory(valid, [base], [], now);
    expect(preview.errors).toEqual([]);
    expect(preview.total_cents).toBe(5000);
    expect(preview.receipts).toBe(1);
    for (const line of [
      "H001,2026-07-14,MISSING,2,25.00,real",
      "H001,2026-07-14,COLA-330,0,25.00,real",
      "H001,2026-07-14,COLA-330,2,25.001,real",
      "H001,2027-01-01,COLA-330,2,25.00,real",
      "H001,2026-07-14,COLA-330,2,25.00,unknown",
    ])
      expect(
        parseHistory(header + line, [base], [], now).errors.length,
      ).toBeGreaterThan(0);
    expect(
      parseHistory(
        valid + "H001,2026-07-14,COLA-330,3,25.00,real",
        [base],
        [],
        now,
      ).errors[0].message,
    ).toContain("Duplicate SKU");
    expect(
      parseHistory(
        valid + "H002,2026-07-14,COLA-330,3,25.00,synthetic",
        [base],
        [],
        now,
      ).errors[0].message,
    ).toContain("one source");
  });
  it("recognizes identical rows and rejects changed historical receipts", () => {
    const preview = parseHistory(
      header + "H001,2026-07-14,COLA-330,2,25.00,real",
      [base],
      [],
      now,
    );
    const old: HistoryLine = {
      ...preview.rows[0],
      id: "h1",
      store_id: base.store_id,
      product_id: base.id,
      product_name: base.name,
      line_total_cents: 5000,
    };
    expect(
      parseHistory(
        header + "H001,2026-07-14,COLA-330,2,25.00,real",
        [base],
        [old],
        now,
      ).duplicates,
    ).toBe(1);
    expect(
      parseHistory(
        header + "H001,2026-07-14,COLA-330,3,25.00,real",
        [base],
        [old],
        now,
      ).errors[0].message,
    ).toContain("different data");
  });
  it("trains all 40 newly-created sari-sari products from the 90-day synthetic CSV", async () => {
    const raw = JSON.parse(
      await readFile("assets/sari-sari-starter/products.json", "utf8"),
    ) as {
      sku: string;
      name: string;
      price_cents: number;
      stock: number;
      low_stock_threshold: number;
    }[];
    const products: Product[] = raw.map((p) => ({
      ...base,
      ...p,
      id: p.sku,
      created_at: now.toISOString(),
    }));
    const csv = await readFile(
      "public/samples/sari-sari-synthetic-history.csv",
      "utf8",
    );
    const preview = parseHistory(csv, products, [], now);
    expect(preview.errors).toEqual([]);
    expect(preview.rows).toHaveLength(3324);
    expect(preview.receipts).toBe(1137);
    const history: HistoryLine[] = preview.rows.map((r, i) => ({
      ...r,
      id: `h-${i}`,
      store_id: base.store_id,
      product_id: r.sku,
      product_name: r.sku,
      line_total_cents: r.quantity * r.unit_price_cents,
    }));
    const result = forecast(products, [], "uploaded-synthetic", now, history);
    expect(result.source).toBe("synthetic");
    expect(result.training_days).toBe(90);
    expect(result.results).toHaveLength(40);
    expect(result.validation_mae).toBeGreaterThanOrEqual(0);
    expect(
      result.results.every(
        (p) => Number.isFinite(p.predicted_units) && p.predicted_units > 0,
      ),
    ).toBe(true);
    expect(forecast(products, [], false, now, history).source).toBe(
      "insufficient",
    );
    const real = history.map((row) => ({ ...row, source: "real" as const }));
    expect(forecast(products, [], false, now, real).results).toHaveLength(40);
    expect(forecast(products, [], false, now, real).source).toBe("real");
  });
  it("imports atomically in demo mode, protects stock and allows only Manager access", async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
    };
    const manager = new DemoRepository(DEMO_MANAGER, storage),
      cashier = new DemoRepository(DEMO_CASHIER, storage);
    const before = await manager.load();
    const rows = parseHistory(
      header + "H001,2026-07-14,COLA-330,2,25.00,synthetic",
      before.products,
      [],
      now,
    ).rows;
    await expect(cashier.importHistory(rows, "bad.csv")).rejects.toThrow(
      "Access denied",
    );
    expect(await manager.importHistory(rows, "sample.csv")).toEqual({
      added: 1,
      skipped: 0,
      receipts: 1,
    });
    expect(await manager.importHistory(rows, "again.csv")).toEqual({
      added: 0,
      skipped: 1,
      receipts: 0,
    });
    expect((await manager.load()).products[0].stock).toBe(
      before.products[0].stock,
    );
    expect((await manager.load()).sales).toEqual(before.sales);
    await expect(
      manager.importHistory(
        [
          ...rows.map((r) => ({ ...r, receipt: "NEW" })),
          { ...rows[0], sku: "UNKNOWN" },
        ],
        "invalid.csv",
      ),
    ).rejects.toThrow("Unknown SKU");
    expect((await manager.load()).history).toHaveLength(1);
    await expect(cashier.removeSyntheticHistory()).rejects.toThrow(
      "Access denied",
    );
    expect(await manager.removeSyntheticHistory()).toBe(1);
    expect((await manager.load()).history).toHaveLength(0);
    expect(exportCSV([{ Source: "synthetic" }])).toContain("synthetic");
  });
});
