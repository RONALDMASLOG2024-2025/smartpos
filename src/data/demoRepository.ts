import type {
  Account,
  CheckoutInput,
  ForecastResult,
  ImportRow,
  HistoryRow,
  HistoryImportResult,
  ProductInput,
  Repository,
  Sale,
  Snapshot,
} from "../domain/types";
import {
  validateCheckout,
  validateImage,
  validateProduct,
} from "../domain/rules";
import { parseHistory } from "../lib/historyCsv";
import { exportCSV } from "../lib/csv";
export const DEMO_STORE = "00000000-0000-4000-8000-000000000001";
export const DEMO_MANAGER: Account = {
  id: "00000000-0000-4000-8000-000000000002",
  store_id: DEMO_STORE,
  user_id: null,
  email: "manager@example.test",
  name: "Alex Reyes",
  role: "manager",
  active: true,
  created_at: new Date().toISOString(),
};
export const DEMO_CASHIER: Account = {
  ...DEMO_MANAGER,
  id: "00000000-0000-4000-8000-000000000003",
  email: "cashier@example.test",
  name: "Sam Cruz",
  role: "cashier",
};
const KEY = "smartpos-demo-v2";
interface DemoState extends Snapshot {
  requests: Record<string, { payload: string; id: string; cashier: string }>;
  forecasts: ForecastResult[];
}
export interface Persistence {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function seedDemo(): DemoState {
  const now = new Date().toISOString();
  const categories = ["Beverages", "Bakery", "Snacks", "Essentials"].map(
    (name, i) => ({ id: `category-${i}`, store_id: DEMO_STORE, name }),
  );
  const raw: [string, string, number, number, number][] = [
    ["COLA-330", "Cola · 330 ml", 2500, 48, 0],
    ["WATER-500", "Mineral water · 500 ml", 1500, 60, 0],
    ["COFFEE", "Coffee sachet", 1200, 7, 0],
    ["BREAD", "White bread", 3500, 24, 1],
    ["PANDESAL", "Pandesal · 6 pack", 3000, 18, 1],
    ["COOKIES", "Chocolate cookies", 1800, 35, 2],
    ["CHIPS", "Potato chips", 2200, 4, 2],
    ["NOODLES", "Instant noodles", 1600, 0, 3],
    ["MILK-1L", "Fresh milk · 1 litre", 9200, 14, 0],
    ["SOAP", "Bath soap", 2800, 25, 3],
    ["RICE-1KG", "Rice · 1 kg", 5500, 42, 3],
    ["CRACKERS", "Rice crackers", 2000, 22, 2],
  ];
  const products = raw.map(([sku, name, price_cents, stock, cat], i) => ({
    id: `product-${i}`,
    store_id: DEMO_STORE,
    sku,
    name,
    category_id: categories[cat].id,
    description: "",
    price_cents,
    cost_cents: Math.round(price_cents * 0.65),
    stock,
    low_stock_threshold: 10,
    status: "active" as const,
    image_path: null,
    created_at: now,
    updated_at: now,
  }));
  const sales: Sale[] = [];
  for (let day = 13; day >= 0; day--) {
    const time = new Date();
    time.setDate(time.getDate() - day);
    time.setHours(10, 30, 0, 0);
    for (let n = 0; n < 3; n++) {
      const id = `d${String(day).padStart(4, "0")}${String(n).padStart(3, "0")}-0000-4000-8000-000000000000`;
      const p = products[(day + n) % products.length];
      const q = n + 1;
      const sub = p.price_cents * q;
      sales.push({
        id,
        store_id: DEMO_STORE,
        cashier_id: DEMO_CASHIER.id,
        cashier_name: DEMO_CASHIER.name,
        store_name: "Reyes Corner Store",
        receipt_note: "Thank you for shopping with us!",
        request_id: id,
        subtotal_cents: sub,
        discount_cents: 0,
        total_cents: sub,
        payment_cents: sub + 5000,
        change_cents: 5000,
        method: "cash",
        created_at: time.toISOString(),
        items: [
          {
            id: `item-${id}`,
            transaction_id: id,
            store_id: DEMO_STORE,
            product_id: p.id,
            sku: p.sku,
            product_name: p.name,
            quantity: q,
            unit_price_cents: p.price_cents,
            line_total_cents: sub,
          },
        ],
      });
    }
  }
  return {
    store: {
      id: DEMO_STORE,
      name: "Reyes Corner Store",
      currency: "PHP",
      timezone: "Asia/Manila",
      receipt_note: "Thank you for shopping with us!",
    },
    products,
    categories,
    sales,
    accounts: [DEMO_MANAGER, DEMO_CASHIER],
    movements: [],
    imports: [],
    history: [],
    requests: {},
    forecasts: [],
  };
}
export class DemoRepository implements Repository {
  mode = "demo" as const;
  private state: DemoState;
  constructor(
    public account: Account,
    private persistence: Persistence,
  ) {
    const saved = persistence.getItem(KEY);
    this.state = saved ? JSON.parse(saved) : seedDemo();
  }
  private read() {
    const saved = this.persistence.getItem(KEY);
    if (saved) this.state = JSON.parse(saved);
    this.state.history ??= [];
    return this.state;
  }
  private guard(manager = false) {
    const a = this.read().accounts.find((a) => a.id === this.account.id);
    if (
      !a?.active ||
      a.store_id !== this.account.store_id ||
      (manager && a.role !== "manager")
    )
      throw new Error("Access denied.");
  }
  private mutate<T>(fn: (draft: DemoState) => T, manager = false): T {
    this.guard(manager);
    const draft = structuredClone(this.state);
    const result = fn(draft);
    this.persistence.setItem(KEY, JSON.stringify(draft));
    this.state = draft;
    return result;
  }
  async load(): Promise<Snapshot> {
    this.guard();
    const s = structuredClone(this.state);
    if (this.account.role === "cashier") {
      s.products = s.products
        .filter((p) => p.status === "active")
        .map((p) => {
          const { cost_cents: _cost, ...safe } = p;
          void _cost;
          return safe;
        });
      s.sales = s.sales.filter((t) => t.cashier_id === this.account.id);
      s.accounts = s.accounts.filter((a) => a.id === this.account.id);
      s.movements = [];
      s.imports = [];
      s.history = [];
    }
    s.products.forEach((p) => {
      if (p.image_path?.startsWith("data:")) p.image_url = p.image_path;
    });
    return s;
  }
  async saveProduct(input: ProductInput, expectedStock: number | null) {
    validateProduct(input);
    this.mutate((s) => this.applyProduct(s, input, expectedStock), true);
  }
  private applyProduct(
    s: DemoState,
    input: ProductInput,
    expectedStock: number | null,
  ) {
    const previous = s.products.find((p) => p.id === input.id);
    if (input.id && !previous) throw new Error("Product not found.");
    if (previous && previous.stock !== expectedStock)
      throw new Error("Stock changed. Refresh before saving.");
    if (s.products.some((p) => p.sku === input.sku && p.id !== input.id))
      throw new Error("SKU already exists.");
    if (
      input.category_id &&
      !s.categories.some((c) => c.id === input.category_id)
    )
      throw new Error("Invalid category.");
    const product = {
      ...input,
      id: previous?.id ?? crypto.randomUUID(),
      store_id: this.account.store_id,
      created_at: previous?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (previous)
      s.products = s.products.map((p) => (p.id === previous.id ? product : p));
    else s.products.push(product);
    if (product.stock !== (previous?.stock ?? 0))
      s.movements.push({
        id: crypto.randomUUID(),
        store_id: this.account.store_id,
        product_id: product.id,
        actor_id: this.account.id,
        delta: product.stock - (previous?.stock ?? 0),
        balance: product.stock,
        reason: previous ? "Manager adjustment" : "Opening stock",
        created_at: new Date().toISOString(),
      });
  }
  async adjustStock(
    id: string,
    stock: number,
    expected: number,
    reason: string,
  ) {
    this.mutate((s) => {
      const p = s.products.find((p) => p.id === id);
      if (!p || p.stock !== expected)
        throw new Error("Stock changed. Refresh.");
      if (
        !Number.isInteger(stock) ||
        stock < 0 ||
        stock > 1000000 ||
        !reason.trim()
      )
        throw new Error("Invalid stock or reason.");
      s.movements.push({
        id: crypto.randomUUID(),
        store_id: this.account.store_id,
        product_id: id,
        actor_id: this.account.id,
        delta: stock - p.stock,
        balance: stock,
        reason,
        created_at: new Date().toISOString(),
      });
      p.stock = stock;
    }, true);
  }
  async saveCategory(id: string | null, name: string) {
    this.mutate((s) => {
      if (!name.trim() || name.length > 80)
        throw new Error("Category must be 1–80 characters.");
      if (s.categories.some((c) => c.name === name && c.id !== id))
        throw new Error("Category already exists.");
      if (id) {
        const c = s.categories.find((c) => c.id === id);
        if (!c) throw new Error("Category not found.");
        c.name = name;
      } else
        s.categories.push({
          id: crypto.randomUUID(),
          store_id: this.account.store_id,
          name,
        });
    }, true);
  }
  async manageCashier(email: string, name: string, active: boolean) {
    this.mutate((s) => {
      email = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name.trim())
        throw new Error("Valid email and name are required.");
      const a = s.accounts.find((a) => a.email === email);
      if (a?.role === "manager") throw new Error("Cannot modify a Manager.");
      if (a) {
        a.name = name;
        a.active = active;
      } else
        s.accounts.push({
          ...DEMO_CASHIER,
          id: crypto.randomUUID(),
          email,
          name,
          active,
          created_at: new Date().toISOString(),
        });
    }, true);
  }
  async checkout(input: CheckoutInput) {
    return this.mutate((s) => {
      const replay = s.requests[input.request_id];
      const payload = JSON.stringify(input);
      if (replay) {
        if (replay.payload !== payload || replay.cashier !== this.account.id)
          throw new Error("Request ID already used.");
        return replay.id;
      }
      const sub = validateCheckout(input, s.products, this.account.role);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const sale: Sale = {
        id,
        store_id: this.account.store_id,
        cashier_id: this.account.id,
        cashier_name: this.account.name,
        store_name: s.store.name,
        receipt_note: s.store.receipt_note,
        request_id: input.request_id,
        subtotal_cents: sub,
        discount_cents: input.discount,
        total_cents: sub - input.discount,
        payment_cents: input.payment,
        change_cents: input.payment - sub + input.discount,
        method: input.method,
        created_at: now,
        items: [],
      };
      for (const item of input.items) {
        const p = s.products.find((p) => p.id === item.product_id)!;
        p.stock -= item.quantity;
        sale.items.push({
          id: crypto.randomUUID(),
          transaction_id: id,
          store_id: this.account.store_id,
          product_id: p.id,
          sku: p.sku,
          product_name: p.name,
          quantity: item.quantity,
          unit_price_cents: p.price_cents,
          line_total_cents: item.quantity * p.price_cents,
        });
        s.movements.push({
          id: crypto.randomUUID(),
          store_id: this.account.store_id,
          product_id: p.id,
          actor_id: this.account.id,
          delta: -item.quantity,
          balance: p.stock,
          reason: "Sale",
          created_at: now,
        });
      }
      s.sales.push(sale);
      s.requests[input.request_id] = { payload, id, cashier: this.account.id };
      return id;
    });
  }
  async importProducts(rows: ImportRow[], filename: string) {
    return this.mutate((s) => {
      if (
        !rows.length ||
        rows.length > 2000 ||
        new Set(rows.map((r) => r.sku)).size !== rows.length
      )
        throw new Error("Invalid or duplicate import rows.");
      for (const row of rows) {
        const old = s.products.find((p) => p.sku === row.sku);
        if ((old?.stock ?? null) !== row.expected_stock)
          throw new Error("Stock changed since preview.");
        let cat = s.categories.find((c) => c.name === row.category);
        if (!cat && row.category) {
          cat = {
            id: crypto.randomUUID(),
            store_id: this.account.store_id,
            name: row.category,
          };
          s.categories.push(cat);
        }
        const input = {
          ...row,
          id: old?.id,
          category_id: cat?.id ?? null,
          image_path: old?.image_path ?? null,
        };
        validateProduct(input);
        this.applyProduct(s, input, row.expected_stock);
      }
      s.imports.push({
        id: crypto.randomUUID(),
        filename,
        row_count: rows.length,
        result: "completed",
        created_at: new Date().toISOString(),
      });
      return rows.length;
    }, true);
  }
  async uploadImage(file: File): Promise<string> {
    this.guard(true);
    validateImage(file);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Image upload failed."));
      reader.readAsDataURL(file);
    });
  }
  async importHistory(
    rows: HistoryRow[],
    filename: string,
  ): Promise<HistoryImportResult> {
    return this.mutate((s) => {
      const csv = exportCSV(
        rows.map((row) => ({
          Receipt: row.receipt,
          Timestamp: row.sold_at,
          SKU: row.sku,
          Quantity: row.quantity,
          "Unit Price": (row.unit_price_cents / 100).toFixed(2),
          Source: row.source,
        })),
      );
      const preview = parseHistory(csv, s.products, s.history);
      if (preview.errors.length) throw new Error(preview.errors[0].message);
      if (
        rows.some((row) =>
          s.sales.some(
            (sale) =>
              sale.id === row.receipt || sale.request_id === row.receipt,
          ),
        )
      )
        throw new Error("A receipt already exists as a live checkout.");
      const added = rows.filter(
        (row) =>
          !s.history.some(
            (old) => old.receipt === row.receipt && old.sku === row.sku,
          ),
      );
      for (const row of added) {
        const p = s.products.find((p) => p.sku === row.sku)!;
        s.history.push({
          ...row,
          id: crypto.randomUUID(),
          store_id: this.account.store_id,
          product_id: p.id,
          product_name: p.name,
          line_total_cents: row.quantity * row.unit_price_cents,
        });
      }
      if (added.length)
        s.imports.push({
          id: crypto.randomUUID(),
          filename,
          row_count: added.length,
          result: `history - ${rows[0].source}`,
          created_at: new Date().toISOString(),
        });
      return {
        added: added.length,
        skipped: rows.length - added.length,
        receipts: new Set(added.map((row) => row.receipt)).size,
      };
    }, true);
  }
  async removeSyntheticHistory(): Promise<number> {
    return this.mutate((s) => {
      const removed = s.history.filter(
        (row) => row.source === "synthetic",
      ).length;
      s.history = s.history.filter((row) => row.source !== "synthetic");
      return removed;
    }, true);
  }
  async removeImage(_path: string) {
    this.guard(true);
    void _path;
  }
  async saveSettings(name: string, note: string) {
    this.mutate((s) => {
      if (!name.trim() || name.length > 100 || note.length > 500)
        throw new Error("Invalid store name or receipt note.");
      s.store.name = name;
      s.store.receipt_note = note;
    }, true);
  }
  async saveForecast(result: ForecastResult) {
    this.mutate((s) => s.forecasts.push(result), true);
  }
}
