import { useState } from "react";
import { useWorkspace } from "../context";
import { Badge, Empty, Metric, PageHead, Table } from "../components/ui";
import { forecast } from "../ml/forecast";
import type { ForecastResult } from "../domain/types";
import { download, exportCSV } from "../lib/csv";
export function Forecasting() {
  const { repo, data, busy, act } = useWorkspace();
  const [training, setTraining] = useState<
    "real" | "uploaded-synthetic" | "built-in"
  >(repo.mode === "demo" ? "built-in" : "real");
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
          forecast error before refitting. Models need at least 56 completed
          days of sales history per product.
        </p>
        <label>
          Training data
          <select
            value={training}
            onChange={(e) => {
              setTraining(e.target.value as typeof training);
              setResult(null);
            }}
          >
            <option value="real">
              Actual checkout sales + uploaded real history
            </option>
            <option value="uploaded-synthetic">
              Uploaded synthetic history (testing)
            </option>
            <option value="built-in">Built-in sample model</option>
          </select>
        </label>
        <p className="small muted">
          {data.history.filter((row) => row.source === "real").length} uploaded
          real item rows ·{" "}
          {data.history.filter((row) => row.source === "synthetic").length}{" "}
          uploaded synthetic item rows. Import past sales in Import &amp;
          export. Historical dates can predate when products were added to
          SmartPOS.
        </p>
        {training !== "real" && (
          <div className="alert warning">
            Synthetic forecast · Testing only. These estimates use sample data
            and do not establish actual demand in your store.
          </div>
        )}
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            const prediction = forecast(
              data.products,
              data.sales,
              training === "built-in"
                ? true
                : training === "uploaded-synthetic"
                  ? "uploaded-synthetic"
                  : false,
              new Date(),
              data.history,
            );
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
            <Empty title="More sales history is needed">
              {result.training_days} completed days available. Collect at least
              56 days for a product in the selected source. Upload the 90-day
              sample and select Uploaded synthetic history to test your
              sari-sari catalog.
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
                The built-in model covers only sample SKUs. Uploaded-history
                results cover products with enough history in the selected
                source. Forecasts are estimates and never change stock
                automatically.
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
