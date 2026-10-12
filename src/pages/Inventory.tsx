import { useState } from "react";
import { Badge, Empty, Modal, PageHead, Table } from "../components/ui";
import { dateTime, integer } from "../domain/rules";
import type { Product } from "../domain/types";
import { useWorkspace } from "../context";
export function Inventory() {
  const { repo, data, busy, error, act } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const [edit, setEdit] = useState<Product | null>(null);
  const [localError, setLocalError] = useState("");
  const rows = data.products.filter(
    (p) =>
      p.status === "active" &&
      (filter === "all" ||
        (filter === "low" && p.stock <= p.low_stock_threshold) ||
        (filter === "out" && !p.stock)),
  );
  return (
    <>
      <PageHead
        title="Inventory"
        description="Monitor availability, record deliveries, and review stock changes."
      />
      <div className="toolbar">
        <select
          aria-label="Stock filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All active products</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
      </div>
      <section className="panel">
        {rows.length ? (
          <Table
            headers={[
              "Product",
              "SKU",
              "Stock",
              "Threshold",
              "Availability",
              "Actions",
            ]}
          >
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.sku}</td>
                <td>{p.stock}</td>
                <td>{p.low_stock_threshold}</td>
                <td>
                  <Badge
                    tone={
                      !p.stock
                        ? "bad"
                        : p.stock <= p.low_stock_threshold
                          ? "warn"
                          : "good"
                    }
                  >
                    {!p.stock
                      ? "Out of stock"
                      : p.stock <= p.low_stock_threshold
                        ? "Low stock"
                        : "Available"}
                  </Badge>
                </td>
                <td>
                  <button
                    className="small-button"
                    onClick={() => {
                      setEdit(p);
                      setLocalError("");
                    }}
                    aria-label={`Adjust stock for ${p.name}`}
                  >
                    Adjust stock
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="No products match this filter" />
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Stock history</h2>
          <span className="muted">Latest 50 changes</span>
        </div>
        {data.movements.length ? (
          <Table
            headers={["Date & time", "Product", "Change", "Balance", "Reason"]}
          >
            {[...data.movements]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 50)
              .map((m) => (
                <tr key={m.id}>
                  <td>{dateTime(m.created_at)}</td>
                  <td>
                    {data.products.find((p) => p.id === m.product_id)?.name ??
                      m.product_id}
                  </td>
                  <td>
                    {m.delta > 0 ? "+" : ""}
                    {m.delta}
                  </td>
                  <td>{m.balance}</td>
                  <td>{m.reason}</td>
                </tr>
              ))}
          </Table>
        ) : (
          <Empty title="No stock changes yet">
            Deliveries, adjustments and sales are recorded here.
          </Empty>
        )}
      </section>
      {edit && (
        <Modal title="Adjust stock" onClose={() => !busy && setEdit(null)}>
          <p>
            {edit.name} · Current stock: <b>{edit.stock}</b>
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                const stock = integer(String(f.get("stock")), "Stock");
                const reason = String(f.get("reason")).trim();
                if (
                  await act(
                    () => repo.adjustStock(edit.id, stock, edit.stock, reason),
                    "Stock updated and recorded.",
                  )
                )
                  setEdit(null);
              } catch (e) {
                setLocalError((e as Error).message);
              }
            }}
          >
            <label>
              New stock quantity
              <input
                required
                name="stock"
                type="number"
                min="0"
                max="1000000"
                defaultValue={edit.stock}
              />
            </label>
            <label>
              Reason
              <input
                required
                name="reason"
                maxLength={200}
                placeholder="e.g. Delivery received, counted 30 units"
              />
            </label>
            <p className="muted small">
              This sets the new balance and records the difference.
            </p>
            {(localError || error) && (
              <p className="field-error" role="alert">
                {localError || error}
              </p>
            )}
            <div className="form-actions">
              <button type="button" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button disabled={busy} className="primary">
                Confirm stock adjustment
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
