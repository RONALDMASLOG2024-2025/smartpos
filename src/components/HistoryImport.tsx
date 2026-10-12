import { useState } from "react";
import { Download } from "lucide-react";
import { useWorkspace } from "../context";
import { Badge, Modal, Table } from "./ui";
import {
  HISTORY_FIELDS,
  parseHistory,
  type HistoryPreview,
} from "../lib/historyCsv";
import { download, exportCSV } from "../lib/csv";
import { dateTime, dayKey, money } from "../domain/rules";

export function HistoryImport() {
  const { repo, data, busy, act, error } = useWorkspace();
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<HistoryPreview | null>(null);
  const [approved, setApproved] = useState(false);
  const [fileError, setFileError] = useState("");
  const [remove, setRemove] = useState(false);
  const syntheticRows = data.history.filter(
    (row) => row.source === "synthetic",
  ).length;
  return (
    <section className="panel padded">
      <div className="panel-head">
        <h2>Import transaction history</h2>
        <Badge>{data.history.length} stored item rows</Badge>
      </div>
      <p className="muted">
        Upload previous sales to train demand forecasts. Each row is one product
        in a receipt. Stock and live checkout totals stay unchanged. Source must
        be real or synthetic; each file uses one source.
      </p>
      <p className="small muted">
        Prices are in pesos. Use the actual per-unit selling price. Timestamps
        accept YYYY-MM-DD (Manila) or ISO date/time with a timezone. All receipt
        lines must share a timestamp, with one row per SKU.
      </p>
      <div className="actions">
        <button
          onClick={() =>
            download(
              "smartpos-history-template.csv",
              exportCSV(
                [
                  {
                    Receipt: "HISTORY-001",
                    Timestamp: dayKey(new Date(Date.now() - 86400000)),
                    SKU: data.products[0]?.sku ?? "YOUR-SKU",
                    Quantity: 2,
                    "Unit Price": (
                      (data.products[0]?.price_cents ?? 2500) / 100
                    ).toFixed(2),
                    Source: "real",
                  },
                ],
                HISTORY_FIELDS,
              ),
            )
          }
        >
          <Download size={16} />
          Download history template
        </button>
        <a
          className="button"
          href="/samples/sari-sari-synthetic-history.csv"
          download
        >
          Download sari-sari sample CSV
        </a>
        {syntheticRows > 0 && (
          <button disabled={busy} onClick={() => setRemove(true)}>
            Remove synthetic history
          </button>
        )}
      </div>
      <label>
        Upload transaction history CSV · maximum 5 MB
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setPreview(null);
            setApproved(false);
            setText("");
            setFileError("");
            setFilename(file.name);
            if (file.size > 5 * 1024 * 1024) {
              setFileError("History CSV must be at most 5 MB.");
              return;
            }
            try {
              setText(await file.text());
            } catch {
              setFileError("The CSV could not be read. Choose it again.");
            }
          }}
        />
      </label>
      {fileError && (
        <p role="alert" className="field-error">
          {fileError}
        </p>
      )}
      <button
        className="primary"
        disabled={!text.trim() || busy}
        onClick={() => {
          setPreview(parseHistory(text, data.products, data.history));
          setApproved(false);
        }}
      >
        Validate history and preview
      </button>
      <p className="small muted">
        The sample contains 90 days for SKUs SSS-001 through SSS-040. Import the
        sari-sari product catalog first. Synthetic history is available only in
        the uploaded synthetic forecast option.
      </p>
      {preview && (
        <div className="history-preview">
          <div className="panel-head">
            <h3>Transaction history preview</h3>
            <Badge tone={preview.errors.length ? "bad" : "good"}>
              {preview.errors.length
                ? `${preview.errors.length} errors`
                : "All history rows valid"}
            </Badge>
          </div>
          <p>
            {preview.receipts} receipts · {preview.rows.length} item rows ·{" "}
            {money(preview.total_cents)} item value · {preview.duplicates}{" "}
            matching rows to skip · {filename}
          </p>
          {preview.source && (
            <Badge tone={preview.source === "synthetic" ? "warn" : "good"}>
              {preview.source}
            </Badge>
          )}
          {preview.errors.length > 0 && (
            <div className="alert error" role="alert">
              <p>Correct every error before importing.</p>
              <ul>
                {preview.errors.slice(0, 30).map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
              {preview.errors.length > 30 && (
                <p>Showing the first 30 errors.</p>
              )}
            </div>
          )}
          <Table
            headers={[
              "Receipt",
              "Date & time",
              "SKU",
              "Quantity",
              "Unit price",
            ]}
          >
            {preview.rows.slice(0, 50).map((row, i) => (
              <tr key={i}>
                <td>{row.receipt}</td>
                <td>{dateTime(row.sold_at)}</td>
                <td>{row.sku}</td>
                <td>{row.quantity}</td>
                <td>{money(row.unit_price_cents)}</td>
              </tr>
            ))}
          </Table>
          {preview.rows.length > 50 && (
            <p className="small muted">
              Showing 50 rows. All {preview.rows.length} rows were validated.
            </p>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={approved}
              disabled={!!preview.errors.length || busy}
              onChange={(e) => setApproved(e.target.checked)}
            />
            I reviewed the source and values. This file contains complete
            history for its date range; missing sales days will count as zero
            demand.
          </label>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <button
            className="primary"
            disabled={
              busy ||
              !approved ||
              !!preview.errors.length ||
              !preview.rows.length
            }
            onClick={async () => {
              if (
                await act(
                  () => repo.importHistory(preview.rows, filename),
                  "Transaction history processed. Matching receipts were skipped; new rows are ready for forecasting.",
                )
              ) {
                setText("");
                setPreview(null);
                setApproved(false);
              }
            }}
          >
            {busy ? "Importing history…" : "Confirm history import"}
          </button>
        </div>
      )}
      {remove && (
        <Modal
          title="Remove synthetic history"
          onClose={() => !busy && setRemove(false)}
        >
          <p>
            Remove {syntheticRows} synthetic training rows from this store?
            Actual sales history and stock are preserved.
          </p>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button disabled={busy} onClick={() => setRemove(false)}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                if (
                  await act(
                    () => repo.removeSyntheticHistory(),
                    "Synthetic training history removed.",
                  )
                )
                  setRemove(false);
              }}
            >
              Remove sample history
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
