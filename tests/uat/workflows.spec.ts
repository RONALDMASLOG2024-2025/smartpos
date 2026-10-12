import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const evidence = join(process.cwd(), "docs", "uat", "screenshots");
const csvHeader =
  "SKU,Product Name,Category,Description,Price,Cost,Stock Quantity,Low Stock Threshold,Status";
async function screenshot(page: Page, name: string) {
  await mkdir(evidence, { recursive: true });
  await page.screenshot({
    path: join(evidence, `${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}
async function go(page: Page, label: string) {
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: label, exact: true })
    .click();
  await expect(
    page.locator(
      'nav[aria-label="Workspace navigation"] [aria-current="page"]',
    ),
  ).toHaveCount(1);
}
async function login(page: Page, role: "Manager" | "Cashier") {
  await page.goto("/");
  await page.getByRole("button", { name: `Explore as ${role}` }).click();
  await expect(
    page.getByRole("heading", {
      name: role === "Manager" ? "Store overview" : "Hello, Sam",
    }),
  ).toBeVisible();
}
const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
});
test.afterEach(() => expect(errors).toEqual([]));

test("Manager complete workflow: approvals, images, CSV, atomic sale, reports, forecasts, settings", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your shop, in order." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Features", exact: true }).click();
  await expect(page).toHaveURL(/#features$/);
  await page.getByRole("link", { name: "How it works", exact: true }).click();
  await expect(page).toHaveURL(/#workflow$/);
  await page.goto("/");
  await screenshot(page, "01-landing");
  await login(page, "Manager");
  await screenshot(page, "02-manager-dashboard");
  await go(page, "Cashiers");
  await page.getByRole("button", { name: "Add cashier", exact: true }).click();
  await page.getByLabel("Cashier name").fill("Taylor Santos");
  await page.getByLabel("Google account email").fill("taylor@example.test");
  await page.getByRole("button", { name: "Authorize cashier" }).click();
  await expect(
    page.getByRole("cell", { name: "taylor@example.test", exact: true }),
  ).toBeVisible();
  await screenshot(page, "03-cashier-approval");
  await page.getByRole("button", { name: "Disable Taylor Santos" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Disabled", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enable Taylor Santos" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await go(page, "Categories");
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByLabel("Category name").fill("UAT goods");
  await page.getByRole("button", { name: "Save category" }).click();
  await page
    .getByRole("button", { name: "Edit UAT goods", exact: true })
    .click();
  await page.getByLabel("Category name").fill("UAT pantry");
  await page.getByRole("button", { name: "Save category" }).click();
  await expect(
    page.getByRole("cell", { name: "UAT pantry", exact: true }),
  ).toBeVisible();
  await go(page, "Products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByLabel("SKU", { exact: true }).fill("UAT-TEA");
  await page.getByLabel("Product name", { exact: true }).fill("UAT tea");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption({ label: "UAT pantry" });
  await page.getByLabel("Price (₱)").fill("25.50");
  await page.getByLabel("Cost (₱)").fill("15.20");
  await page.getByLabel("Stock quantity", { exact: true }).fill("6");
  await page.getByLabel("Low-stock threshold").fill("2");
  // Screenshot PNG is an isolated test image; upload/preview exercises the real File API and decoder.
  const image = await page.screenshot({
    clip: { x: 0, y: 0, width: 64, height: 64 },
  });
  await page
    .getByLabel("Product image · JPEG, PNG or WebP, max 5 MB")
    .setInputFiles({
      name: "uat-product.png",
      mimeType: "image/png",
      buffer: image,
    });
  await expect(
    page.getByRole("img", { name: "Product image preview" }),
  ).toBeVisible();
  await screenshot(page, "04-product-image-preview");
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(
    page.getByRole("button", { name: "Edit UAT tea", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "UAT tea", exact: true }),
  ).toBeVisible();
  // Replacement and invalid image checks.
  await page.getByRole("button", { name: "Edit UAT tea", exact: true }).click();
  await page
    .getByLabel("Product image · JPEG, PNG or WebP, max 5 MB")
    .setInputFiles({
      name: "invalid.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    });
  await expect(page.getByRole("alert")).toContainText("JPEG, PNG or WebP");
  await page
    .getByLabel("Product image · JPEG, PNG or WebP, max 5 MB")
    .setInputFiles({
      name: "replacement.png",
      mimeType: "image/png",
      buffer: image,
    });
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(
    page.getByRole("button", { name: "Edit UAT tea", exact: true }),
  ).toBeVisible();
  await go(page, "Inventory");
  await page.getByLabel("Stock filter").selectOption("low");
  await expect(
    page.getByRole("button", { name: "Adjust stock for UAT tea" }),
  ).toHaveCount(0);
  await page.getByLabel("Stock filter").selectOption("all");
  await page.getByRole("button", { name: "Adjust stock for UAT tea" }).click();
  await page.getByLabel("New stock quantity").fill("8");
  await page.getByLabel("Reason", { exact: true }).fill("UAT delivery");
  await page.getByRole("button", { name: "Confirm stock adjustment" }).click();
  await expect(
    page.getByRole("cell", { name: "UAT delivery", exact: true }),
  ).toBeVisible();
  await screenshot(page, "05-inventory-history");
  await go(page, "Import & export");
  const templatePromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV template" }).click();
  const templateDownload = await templatePromise;
  expect(await readFile((await templateDownload.path())!, "utf8")).toContain(
    "Low Stock Threshold",
  );
  const upload = page.getByLabel("Upload product CSV · maximum 2 MB");
  const invalid = `${csvHeader}\nBAD,Bad,UAT pantry,,-1,1,2,1,active\nBAD,Duplicate,UAT pantry,,1,1,2,1,active`;
  await upload.setInputFiles({
    name: "invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(invalid),
  });
  await page.getByRole("button", { name: "Validate and preview" }).click();
  await expect(
    page.getByRole("button", { name: "Confirm import" }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText(
    "No changes will be imported",
  );
  await screenshot(page, "06-invalid-csv");
  const valid = `${csvHeader}\nUAT-TEA,UAT tea,UAT pantry,Updated,26.50,15.20,10,2,active\nUAT-RICE,UAT rice,UAT pantry,,50.00,35.00,20,5,active`;
  await upload.setInputFiles({
    name: "valid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(valid),
  });
  await page.getByRole("button", { name: "Validate and preview" }).click();
  await expect(
    page.getByText("1 products to add · 1 products to update · valid.csv"),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await screenshot(page, "07-import-preview");
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(
    page.getByRole("cell", { name: "valid.csv", exact: true }),
  ).toBeVisible();
  for (const [button, header] of [
    ["Export products", "Product Name"],
    ["Export inventory", "Threshold"],
    ["Export transactions", "Receipt"],
    ["Export transaction items", "Unit price"],
    ["Export stock history", "Reason"],
  ]) {
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: button, exact: true }).click();
    expect(
      await readFile((await (await downloaded).path())!, "utf8"),
    ).toContain(header);
  }
  await go(page, "Point of sale");
  await page.getByRole("textbox", { name: "Search products" }).fill("UAT tea");
  await page.getByRole("button", { name: "Add UAT tea to cart" }).click();
  await page
    .getByRole("spinbutton", { name: "Quantity for UAT tea" })
    .fill("2");
  await page.getByLabel("Discount (₱)").fill("3.00");
  await page.getByLabel("Amount received (₱)").fill("100.00");
  await page.getByRole("button", { name: "Review payment" }).click();
  await expect(page.getByRole("dialog")).toContainText("₱50.00");
  await screenshot(page, "08-manager-checkout");
  await page.getByRole("button", { name: "Complete transaction" }).click();
  await expect(
    page.getByRole("dialog", { name: "Sale receipt" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("₱50.00");
  await screenshot(page, "09-manager-receipt");
  const managerReceiptId = (
    await page.locator(".receipt > p.muted").innerText()
  ).split("\n")[0];
  const receiptDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download receipt" }).click();
  expect(
    await readFile((await (await receiptDownload).path())!, "utf8"),
  ).toContain("UAT tea");
  await page.evaluate(() => {
    window.print = () =>
      document.body.setAttribute("data-print-requested", "true");
  });
  await page.getByRole("button", { name: "Print receipt" }).click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-print-requested",
    "true",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await go(page, "Transactions");
  await expect(
    page.getByRole("button", {
      name: `View receipt ${managerReceiptId.slice(0, 8)}`,
    }),
  ).toBeVisible();
  await go(page, "Products");
  await page.getByRole("button", { name: "Edit UAT tea", exact: true }).click();
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Renamed UAT tea");
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("archived");
  await page.getByRole("button", { name: "Save product" }).click();
  await page.getByLabel("Filter product status").selectOption("archived");
  await expect(
    page.getByRole("button", { name: "Edit Renamed UAT tea" }),
  ).toBeVisible();
  await go(page, "Transactions");
  await page
    .getByRole("button", {
      name: `View receipt ${managerReceiptId.slice(0, 8)}`,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("UAT tea");
  await expect(page.getByRole("dialog")).not.toContainText("Renamed");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await go(page, "Sales reports");
  await screenshot(page, "10-sales-reports");
  const exportPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export sales", exact: true }).click();
  expect(
    await readFile((await (await exportPromise).path())!, "utf8"),
  ).toContain("Subtotal");
  await go(page, "Forecasting");
  await page.getByRole("button", { name: "Generate forecast" }).click();
  await expect(
    page.getByRole("heading", { name: "Demand and replenishment" }),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic forecast · Demonstration only.", {
      exact: false,
    }),
  ).toBeVisible();
  await screenshot(page, "11-synthetic-forecast");
  await go(page, "Settings");
  await page.getByLabel("Store name").fill("UAT Corner Store");
  await page.getByLabel("Receipt message").fill("UAT thank you");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toContainText("Store settings saved");
  await go(page, "My profile");
  await expect(
    page.getByText("manager@example.test", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("button", { name: "Log out", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Explore as Manager" }),
  ).toBeVisible();
});

test("Cashier end-to-end checkout, permissions, insufficient payment and card payment", async ({
  page,
}) => {
  await login(page, "Cashier");
  await expect(
    page
      .getByRole("navigation", { name: "Workspace navigation" })
      .getByRole("link"),
  ).toHaveCount(4);
  await screenshot(page, "12-cashier-dashboard");
  await go(page, "Point of sale");
  await page.getByRole("button", { name: "Snacks", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add Coffee sachet to cart" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Beverages", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search products" })
    .fill("no-such-product");
  await expect(
    page.getByRole("heading", { name: "No products found" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search products" }).fill("Coffee");
  await page.getByRole("button", { name: "Add Coffee sachet to cart" }).click();
  await page
    .getByRole("button", { name: "Remove Coffee sachet", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your basket is empty" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add Coffee sachet to cart" }).click();
  await page.getByRole("button", { name: "Increase Coffee sachet" }).click();
  await page.getByRole("button", { name: "Decrease Coffee sachet" }).click();
  await page.getByRole("button", { name: "Increase Coffee sachet" }).click();
  await page.getByLabel("Amount received (₱)").fill("10");
  await page.getByRole("button", { name: "Review payment" }).click();
  await expect(page.getByRole("alert")).toContainText("insufficient payment");
  await page.getByLabel("Amount received (₱)").fill("50");
  await expect(page.getByText("₱26.00", { exact: true })).toBeVisible();
  await screenshot(page, "13-cashier-pos");
  await page.getByRole("button", { name: "Review payment" }).click();
  await page.getByRole("button", { name: "Complete transaction" }).click();
  await expect(
    page.getByRole("dialog", { name: "Sale receipt" }),
  ).toContainText("Sam Cruz");
  await screenshot(page, "14-cashier-receipt");
  const cashierReceiptId = (
    await page.locator(".receipt > p.muted").innerText()
  ).split("\n")[0];
  await page.getByRole("button", { name: "Close dialog" }).click();
  await go(page, "Transactions");
  await expect(
    page.getByRole("button", {
      name: `View receipt ${cashierReceiptId.slice(0, 8)}`,
    }),
  ).toBeVisible();
  await page.goto("/app/inventory");
  await expect(
    page.getByRole("heading", { name: "Manager access required" }),
  ).toBeVisible();
  await screenshot(page, "15-manager-route-denied");
  await page.getByRole("link", { name: "Return to your dashboard" }).click();
  await go(page, "Point of sale");
  await page.getByRole("textbox", { name: "Search products" }).fill("Potato");
  await page.getByRole("button", { name: "Add Potato chips to cart" }).click();
  await page
    .getByRole("spinbutton", { name: "Quantity for Potato chips" })
    .fill("999");
  await expect(
    page.getByRole("spinbutton", { name: "Quantity for Potato chips" }),
  ).toHaveValue("1");
  await page.getByLabel("Payment method").selectOption("card");
  await page.getByRole("button", { name: "Review payment" }).click();
  await page.getByRole("button", { name: "Complete transaction" }).click();
  await expect(page.getByRole("dialog")).toContainText("card payment");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.goto("/app/products");
  await expect(
    page.getByRole("button", { name: "Explore as Manager" }),
  ).toBeVisible();
});

test("Empty state, tablet/mobile navigation, out of stock and keyboard dialog", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "smartpos-demo-v2",
      JSON.stringify({
        store: {
          id: "00000000-0000-4000-8000-000000000001",
          name: "Empty test store",
          currency: "PHP",
          timezone: "Asia/Manila",
          receipt_note: "",
        },
        products: [],
        categories: [],
        sales: [],
        accounts: [
          {
            id: "00000000-0000-4000-8000-000000000002",
            store_id: "00000000-0000-4000-8000-000000000001",
            name: "Alex Reyes",
            email: "manager@example.test",
            role: "manager",
            active: true,
          },
        ],
        movements: [],
        imports: [],
        requests: {},
        forecasts: [],
      }),
    );
  });
  await page.getByRole("button", { name: "Explore as Manager" }).click();
  await expect(
    page.getByText("No transactions yet", { exact: true }),
  ).toBeVisible();
  await screenshot(page, "16-empty-dashboard");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await go(page, "Products");
  await expect(
    page.getByText("No products here", { exact: true }),
  ).toBeVisible();
  await screenshot(page, "17-tablet-products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByLabel("SKU", { exact: true }).fill("ZERO");
  await page.getByLabel("Product name", { exact: true }).fill("Zero stock");
  await page.getByRole("button", { name: "Save product" }).click();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await go(page, "Point of sale");
  await expect(
    page.getByRole("button", { name: "Add Zero stock to cart" }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, "18-mobile-pos");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeVisible();
  await screenshot(page, "19-mobile-navigation");
  await go(page, "Products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByLabel("SKU", { exact: true }).press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
});

test("Upload and checkout failures preserve catalogue, basket and stock, then recover", async ({
  page,
}) => {
  await login(page, "Manager");
  await go(page, "Products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByLabel("SKU", { exact: true }).fill("FAIL-IMAGE");
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Image failure test");
  const image = await page.screenshot({
    clip: { x: 0, y: 0, width: 64, height: 64 },
  });
  const upload = page.getByLabel("Product image · JPEG, PNG or WebP, max 5 MB");
  await upload.setInputFiles({
    name: "too-large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(6 * 1024 * 1024),
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "5 MB",
  );
  await upload.setInputFiles({
    name: "corrupt.png",
    mimeType: "image/png",
    buffer: Buffer.from("invalid image bytes"),
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await upload.setInputFiles({
    name: "valid.png",
    mimeType: "image/png",
    buffer: image,
  });
  await expect(
    page.getByRole("img", { name: "Product image preview" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const original = FileReader.prototype.readAsDataURL;
    (window as unknown as { restoreUpload: () => void }).restoreUpload = () => {
      FileReader.prototype.readAsDataURL = original;
    };
    FileReader.prototype.readAsDataURL = function (this: FileReader) {
      this.dispatchEvent(new ProgressEvent("error"));
    };
  });
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Image upload failed",
  );
  await screenshot(page, "20-image-upload-failure");
  await page.evaluate(() =>
    (window as unknown as { restoreUpload: () => void }).restoreUpload(),
  );
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(
    page.getByRole("button", { name: "Edit Image failure test" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await login(page, "Cashier");
  await go(page, "Point of sale");
  await page.getByRole("textbox", { name: "Search products" }).fill("Coffee");
  await page.getByRole("button", { name: "Add Coffee sachet to cart" }).click();
  await page.getByLabel("Amount received (₱)").fill("50");
  await page.getByRole("button", { name: "Review payment" }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as unknown as { restoreStorage: () => void }).restoreStorage =
      () => {
        Storage.prototype.setItem = original;
      };
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "smartpos-demo-v2")
        throw new Error("Simulated storage failure");
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Complete transaction" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Simulated storage failure",
  );
  await screenshot(page, "21-checkout-failure");
  await page.evaluate(() =>
    (window as unknown as { restoreStorage: () => void }).restoreStorage(),
  );
  await page.getByRole("button", { name: "Back to basket" }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Quantity for Coffee sachet" }),
  ).toHaveValue("1");
  await expect(
    page.getByRole("button", { name: "Add Coffee sachet to cart" }),
  ).toContainText("7 in stock");
  await page.getByRole("button", { name: "Review payment" }).click();
  await page.getByRole("button", { name: "Complete transaction" }).click();
  await expect(
    page.getByRole("dialog", { name: "Sale receipt" }),
  ).toBeVisible();
  await screenshot(page, "22-checkout-recovered");
});
