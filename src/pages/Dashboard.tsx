import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useWorkspace } from "../context";
import { Badge, Empty, Metric, PageHead, Table } from "../components/ui";
import { dayKey, money, dateTime } from "../domain/rules";
import { dailySales, productPerformance } from "../domain/reporting";
export function Dashboard() {
  const { repo, data } = useWorkspace();
  const manager = repo.account.role === "manager";
  const today = dayKey(new Date());
  const daily = data.sales.filter((s) => dayKey(s.created_at) === today);
  const monthly = data.sales.filter(
    (s) => dayKey(s.created_at).slice(0, 7) === today.slice(0, 7),
  );
  const total = daily.reduce((sum, s) => sum + s.total_cents, 0);
  const active = data.products.filter((p) => p.status === "active");
  const low = active.filter((p) => p.stock <= p.low_stock_threshold);
  const trend = dailySales(data.sales);
  const max = Math.max(...trend.map((d) => d.total_cents), 1);
  const recent = [...data.sales]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6);
  const best = productPerformance(data.products, data.sales)
    .filter((p) => p.units > 0)
    .slice(0, 5);
  return (
    <>
      <PageHead
        title={
          manager
            ? "Store overview"
            : `Hello, ${repo.account.name.split(" ")[0]}`
        }
        description={
          manager
            ? "Sales, stock, and the work that needs your attention."
            : "Your counter is ready. Start a sale or review your recent transactions."
        }
        action={
          <Link className="button primary" to="/app/pos">
            Open point of sale <ArrowRight size={16} />
          </Link>
        }
      />
      <div className="date-line">
        {new Intl.DateTimeFormat("en-PH", {
          timeZone: "Asia/Manila",
          dateStyle: "full",
        }).format(new Date())}{" "}
        · Asia/Manila
      </div>
      <div className="metrics">
        <Metric
          label={manager ? "Sales today" : "Your sales today"}
          value={money(total)}
          note={`${daily.length} completed transactions`}
        />
        <Metric
          label={manager ? "Sales this month" : "Your transactions today"}
          value={
            manager
              ? money(monthly.reduce((sum, s) => sum + s.total_cents, 0))
              : daily.length
          }
          note={manager ? "Calendar month to date" : "Completed sales only"}
        />
        <Metric
          label="Average sale today"
          value={money(daily.length ? Math.round(total / daily.length) : 0)}
        />
        <Metric
          label={manager ? "Stock needs attention" : "Units sold today"}
          value={
            manager
              ? low.length
              : daily
                  .flatMap((s) => s.items)
                  .reduce((sum, i) => sum + i.quantity, 0)
          }
          note={
            manager
              ? `${active.filter((p) => p.stock === 0).length} out of stock`
              : "From your transactions"
          }
        />
      </div>
      {manager && (
        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-head">
              <h2>Sales over the last 14 days</h2>
              <span className="muted">Net sales · PHP</span>
            </div>
            {data.sales.length ? (
              <>
                <div
                  className="bar-chart"
                  role="img"
                  aria-label="Daily sales chart. Detailed values available in the table below."
                >
                  {trend.map((d) => (
                    <div className="bar-column" key={d.date}>
                      <div className="bar-track">
                        <span
                          title={`${d.date}: ${money(d.total_cents)}`}
                          style={{ height: `${(d.total_cents / max) * 100}%` }}
                        />
                      </div>
                      <small>{d.date.slice(8)}</small>
                    </div>
                  ))}
                </div>
                <details>
                  <summary>View daily values</summary>
                  <Table headers={["Date", "Sales", "Transactions"]}>
                    {trend.map((d) => (
                      <tr key={d.date}>
                        <td>{d.date}</td>
                        <td>{money(d.total_cents)}</td>
                        <td>{d.transactions}</td>
                      </tr>
                    ))}
                  </Table>
                </details>
              </>
            ) : (
              <Empty title="Your sales trend starts here">
                Complete your first sale to see revenue over time.
              </Empty>
            )}
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Stock attention</h2>
              <Link to="/app/inventory">View inventory</Link>
            </div>
            {low.length ? (
              <div className="stock-list">
                {low.slice(0, 5).map((p) => (
                  <div key={p.id}>
                    <span>
                      <b>{p.name}</b>
                      <small>{p.sku}</small>
                    </span>
                    <Badge tone={p.stock ? "warn" : "bad"}>
                      {p.stock ? `${p.stock} left` : "Out of stock"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="Stock is in good shape">
                No active products are below their stock threshold.
              </Empty>
            )}
          </section>
        </div>
      )}
      <section className="panel">
        <div className="panel-head">
          <h2>
            {manager ? "Recent transactions" : "Your recent transactions"}
          </h2>
          <Link to="/app/transactions">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        {recent.length ? (
          <Table
            headers={["Receipt", "Date & time", "Cashier", "Payment", "Total"]}
          >
            {recent.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link to={`/app/transactions?receipt=${s.id}`}>
                    #{s.id.slice(0, 8)}
                  </Link>
                </td>
                <td>{dateTime(s.created_at)}</td>
                <td>{s.cashier_name}</td>
                <td>
                  <Badge>{s.method}</Badge>
                </td>
                <td className="amount">{money(s.total_cents)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="No transactions yet">
            Completed sales will appear here.
          </Empty>
        )}
      </section>
      {manager && best.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2>Best-selling products</h2>
            <Link to="/app/reports">Product performance</Link>
          </div>
          <Table headers={["Product", "SKU", "Units sold", "Item revenue"]}>
            {best.map((p) => (
              <tr key={p.product_id}>
                <td>{p.name}</td>
                <td>{p.sku}</td>
                <td>{p.units}</td>
                <td>{money(p.revenue_cents)}</td>
              </tr>
            ))}
          </Table>
        </section>
      )}
    </>
  );
}
