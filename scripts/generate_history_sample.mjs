import { readFile, writeFile, mkdir } from "node:fs/promises";
import Papa from "papaparse";
import { URL } from "node:url";
import console from "node:console";

// Deterministic sample receipts for the requested production test; no cloud writes.
const products = JSON.parse(
  await readFile(
    new URL("../assets/sari-sari-starter/products.json", import.meta.url),
    "utf8",
  ),
);
const end = new Date("2026-10-11T00:00:00Z");
const days = 90;
let seed = 4242;
function random() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}
const rows = [];
for (let day = 0; day < days; day++) {
  const current = new Date(end.getTime() - (days - 1 - day) * 86400000);
  const date = current.toISOString().slice(0, 10);
  const selected = products.flatMap((p, index) => {
    const weekend = current.getUTCDay() === 0 || current.getUTCDay() === 6;
    const base = [
      3, 5, 4, 2, 3, 12, 3, 1, 6, 5, 6, 4, 3, 8, 10, 5, 2, 8, 3, 6, 1, 6, 2, 4,
      4, 4, 15, 2, 3, 10, 1, 2, 1, 3, 3, 1, 4, 1, 3, 2,
    ][index];
    const payday = current.getUTCDate() === 15 || current.getUTCDate() === 30;
    const quantity = Math.max(
      0,
      Math.round(
        base * (1 + day * 0.002 + (weekend ? 0.18 : 0) + (payday ? 0.15 : 0)) +
          (random() - 0.5) * base * 0.9,
      ),
    );
    // Explicit zero-sales days are omitted as receipts; the model fills complete days with zero.
    if (day > 0 && (random() < 0.08 || quantity === 0)) return [];
    return [{ p, quantity: Math.max(1, quantity) }];
  });
  selected.forEach(({ p, quantity }, index) => {
    const basket = Math.floor(index / 3);
    rows.push({
      Receipt: `SYN-${date.replaceAll("-", "")}-${String(basket + 1).padStart(3, "0")}`,
      Timestamp: `${date}T${String(8 + (basket % 12)).padStart(2, "0")}:${String((basket * 3) % 60).padStart(2, "0")}:00+08:00`,
      SKU: p.sku,
      Quantity: quantity,
      "Unit Price": (p.price_cents / 100).toFixed(2),
      Source: "synthetic",
    });
  });
}
const folder = new URL("../public/samples/", import.meta.url);
await mkdir(folder, { recursive: true });
const target = new URL("sari-sari-synthetic-history.csv", folder);
await writeFile(target, "\uFEFF" + Papa.unparse(rows) + "\r\n", "utf8");
const summary = {
  source: "synthetic",
  store: "Sari Sari Store",
  seed: 4242,
  days,
  start_date: rows[0].Timestamp.slice(0, 10),
  end_date: rows.at(-1).Timestamp.slice(0, 10),
  products: products.length,
  receipts: new Set(rows.map((row) => row.Receipt)).size,
  item_rows: rows.length,
  units: rows.reduce((sum, row) => sum + row.Quantity, 0),
  note: "Synthetic testing data for SSS-001 through SSS-040. Import as synthetic. Quantities and selling prices are invented; no stock deduction occurs.",
};
await writeFile(
  new URL("sari-sari-synthetic-history.json", folder),
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(JSON.stringify(summary));
