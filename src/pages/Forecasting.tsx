import { useState } from "react";
import { useWorkspace } from "../context";
import { Badge, Empty, Metric, PageHead, Table } from "../components/ui";
import { forecast } from "../ml/forecast";
import type { ForecastResult } from "../domain/types";
import { download, exportCSV } from "../lib/csv";
export function Forecasting() {
  const { repo, data, busy, act } = useWorkspace();
  const [synthetic, setSynthetic] = useState(repo.mode === "demo");
  const [result, setResult] = useState<ForecastResult | null>(null);
  return (
    <>
      <PageHead
        title="Demand forecasting"
        description="Estimate the next seven days of demand and plan replenishment."
      />
      <section className="panel padded">
        <h2>Train, validate, predict</h2>
        <p className="muted">
          Weekday and trend regression learns from complete daily observations,
          including zero-sales days. The last 14 days are held out to measure
          forecast error before refitting. Real models need at least 56
          completed days of sales history per product.
        </p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={synthetic}
            disabled={repo.mode === "demo"}
            onChange={(e) => {
              setSynthetic(e.target.checked);
              setResult(null);
            }}
          />
          Use separate synthetic training data for development
        </label>
        {synthetic && (
          <div className="alert warning">
            Synthetic forecast · Demonstration only. These estimates are not
            reliable business recommendations and do not use your real sales.
          </div>
        )}
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            const prediction = forecast(data.products, data.sales, synthetic);
            if (
              await act(
                () => repo.saveForecast(prediction),
                "Forecast run recorded.",
              )
            )
              setResult(prediction);
          }}
        >
          {busy ? "Running…" : "Generate forecast"}
        </button>
      </section>
      {result &&
        (result.source === "insufficient" ? (
          <section className="panel">
            <Empty title="More real history is needed">
              {result.training_days} completed days available. Collect at least
              56 days or explicitly enable synthetic training to explore the
              pipeline.
            </Empty>
          </section>
        ) : (
          <>
            <div className="metrics">
              <Metric
                label="Training source"
                value={
                  <Badge tone={result.source === "real" ? "good" : "warn"}>
                    {result.source}
                  </Badge>
                }
              />
              <Metric
                label="Training span"
                value={`${result.training_days} days`}
              />
              <Metric label="Forecast horizon" value="7 days" />
              <Metric
                label="Holdout error"
                value={result.validation_mae?.toFixed(2) ?? "—"}
                note="Mean absolute error · units / day"
              />
            </div>
            <section className="panel">
              <div className="panel-head">
                <h2>Demand and replenishment</h2>
                <button
                  disabled={!result.results.length}
                  onClick={() =>
                    download(
                      `smartpos-${result.source}-forecast.csv`,
                      exportCSV(
                        result.results.map((r) => ({
                          Source: result.source,
                          Model: result.model_version,
                          Product: r.name,
                          "Predicted units": r.predicted_units,
                          Stock: r.stock,
                          "Suggested restock": r.restock_units,
                        })),
                      ),
                    )
                  }
                >
                  Export forecast
                </button>
              </div>
              <p className="panel-description">
                Restock = predicted demand + low-stock buffer − current stock.
                Synthetic models cover only sample SKUs; real results cover
                products with enough history. Forecasts are estimates and never
                change stock automatically.
              </p>
              {result.results.length ? (
                <Table
                  headers={[
                    "Product",
                    "Predicted 7-day units",
                    "Current stock",
                    "Suggested restock",
                  ]}
                >
                  {result.results.map((r) => (
                    <tr key={r.product_id}>
                      <td>{r.name}</td>
                      <td>{r.predicted_units}</td>
                      <td>{r.stock}</td>
                      <td>
                        <Badge tone={r.restock_units ? "warn" : "good"}>
                          {r.restock_units}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <Empty title="No eligible products">
                  Products need sufficient real history or a matching synthetic
                  sample SKU.
                </Empty>
              )}
            </section>
          </>
        ))}
    </>
  );
}
