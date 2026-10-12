import Papa from "papaparse";
import type { ImportRow, Product } from "../domain/types";
import { cents, integer, validateProduct } from "../domain/rules";
export const CSV_FIELDS = [
  "SKU",
  "Product Name",
  "Category",
  "Description",
  "Price",
  "Cost",
  "Stock Quantity",
  "Low Stock Threshold",
  "Status",
];
export const template = Papa.unparse([
  CSV_FIELDS,
  [
    "DEMO-001",
    "Sample product",
    "Snacks",
    "Example description",
    "25.00",
    "15.00",
    "20",
    "5",
    "active",
  ],
]);
export interface Preview {
  rows: ImportRow[];
  errors: { row: number; message: string }[];
  creates: number;
  updates: number;
}
export function parseProducts(text: string, existing: Product[]): Preview {
  const preview: Preview = { rows: [], errors: [], creates: 0, updates: 0 };
  const parsed = Papa.parse<string[]>(
    text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"),
    { skipEmptyLines: "greedy" },
  );
  if (parsed.errors.length) {
    preview.errors = parsed.errors.map((e) => ({
      row: (e.row ?? 0) + 1,
      message: e.message,
    }));
    return preview;
  }
  const [headers, ...lines] = parsed.data;
  if (
    !headers ||
    headers.length !== CSV_FIELDS.length ||
    !headers.every((h, i) => h.trim() === CSV_FIELDS[i])
  ) {
    preview.errors.push({
      row: 1,
      message: `Headers must be: ${CSV_FIELDS.join(", ")}.`,
    });
    return preview;
  }
  if (!lines.length || lines.length > 2000) {
    preview.errors.push({ row: 1, message: "Import requires 1–2000 rows." });
    return preview;
  }
  const seen = new Set<string>();
  lines.forEach((values, index) => {
    try {
      if (values.length !== headers.length)
        throw new Error("Incorrect number of columns.");
      const [
        rawSku,
        name,
        category,
        description,
        price,
        cost,
        stock,
        threshold,
        status,
      ] = values.map((v) => v.trim());
      const sku = rawSku.toUpperCase();
      if (seen.has(sku)) throw new Error(`Duplicate SKU: ${sku}.`);
      seen.add(sku);
      if (category.length > 80)
        throw new Error("Category cannot exceed 80 characters.");
      if (!["active", "archived"].includes(status))
        throw new Error("Status must be active or archived.");
      const row: ImportRow = {
        sku,
        name,
        category,
        description,
        price_cents: cents(price),
        cost_cents: cents(cost),
        stock: integer(stock, "Stock quantity"),
        low_stock_threshold: integer(threshold, "Low stock threshold"),
        status: status as ImportRow["status"],
        expected_stock: existing.find((p) => p.sku === sku)?.stock ?? null,
      };
      validateProduct({ ...row, category_id: null, image_path: null });
      preview.rows.push(row);
      if (row.expected_stock === null) preview.creates++;
      else preview.updates++;
    } catch (error) {
      preview.errors.push({
        row: index + 2,
        message: (error as Error).message,
      });
    }
  });
  return preview;
}
export function exportCSV(
  rows: Record<string, unknown>[],
  headers?: string[],
): string {
  // Neutralize spreadsheet formula injection in text. Numeric negatives remain numeric.
  const safe = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        k,
        typeof v === "string" && /^[\s]*[=+@-]/.test(v) ? `'${v}` : v,
      ]),
    ),
  );
  return (
    "\uFEFF" + Papa.unparse(headers ? { fields: headers, data: safe } : safe)
  );
}
export function download(
  name: string,
  data: string,
  type = "text/csv;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
