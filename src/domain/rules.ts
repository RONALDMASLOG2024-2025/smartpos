import type {
  CartItem,
  CheckoutInput,
  Product,
  ProductInput,
  Role,
} from "./types";
export const managerRoutes = [
  "products",
  "categories",
  "inventory",
  "reports",
  "forecasting",
  "cashiers",
  "data",
  "settings",
];
export const canAccess = (role: Role, route: string) =>
  !managerRoutes.includes(route) || role === "manager";
export const money = (cents: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    cents / 100,
  );
export function cents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error(
      "Enter a non-negative amount with at most two decimal places.",
    );
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > 100000000000)
    throw new Error("Amount is too large.");
  return amount;
}
export function integer(value: string, label: string, max = 1000000): number {
  if (
    !/^\d+$/.test(value.trim()) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > max
  )
    throw new Error(`${label} must be a whole number between 0 and ${max}.`);
  return Number(value);
}
export function validateProduct(p: ProductInput): void {
  if (
    !p.sku.trim() ||
    p.sku.length > 64 ||
    p.sku !== p.sku.trim().toUpperCase()
  )
    throw new Error("SKU must be 1–64 uppercase characters.");
  if (!p.name.trim() || p.name.length > 120)
    throw new Error("Product name must be 1–120 characters.");
  if (p.description.length > 1000) throw new Error("Description is too long.");
  for (const field of [
    "price_cents",
    "cost_cents",
    "stock",
    "low_stock_threshold",
  ] as const) {
    const v = p[field];
    const max = field.includes("cents") ? 100000000 : 1000000;
    if (v === undefined || !Number.isInteger(v) || v < 0 || v > max)
      throw new Error(`Invalid ${field.replaceAll("_", " ")}.`);
  }
  if (!["active", "archived"].includes(p.status))
    throw new Error("Invalid status.");
}
export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity * i.expected_price_cents, 0);
}
export function validateCheckout(
  input: CheckoutInput,
  products: Product[],
  role: Role,
): number {
  if (!input.request_id || !input.items.length || input.items.length > 200)
    throw new Error("Cart must contain 1–200 products.");
  if (new Set(input.items.map((i) => i.product_id)).size !== input.items.length)
    throw new Error("Duplicate cart product.");
  for (const item of input.items) {
    const p = products.find((p) => p.id === item.product_id);
    if (
      !p ||
      p.status !== "active" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > p.stock
    )
      throw new Error("Product unavailable or insufficient stock.");
    if (item.expected_price_cents !== p.price_cents)
      throw new Error("Price changed. Refresh and review the cart.");
  }
  const sub = cartSubtotal(input.items);
  if (!Number.isSafeInteger(sub) || sub > 100000000000)
    throw new Error("Sale amount exceeds the supported limit.");
  if (
    !Number.isSafeInteger(input.discount) ||
    input.discount < 0 ||
    input.discount > sub ||
    (input.discount > 0 && role !== "manager")
  )
    throw new Error("Invalid discount or Manager permission required.");
  if (
    !["cash", "card", "ewallet"].includes(input.method) ||
    !Number.isSafeInteger(input.payment) ||
    input.payment < sub - input.discount ||
    input.payment > 100000000000
  )
    throw new Error("Invalid or insufficient payment.");
  if (input.method !== "cash" && input.payment !== sub - input.discount)
    throw new Error("Non-cash payment must equal total.");
  return sub;
}
export function validateImage(file: Pick<File, "type" | "size">): void {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG or WebP image.");
  if (!file.size || file.size > 5 * 1024 * 1024)
    throw new Error("Image must be between 1 byte and 5 MB.");
}
export const dayKey = (date: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
export const dateTime = (date: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
