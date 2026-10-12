import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import { useWorkspace } from "../context";
import { Badge, Empty, Metric, PageHead, Table } from "../components/ui";
import { Receipt } from "../components/Receipt";
import { dayKey, dateTime, money } from "../domain/rules";
import { productPerformance } from "../domain/reporting";
import { download, exportCSV } from "../lib/csv";
export function Transactions() {
  const { repo, data } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const rows = data.sales
    .filter(
      (s) =>
        s.id.toLowerCase().includes(search.toLowerCase()) &&
        (!date || dayKey(s.created_at) === date),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const receipt = data.sales.find((s) => s.id === params.get("receipt"));
  return (
    <>
      <PageHead
        title="Transactions"
        description={
          repo.account.role === "manager"
            ? "Every completed sale, with its original receipt."
            : "Your completed sales and receipts."
        }
      />
      <div className="toolbar">
        <input
          aria-label="Search receipt"
          placeholder="Search receipt ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="date-filter">
          Sale date
          <input
            aria-label="Filter transaction date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button
          onClick={() => {
            setDate("");
            setSearch("");
          }}
        >
          Clear filters
        </button>
      </div>
      <section className="panel">
        {rows.length ? (
          <Table
            headers={[
              "Receipt",
              "Date & time",
              "Cashier",
              "Items",
              "Payment",
              "Total",
              "Actions",
            ]}
          >
            {rows.map((s) => (
              <tr key={s.id}>
                <td>#{s.id.slice(0, 8)}</td>
                <td>{dateTime(s.created_at)}</td>
                <td>{s.cashier_name}</td>
                <td>{s.items.reduce((n, i) => n + i.quantity, 0)}</td>
                <td>
                  <Badge>{s.method}</Badge>
                </td>
                <td className="amount">{money(s.total_cents)}</td>
                <td>
                  <button
                    className="small-button"
                    aria-label={`View receipt ${s.id.slice(0, 8)}`}
                    onClick={() => setParams({ receipt: s.id })}
                  >
                    View receipt
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="No transactions found">
            Complete a sale or change your filters.
          </Empty>
        )}
      </section>
      {receipt && (
        <Receipt
          sale={receipt}
          demo={repo.mode === "demo"}
          onClose={() => setParams({})}
        />
      )}
    </>
  );
}
export function Reports() {
  const { data } = useWorkspace();
  const today = dayKey(new Date());
  const [start, setStart] = useState(`${today.slice(0, 7)}-01`);
  const [end, setEnd] = useState(today);
  const invalid = !!start && !!end && start > end;
  const rows = invalid
    ? []
    : data.sales.filter(
        (s) =>
          (!start || dayKey(s.created_at) >= start) &&
          (!end || dayKey(s.created_at) <= end),
      );
  const total = rows.reduce((n, s) => n + s.total_cents, 0);
  const performance = productPerformance(data.products, rows);
  const cashiers = data.accounts
    .map((a) => {
      const own = rows.filter((s) => s.cashier_id === a.id);
      return {
        ...a,
        count: own.length,
        total: own.reduce((n, s) => n + s.total_cents, 0),
      };
    })
    .filter((a) => a.count > 0);
  return (
    <>
      <PageHead
        title="Sales reports"
        description="Use completed sales to understand revenue and product performance."
        action={
          <button
            disabled={invalid || !rows.length}
            onClick={() =>
              download(
                "smartpos-sales-report.csv",
                exportCSV(
                  rows.map((s) => ({
                    Receipt: s.id,
                    Date: dayKey(s.created_at),
                    Cashier: s.cashier_name,
                    Subtotal: s.subtotal_cents / 100,
                    Discount: s.discount_cents / 100,
                    Total: s.total_cents / 100,
                    Payment: s.method,
                  })),
                ),
              )
            }
          >
            <Download size={16} />
            Export sales
          </button>
        }
      />
      <div className="toolbar">
        <label className="date-filter">
          From
          <input
            type="date"
            aria-label="Report start date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="date-filter">
          To
          <input
            type="date"
            aria-label="Report end date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      {invalid && (
        <p className="field-error" role="alert">
          Start date must be before end date.
        </p>
      )}
      <div className="metrics">
        <Metric label="Net sales" value={money(total)} />
        <Metric label="Completed transactions" value={rows.length} />
        <Metric
          label="Average transaction"
          value={money(rows.length ? Math.round(total / rows.length) : 0)}
        />
        <Metric
          label="Units sold"
          value={rows
            .flatMap((s) => s.items)
            .reduce((n, i) => n + i.quantity, 0)}
        />
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Product performance</h2>
          <button
            disabled={!performance.length}
            onClick={() =>
              download(
                "smartpos-product-performance.csv",
                exportCSV(
                  performance.map((p) => ({
                    SKU: p.sku,
                    Product: p.name,
                    Units: p.units,
                    "Item revenue": p.revenue_cents / 100,
                  })),
                ),
              )
            }
          >
            Export products
          </button>
        </div>
        <p className="panel-description">
          Item revenue is before transaction discounts. Products with no sales
          appear at the end.
        </p>
        {performance.length ? (
          <Table
            headers={["Product", "SKU", "Units", "Item revenue", "Movement"]}
          >
            {performance.map((p) => (
              <tr key={p.product_id}>
                <td>{p.name}</td>
                <td>{p.sku}</td>
                <td>{p.units}</td>
                <td>{money(p.revenue_cents)}</td>
                <td>
                  <Badge tone={p.units ? "good" : "warn"}>
                    {p.units ? "Selling" : "No sales in period"}
                  </Badge>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="No products yet" />
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Cashier activity</h2>
        </div>
        {cashiers.length ? (
          <Table headers={["Cashier", "Transactions", "Net sales"]}>
            {cashiers.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.count}</td>
                <td>{money(a.total)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="No cashier sales in this period" />
        )}
      </section>
    </>
  );
}
