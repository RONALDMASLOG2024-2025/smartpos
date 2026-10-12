import Papa from "papaparse";
import { cents, integer } from "../domain/rules";
import type { HistoryLine, HistoryRow, Product } from "../domain/types";

export const HISTORY_FIELDS = [
  "Receipt",
  "Timestamp",
  "SKU",
  "Quantity",
  "Unit Price",
  "Source",
];
export interface HistoryPreview {
  rows: HistoryRow[];
  errors: { row: number; message: string }[];
  receipts: number;
  total_cents: number;
  duplicates: number;
  source: HistoryRow["source"] | null;
}

export function historyTimestamp(value: string): string {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2}))?$/.exec(
      value,
    );
  if (!match)
    throw new Error(
      "Timestamp must be YYYY-MM-DD or ISO date/time with a timezone.",
    );
  const [
    ,
    year,
    month,
    day,
    hour = "00",
    minute = "00",
    second = "00",
    millis = "",
    zone = "+08:00",
  ] = match;
  const plain = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}Z`,
  );
  if (
    !Number.isFinite(plain.getTime()) ||
    plain.toISOString().slice(0, 19) !==
      `${year}-${month}-${day}T${hour}:${minute}:${second}`
  )
    throw new Error("Timestamp contains an invalid calendar date or time.");
  if (
    zone !== "Z" &&
    (Number(zone.slice(1, 3)) > 14 ||
      Number(zone.slice(4)) > 59 ||
      (Number(zone.slice(1, 3)) === 14 && Number(zone.slice(4)) !== 0))
  )
    throw new Error("Timestamp timezone is invalid.");
  return new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}${millis ? `.${millis}` : ""}${zone}`,
  ).toISOString();
}

export function parseHistory(
  text: string,
  products: Product[],
  existing: HistoryLine[] = [],
  now = new Date(),
): HistoryPreview {
  const preview: HistoryPreview = {
    rows: [],
    errors: [],
    receipts: 0,
    total_cents: 0,
    duplicates: 0,
    source: null,
  };
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
    headers.length !== HISTORY_FIELDS.length ||
    !headers.every((h, i) => h.trim() === HISTORY_FIELDS[i])
  ) {
    preview.errors.push({
      row: 1,
      message: `Headers must be: ${HISTORY_FIELDS.join(", ")}.`,
    });
    return preview;
  }
  if (!lines.length || lines.length > 10000) {
    preview.errors.push({
      row: 1,
      message: "History import requires 1–10,000 item rows.",
    });
    return preview;
  }
  const skus = new Set(products.map((p) => p.sku));
  const seen = new Set<string>();
  const dates = new Map<string, string>();
  const receipts = new Set<string>();
  const old = new Map(
    existing.map((row) => [JSON.stringify([row.receipt, row.sku]), row]),
  );
  lines.forEach((values, index) => {
    try {
      if (values.length !== HISTORY_FIELDS.length)
        throw new Error("Incorrect number of columns.");
      const [receipt, timestamp, rawSku, rawQuantity, price, source] =
        values.map((v) => v.trim());
      if (!receipt || receipt.length > 80)
        throw new Error("Receipt must contain 1–80 characters.");
      const sku = rawSku.toUpperCase();
      if (!skus.has(sku))
        throw new Error(`Unknown SKU ${sku}. Add the product first.`);
      if (source !== "real" && source !== "synthetic")
        throw new Error("Source must be real or synthetic.");
      if (preview.source && preview.source !== source)
        throw new Error(
          "Use one source per file; keep real and synthetic history in separate imports.",
        );
      preview.source = source;
      const sold_at = historyTimestamp(timestamp);
      if (new Date(sold_at) > now)
        throw new Error("Historical sales cannot have future timestamps.");
      if (dates.has(receipt) && dates.get(receipt) !== sold_at)
        throw new Error("All lines in a receipt must have the same timestamp.");
      const quantity = integer(rawQuantity, "Quantity");
      if (!quantity) throw new Error("Quantity must be greater than zero.");
      const unit_price_cents = cents(price);
      if (
        unit_price_cents > 100000000 ||
        quantity * unit_price_cents > 100000000000
      )
        throw new Error("Historical item value exceeds the supported limit.");
      const key = JSON.stringify([receipt, sku]);
      if (seen.has(key))
        throw new Error(
          `Duplicate SKU ${sku} within receipt ${receipt}. Combine its quantities into one row.`,
        );
      seen.add(key);
      dates.set(receipt, sold_at);
      receipts.add(receipt);
      const row: HistoryRow = {
        receipt,
        sold_at,
        sku,
        quantity,
        unit_price_cents,
        source,
      };
      const previous = old.get(key);
      if (previous) {
        if (
          historyTimestamp(previous.sold_at) !== sold_at ||
          previous.quantity !== quantity ||
          previous.unit_price_cents !== unit_price_cents ||
          previous.source !== source
        )
          throw new Error(
            `Receipt ${receipt} already exists with different data.`,
          );
        preview.duplicates++;
      }
      preview.rows.push(row);
      preview.total_cents += quantity * unit_price_cents;
    } catch (e) {
      preview.errors.push({ row: index + 2, message: (e as Error).message });
    }
  });
  for (const receipt of receipts) {
    const previous = existing.filter((row) => row.receipt === receipt);
    if (
      previous.length &&
      previous.length !==
        preview.rows.filter((row) => row.receipt === receipt).length
    )
      preview.errors.push({
        row: 1,
        message: `Receipt ${receipt} already exists. Re-import its complete original set of item rows.`,
      });
  }
  preview.receipts = receipts.size;
  return preview;
}
