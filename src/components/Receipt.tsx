import { Download, Printer } from "lucide-react";
import { dateTime, money } from "../domain/rules";
import type { Sale } from "../domain/types";
import { download } from "../lib/csv";
import { Modal } from "./ui";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function Receipt({
  sale,
  onClose,
  demo,
}: {
  sale: Sale;
  onClose: () => void;
  demo: boolean;
}) {
  const text = [
    sale.store_name,
    demo ? "DEMO RECEIPT — NOT A REAL SALE" : "SALE RECEIPT",
    `Receipt ${sale.id}`,
    dateTime(sale.created_at),
    `Cashier: ${sale.cashier_name}`,
    "",
    ...sale.items.map(
      (i) =>
        `${i.quantity} × ${i.product_name} (${i.sku}) @ ${money(i.unit_price_cents)} = ${money(i.line_total_cents)}`,
    ),
    "",
    `Subtotal: ${money(sale.subtotal_cents)}`,
    `Discount: ${money(sale.discount_cents)}`,
    `Total: ${money(sale.total_cents)}`,
    `Payment (${sale.method}): ${money(sale.payment_cents)}`,
    `Change: ${money(sale.change_cents)}`,
    "",
    sale.receipt_note,
  ].join("\n");
  return (
    <Modal title="Sale receipt" onClose={onClose}>
      <div className="receipt">
        <h3>{sale.store_name}</h3>
        {demo && <p className="demo-label">DEMO RECEIPT</p>}
        <p className="muted">
          {sale.id}
          <br />
          {dateTime(sale.created_at)}
          <br />
          Cashier: {sale.cashier_name}
        </p>
        {sale.items.map((i) => (
          <div key={i.id} className="receipt-line">
            <span>
              {i.quantity} × {i.product_name}
              <small>
                {i.sku} · {money(i.unit_price_cents)} each
              </small>
            </span>
            <b>{money(i.line_total_cents)}</b>
          </div>
        ))}
        <div className="receipt-totals">
          <p>
            <span>Subtotal</span>
            <span>{money(sale.subtotal_cents)}</span>
          </p>
          <p>
            <span>Discount</span>
            <span>{money(sale.discount_cents)}</span>
          </p>
          <p className="total">
            <span>Total</span>
            <span>{money(sale.total_cents)}</span>
          </p>
          <p>
            <span>{sale.method} payment</span>
            <span>{money(sale.payment_cents)}</span>
          </p>
          <p>
            <span>Change</span>
            <b>{money(sale.change_cents)}</b>
          </p>
        </div>
        <p className="receipt-note">{sale.receipt_note}</p>
      </div>
      <div className="form-actions">
        <button
          onClick={() =>
            download(
              `receipt-${sale.id}.html`,
              `<!doctype html><html><head><meta charset="utf-8"><title>SmartPOS receipt</title><style>body{font:14px monospace;max-width:420px;margin:30px auto}pre{white-space:pre-wrap}</style></head><body><pre>${escape(text)}</pre></body></html>`,
              "text/html;charset=utf-8",
            )
          }
        >
          <Download size={16} />
          Download receipt
        </button>
        <button className="primary" onClick={() => window.print()}>
          <Printer size={16} />
          Print receipt
        </button>
      </div>
    </Modal>
  );
}
