# Import transaction history for forecasting

Managers can import previous sales from **Import & export → Import transaction history**.
Historical item rows are stored separately from live checkout receipts. They do
not deduct stock, change prices, create payments or inflate live sales totals.
The history preview reports receipt counts, quantities and item values, and the
import log records completed uploads.

## Deploy

1. In your existing Supabase project's SQL Editor, run
   [003_transaction_history.sql](../supabase/migrations/003_transaction_history.sql)
   once, after migrations 001 and 002.
2. Deploy the updated app to Vercel. No additional environment variables are needed.
3. Sign in as Manager and open **Import & export**.

## CSV format

The exact header is:

```csv
Receipt,Timestamp,SKU,Quantity,Unit Price,Source
```

| Column     | Meaning                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Receipt    | Original receipt identifier, 1–80 characters. Keep IDs stable when re-uploading.                                                            |
| Timestamp  | Sale date as `YYYY-MM-DD` in Asia/Manila, or ISO date/time with a timezone, such as `2026-07-14T10:00:00+08:00`. Future dates are rejected. |
| SKU        | An existing product SKU in the current store. Archived products can retain history.                                                         |
| Quantity   | A positive whole number of the product's units. Combine the same SKU within a receipt into one row.                                         |
| Unit Price | Historical selling price in pesos, up to two decimal places. Use the actual per-unit selling price.                                         |
| Source     | `real` for actual historical sales; `synthetic` for invented test data. Use one source per file.                                            |

Each receipt may have multiple SKUs, with the same timestamp and source on all
its lines. Files may contain up to 10,000 item rows and 5 MB. Every row must
validate before confirming. Upload complete history for its date range: the
model fills days without sales with zero demand.

The server validates permissions, quantities, prices, dates, SKUs, complete
receipts and sources again, then commits the import atomically. Identical
receipts are skipped. Changed or partial versions of existing receipts are
rejected; historical rows are immutable. Receipt IDs already used by live
checkout cannot be imported again.

## Try Sari Sari Store in production

Use [sari-sari-synthetic-history.csv](../public/samples/sari-sari-synthetic-history.csv).
It covers **July 14–October 11, 2026**, with **90 days**, **1,137 synthetic
receipts**, **3,324 item rows**, and all **40 SKUs SSS-001 through SSS-040** from
the sari-sari starter catalog. It uses synthetic daily quantities and the
synthetic catalog prices. Every CSV row is explicitly marked `synthetic`.

1. Ensure the sari-sari product catalog is present in your store.
2. Choose the sample CSV, click **Validate history and preview**, review the
   source and rows, select the review checkbox, then click **Confirm history import**.
3. Open **Forecasting** and select **Uploaded synthetic history (testing)**.
4. Click **Generate forecast**. The existing weekday/trend ridge regression
   fits each eligible product, validates on the last 14 completed days, refits,
   and predicts the next seven days. Imported dates can predate when products
   were added to SmartPOS.
5. To clean up the test rows, open **Import & export → Remove synthetic history**.
   This removes only the current store's synthetic history. Previously recorded
   forecast runs remain labelled synthetic.

Actual checkout sales and imported `real` history are used only when selecting
**Actual checkout sales + uploaded real history**. Synthetic uploaded data is
excluded from that source. Products require at least 56 completed days; today's
incomplete sales are excluded. The built-in synthetic model remains available
for the original sample SKUs.

These sample forecasts verify the import and ML pipeline. For stock planning,
replace the sample history with actual sales and select the actual-sales option.

## Reproduce and verify

`node scripts/generate_history_sample.mjs` regenerates the deterministic CSV
using seed 4242. `npm test` covers parsing, history permissions and atomicity,
replay handling, stock preservation and all 40 uploaded-history forecasts.
`npx playwright test --config playwright.auth.config.ts` runs a browser import
and forecast with mocked Supabase responses; it does not create production data.
