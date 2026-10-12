import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { useWorkspace } from "../context";
import { Badge, Empty, PageHead, Table } from "../components/ui";
import {
  CSV_FIELDS,
  download,
  exportCSV,
  parseProducts,
  template,
  type Preview,
} from "../lib/csv";
import { dateTime } from "../domain/rules";
import { HistoryImport } from "../components/HistoryImport";
export function DataPage() {
  const { repo, data, busy, act } = useWorkspace();
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("pasted-products.csv");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [fileError, setFileError] = useState("");
  function update(value: string) {
    setText(value);
    setPreview(null);
    setConfirmed(false);
    setFileError("");
  }
  const productRows = data.products.map((p) => ({
    SKU: p.sku,
    "Product Name": p.name,
    Category: data.categories.find((c) => c.id === p.category_id)?.name ?? "",
    Description: p.description,
    Price: (p.price_cents / 100).toFixed(2),
    Cost: ((p.cost_cents ?? 0) / 100).toFixed(2),
    "Stock Quantity": p.stock,
    "Low Stock Threshold": p.low_stock_threshold,
    Status: p.status,
  }));
  return (
    <>
      <PageHead
        title="Import & export"
        description="Move your data with a validated, reviewable CSV workflow."
      />
      <div className="data-grid">
        <section className="panel padded">
          <div className="panel-head">
            <h2>Import products</h2>
            <Upload size={18} />
          </div>
          <p className="muted">
            Existing SKUs are updated. New SKUs are added. Every row must pass
            validation before any changes are applied.
          </p>
          <button
            onClick={() => download("smartpos-product-template.csv", template)}
          >
            <Download size={16} />
            Download CSV template
          </button>
          <label>
            Upload product CSV · maximum 2 MB
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                update("");
                setFilename(file.name);
                if (file.size > 2 * 1024 * 1024) {
                  setFileError("CSV must be at most 2 MB.");
                  return;
                }
                try {
                  update(await file.text());
                } catch {
                  setFileError("The file could not be read. Choose it again.");
                }
              }}
            />
          </label>
          <details>
            <summary>Or paste CSV content</summary>
            <label>
              CSV content
              <textarea
                aria-label="CSV content"
                rows={7}
                value={text}
                onChange={(e) => update(e.target.value)}
                placeholder={CSV_FIELDS.join(",")}
              />
            </label>
          </details>
          {fileError && (
            <p role="alert" className="field-error">
              {fileError}
            </p>
          )}
          <div className="form-actions">
            <button
              className="primary"
              disabled={!text.trim() || busy}
              onClick={() => {
                setPreview(parseProducts(text, data.products));
                setConfirmed(false);
              }}
            >
              Validate and preview
            </button>
          </div>
        </section>
        <section className="panel padded">
          <div className="panel-head">
            <h2>Export store data</h2>
            <Download size={18} />
          </div>
          <p className="muted">
            Exports include data from your own workspace. Products can be edited
            and re-imported using the same format.
          </p>
          <div className="export-buttons">
            <button
              onClick={() =>
                download(
                  "smartpos-products.csv",
                  exportCSV(productRows, CSV_FIELDS),
                )
              }
            >
              Export products
            </button>
            <button
              onClick={() =>
                download(
                  "smartpos-inventory.csv",
                  exportCSV(
                    data.products.map((p) => ({
                      SKU: p.sku,
                      Product: p.name,
                      Stock: p.stock,
                      Threshold: p.low_stock_threshold,
                      Status: p.status,
                    })),
                    ["SKU", "Product", "Stock", "Threshold", "Status"],
                  ),
                )
              }
            >
              Export inventory
            </button>
            <button
              onClick={() =>
                download(
                  "smartpos-transactions.csv",
                  exportCSV(
                    data.sales.map((s) => ({
                      Receipt: s.id,
                      Timestamp: s.created_at,
                      Cashier: s.cashier_name,
                      Subtotal: s.subtotal_cents / 100,
                      Discount: s.discount_cents / 100,
                      Total: s.total_cents / 100,
                      Payment: s.payment_cents / 100,
                      Change: s.change_cents / 100,
                      Method: s.method,
                    })),
                    [
                      "Receipt",
                      "Timestamp",
                      "Cashier",
                      "Subtotal",
                      "Discount",
                      "Total",
                      "Payment",
                      "Change",
                      "Method",
                    ],
                  ),
                )
              }
            >
              Export transactions
            </button>
            <button
              onClick={() =>
                download(
                  "smartpos-transaction-items.csv",
                  exportCSV(
                    data.sales
                      .flatMap((s) => s.items)
                      .map((i) => ({
                        Receipt: i.transaction_id,
                        SKU: i.sku,
                        Product: i.product_name,
                        Quantity: i.quantity,
                        "Unit price": i.unit_price_cents / 100,
                        "Line total": i.line_total_cents / 100,
                      })),
                    [
                      "Receipt",
                      "SKU",
                      "Product",
                      "Quantity",
                      "Unit price",
                      "Line total",
                    ],
                  ),
                )
              }
            >
              Export transaction items
            </button>
            <button
              onClick={() =>
                download(
                  "smartpos-stock-history.csv",
                  exportCSV(
                    data.movements.map((m) => ({
                      Timestamp: m.created_at,
                      Product:
                        data.products.find((p) => p.id === m.product_id)?.sku ??
                        m.product_id,
                      Change: m.delta,
                      Balance: m.balance,
                      Reason: m.reason,
                    })),
                    ["Timestamp", "Product", "Change", "Balance", "Reason"],
                  ),
                )
              }
            >
              Export stock history
            </button>
          </div>
        </section>
      </div>
      {preview && (
        <section className="panel padded">
          <div className="panel-head">
            <h2>Import preview</h2>
            <Badge tone={preview.errors.length ? "bad" : "good"}>
              {preview.errors.length
                ? `${preview.errors.length} errors`
                : "All rows valid"}
            </Badge>
          </div>
          <p>
            {preview.creates} products to add · {preview.updates} products to
            update · {filename}
          </p>
          {preview.errors.length > 0 && (
            <>
              <div className="alert error" role="alert">
                No changes will be imported. Correct the errors and validate
                again.
              </div>
              <Table headers={["CSV row", "Validation error"]}>
                {preview.errors.map((e, i) => (
                  <tr key={i}>
                    <td>{e.row}</td>
                    <td>{e.message}</td>
                  </tr>
                ))}
              </Table>
            </>
          )}
          <Table
            headers={["SKU", "Product", "Category", "Price", "Stock", "Action"]}
          >
            {preview.rows.slice(0, 100).map((r, i) => (
              <tr key={i}>
                <td>{r.sku}</td>
                <td>{r.name}</td>
                <td>{r.category || "Uncategorized"}</td>
                <td>₱{(r.price_cents / 100).toFixed(2)}</td>
                <td>{r.stock}</td>
                <td>{r.expected_stock === null ? "Add" : "Update"}</td>
              </tr>
            ))}
          </Table>
          {preview.rows.length > 100 && (
            <p className="muted">
              Showing the first 100 rows of {preview.rows.length}. All rows were
              validated.
            </p>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={!!preview.errors.length}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I reviewed this import and approve replacing the listed prices and
            stock balances.
          </label>
          <button
            className="primary"
            disabled={
              busy ||
              !confirmed ||
              !!preview.errors.length ||
              !preview.rows.length
            }
            onClick={async () => {
              if (
                await act(
                  () => repo.importProducts(preview.rows, filename),
                  `Imported ${preview.rows.length} products. Result recorded.`,
                )
              ) {
                setPreview(null);
                setConfirmed(false);
                setText("");
              }
            }}
          >
            {busy ? "Importing…" : "Confirm import"}
          </button>
        </section>
      )}
      <HistoryImport />
      <section className="panel">
        <div className="panel-head">
          <h2>Import history</h2>
        </div>
        {data.imports.length ? (
          <Table headers={["Date & time", "Filename", "Rows", "Result"]}>
            {[...data.imports]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((r) => (
                <tr key={r.id}>
                  <td>{dateTime(r.created_at)}</td>
                  <td>{r.filename}</td>
                  <td>{r.row_count}</td>
                  <td>
                    <Badge tone="good">{r.result}</Badge>
                  </td>
                </tr>
              ))}
          </Table>
        ) : (
          <Empty title="No completed imports">
            Successful imports are recorded here.
          </Empty>
        )}
      </section>
    </>
  );
}
