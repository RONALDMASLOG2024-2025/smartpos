import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { HistoryLine, HistoryRow, Product } from "../../src/domain/types";

test("Manager imports the sari-sari sample and trains all 40 products without changing inventory", async ({
  page,
}) => {
  const user = {
    id: "10000000-0000-4000-8000-000000000003",
    email: "owner@example.test",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "google", providers: ["google"] },
    user_metadata: { full_name: "Owner" },
    created_at: "2026-10-12T00:00:00Z",
  };
  const store = "30000000-0000-4000-8000-000000000001";
  const account = {
    id: "20000000-0000-4000-8000-000000000001",
    store_id: store,
    user_id: user.id,
    email: user.email,
    name: "Owner",
    role: "manager",
    active: true,
    created_at: user.created_at,
  };
  const catalog = JSON.parse(
    await readFile("assets/sari-sari-starter/products.json", "utf8"),
  ) as Partial<Product>[];
  const products = catalog.map((p, index) => ({
    ...p,
    id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    store_id: store,
    category_id: null,
    description: "",
    status: "active",
    image_path: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  let history: HistoryLine[] = [];
  let importCalls = 0;
  let savedForecast: {
    source: string;
    results: { results: unknown[]; training_days: number };
  } | null = null;
  await page.route("https://smartpos-auth.test/**", async (route) => {
    const url = new URL(route.request().url()),
      endpoint = url.pathname.split("/").at(-1);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    let payload: unknown = [];
    if (endpoint === "claim_account") payload = account;
    else if (endpoint === "stores")
      payload = {
        id: store,
        name: "Sari Sari Store",
        currency: "PHP",
        timezone: "Asia/Manila",
        receipt_note: "Thank you!",
      };
    else if (endpoint === "accounts") payload = [account];
    else if (endpoint === "products")
      payload = products.slice(offset, offset + 1000);
    else if (endpoint === "sales_history")
      payload = history.slice(offset, offset + 1000);
    else if (endpoint === "import_sales_history") {
      importCalls++;
      const rows = route.request().postDataJSON().p_rows as HistoryRow[];
      history = rows.map((r, i) => ({
        ...r,
        id: `history-${i}`,
        store_id: store,
        product_id: products.find((p) => p.sku === r.sku)!.id,
        product_name: products.find((p) => p.sku === r.sku)!.name!,
        line_total_cents: r.quantity * r.unit_price_cents,
      }));
      payload = {
        added: rows.length,
        skipped: 0,
        receipts: new Set(rows.map((r) => r.receipt)).size,
      };
    } else if (endpoint === "forecast_runs")
      savedForecast = route.request().postDataJSON();
    await route.fulfill({ json: payload });
  });
  await page.goto("/");
  await page.evaluate((user) => {
    localStorage.setItem(
      "sb-smartpos-auth-auth-token",
      JSON.stringify({
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user,
      }),
    );
  }, user);
  await page.goto("/app/data");
  await expect(
    page.getByRole("heading", { name: "Import & export" }),
  ).toBeVisible();
  await page
    .getByLabel("Upload transaction history CSV")
    .setInputFiles(resolve("public/samples/sari-sari-synthetic-history.csv"));
  await page
    .getByRole("button", { name: "Validate history and preview" })
    .click();
  await expect(page.getByText("All history rows valid")).toBeVisible();
  await expect(page.getByText(/1137 receipts.*3324 item rows/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm history import" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "assets/sari-sari-starter/history-import-preview.png",
    fullPage: true,
  });
  await page.getByLabel(/I reviewed the source and values/).check();
  await page.getByRole("button", { name: "Confirm history import" }).click();
  await expect(page.getByText("3324 stored item rows")).toBeVisible();
  expect(importCalls).toBe(1);
  expect(products[0].stock).toBe(catalog[0].stock);
  await page.goto("/app/forecasting");
  await page.getByLabel("Training data").selectOption("uploaded-synthetic");
  await page.getByRole("button", { name: "Generate forecast" }).click();
  await expect(
    page.getByRole("heading", { name: "Demand and replenishment" }),
  ).toBeVisible();
  expect(savedForecast).toMatchObject({
    source: "synthetic",
    results: { training_days: 90 },
  });
  expect(
    (savedForecast as unknown as { results: { results: unknown[] } }).results
      .results,
  ).toHaveLength(40);
  await page.screenshot({
    path: "assets/sari-sari-starter/history-forecast.png",
    fullPage: true,
  });
});
