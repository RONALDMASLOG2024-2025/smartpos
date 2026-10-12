import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Search, Trash2, ShoppingBag } from "lucide-react";
import { useWorkspace } from "../context";
import { Badge, Empty, Modal, PageHead, ProductImage } from "../components/ui";
import { Receipt } from "../components/Receipt";
import { cartSubtotal, cents, money, validateCheckout } from "../domain/rules";
import type {
  CartItem,
  CheckoutInput,
  PaymentMethod,
  Product,
} from "../domain/types";
export function POS() {
  const { repo, data, busy, act, error } = useWorkspace();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState("");
  const [discount, setDiscount] = useState("0");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [confirm, setConfirm] = useState<CheckoutInput | null>(null);
  const [localError, setLocalError] = useState("");
  const [receiptId, setReceiptId] = useState("");
  useEffect(() => setLocalError(""), [cart, payment, discount, method]);
  const request = useRef({ signature: "", id: "" });
  const sub = cartSubtotal(cart);
  let discountCents = 0;
  let paid = 0;
  try {
    discountCents = cents(discount);
    paid =
      method === "cash"
        ? payment
          ? cents(payment)
          : 0
        : Math.max(0, sub - discountCents);
  } catch {
    /* validation runs before checkout */
  }
  const total = Math.max(0, sub - discountCents);
  const available = data.products.filter(
    (p) =>
      p.status === "active" &&
      (!category || p.category_id === category) &&
      `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()),
  );
  function add(p: Product) {
    setLocalError("");
    const q = cart.find((i) => i.product_id === p.id)?.quantity ?? 0;
    if (q >= p.stock) {
      setLocalError(`Only ${p.stock} units of ${p.name} are available.`);
      return;
    }
    setCart((c) =>
      c.some((i) => i.product_id === p.id)
        ? c.map((i) =>
            i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i,
          )
        : [
            ...c,
            {
              product_id: p.id,
              quantity: 1,
              expected_price_cents: p.price_cents,
            },
          ],
    );
  }
  function prepare() {
    setLocalError("");
    try {
      const values = {
        items: cart,
        payment: method === "cash" ? cents(payment) : sub - cents(discount),
        discount: cents(discount),
        method,
      };
      const signature = JSON.stringify(values);
      if (request.current.signature !== signature)
        request.current = { signature, id: crypto.randomUUID() };
      const input = { ...values, request_id: request.current.id };
      validateCheckout(input, data.products, repo.account.role);
      setConfirm(input);
    } catch (e) {
      setLocalError((e as Error).message);
    }
  }
  const receipt = data.sales.find((s) => s.id === receiptId);
  return (
    <>
      <PageHead
        title="Point of sale"
        description="Find a product. Build a basket. Complete the sale."
      />
      {localError && (
        <div className="alert error" role="alert">
          {localError}
        </div>
      )}
      <div className="pos-layout">
        <section className="catalogue">
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label="Search products"
              autoFocus
              placeholder="Search by product name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="category-tabs" aria-label="Product categories">
            <button
              className={!category ? "selected" : ""}
              onClick={() => setCategory("")}
            >
              All products
            </button>
            {data.categories.map((c) => (
              <button
                key={c.id}
                className={category === c.id ? "selected" : ""}
                onClick={() => setCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <p className="muted small">
            {available.length} products · Select a product to add it
          </p>
          {available.length ? (
            <div className="product-grid">
              {available.map((p) => (
                <button
                  key={p.id}
                  className="product-card"
                  disabled={!p.stock || busy}
                  onClick={() => add(p)}
                  aria-label={`Add ${p.name} to cart`}
                >
                  <ProductImage product={p} />
                  <div className="product-card-info">
                    <span className="product-category">
                      {data.categories.find((c) => c.id === p.category_id)
                        ?.name ?? "Uncategorized"}
                    </span>
                    <b>{p.name}</b>
                    <span className="product-card-bottom">
                      <strong>{money(p.price_cents)}</strong>
                      <Badge
                        tone={
                          !p.stock
                            ? "bad"
                            : p.stock <= p.low_stock_threshold
                              ? "warn"
                              : "neutral"
                        }
                      >
                        {p.stock ? `${p.stock} in stock` : "Sold out"}
                      </Badge>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <Empty title="No products found">
              Try another search or category.
            </Empty>
          )}
        </section>
        <section className="cart-panel">
          <div className="panel-head">
            <h2>
              <ShoppingBag size={20} />
              Current basket
            </h2>
            <span className="muted">
              {cart.reduce((n, i) => n + i.quantity, 0)} items
            </span>
          </div>
          {cart.length ? (
            <div className="cart-items">
              {cart.map((item) => {
                const p = data.products.find((p) => p.id === item.product_id);
                const stale =
                  !p ||
                  p.status !== "active" ||
                  item.quantity > p.stock ||
                  p.price_cents !== item.expected_price_cents;
                return (
                  <div key={item.product_id} className="cart-item">
                    <div className="cart-item-title">
                      <b>{p?.name ?? "Unavailable product"}</b>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${p?.name ?? "item"}`}
                        onClick={() =>
                          setCart((c) =>
                            c.filter((i) => i.product_id !== item.product_id),
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <small>{money(item.expected_price_cents)} each</small>
                    {stale && (
                      <p className="field-error">
                        Stock or price changed. Remove this item and add it
                        again.
                      </p>
                    )}
                    <div className="cart-item-bottom">
                      <div className="quantity">
                        <button
                          aria-label={`Decrease ${p?.name}`}
                          onClick={() =>
                            setCart((c) =>
                              c.flatMap((i) =>
                                i.product_id !== item.product_id
                                  ? [i]
                                  : i.quantity > 1
                                    ? [{ ...i, quantity: i.quantity - 1 }]
                                    : [],
                              ),
                            )
                          }
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          aria-label={`Quantity for ${p?.name}`}
                          type="number"
                          min="1"
                          max={p?.stock ?? 1}
                          value={item.quantity}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (
                              Number.isInteger(n) &&
                              n >= 1 &&
                              n <= (p?.stock ?? 0)
                            )
                              setCart((c) =>
                                c.map((i) =>
                                  i.product_id === item.product_id
                                    ? { ...i, quantity: n }
                                    : i,
                                ),
                              );
                          }}
                        />
                        <button
                          aria-label={`Increase ${p?.name}`}
                          disabled={!p || item.quantity >= p.stock}
                          onClick={() => p && add(p)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <strong>
                        {money(item.quantity * item.expected_price_cents)}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty title="Your basket is empty">
              Select a product to start a sale.
            </Empty>
          )}
          <div className="cart-checkout">
            <div className="summary-line">
              <span>Subtotal</span>
              <span>{money(sub)}</span>
            </div>
            {repo.account.role === "manager" && (
              <label className="inline-label">
                Discount (₱)
                <input
                  type="text"
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </label>
            )}
            <div className="summary-line grand-total">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
            <label>
              Payment method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              >
                <option value="cash">Cash</option>
                <option value="card">Card — paid at terminal</option>
                <option value="ewallet">E-wallet — payment verified</option>
              </select>
            </label>
            {method === "cash" ? (
              <label>
                Amount received (₱)
                <input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                />
              </label>
            ) : (
              <p className="muted small">
                Confirm the payment was received outside SmartPOS before
                completing the sale.
              </p>
            )}
            <div className="summary-line">
              <span>{paid >= total ? "Change due" : "Still needed"}</span>
              <b>{money(Math.abs(paid - total))}</b>
            </div>
            <button
              className="primary wide"
              disabled={!cart.length || busy}
              onClick={prepare}
            >
              Review payment <ArrowLabel />
            </button>
          </div>
        </section>
      </div>
      {confirm && (
        <Modal
          title="Confirm transaction"
          onClose={() => !busy && setConfirm(null)}
        >
          <p>
            Complete this sale for{" "}
            <strong>
              {money(cartSubtotal(confirm.items) - confirm.discount)}
            </strong>
            ?
          </p>
          <p>
            {confirm.method} payment: {money(confirm.payment)} · Change:{" "}
            {money(
              confirm.payment - cartSubtotal(confirm.items) + confirm.discount,
            )}
          </p>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button disabled={busy} onClick={() => setConfirm(null)}>
              Back to basket
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                let id = "";
                const ok = await act(async () => {
                  id = await repo.checkout(confirm);
                }, "Sale completed. Inventory updated.");
                if (ok) {
                  setConfirm(null);
                  setCart([]);
                  setPayment("");
                  setDiscount("0");
                  setReceiptId(id);
                }
              }}
            >
              {busy ? "Completing…" : "Complete transaction"}
            </button>
          </div>
        </Modal>
      )}
      {receipt && (
        <Receipt
          sale={receipt}
          demo={repo.mode === "demo"}
          onClose={() => setReceiptId("")}
        />
      )}
    </>
  );
}
function ArrowLabel() {
  return <span aria-hidden="true">→</span>;
}
