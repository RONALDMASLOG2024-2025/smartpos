export type Role = "manager" | "cashier";
export interface Account {
  id: string;
  store_id: string;
  user_id: string | null;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  created_at: string;
}
export interface Store {
  id: string;
  name: string;
  currency: "PHP";
  timezone: "Asia/Manila";
  receipt_note: string;
}
export interface Category {
  id: string;
  store_id: string;
  name: string;
}
export interface Product {
  id: string;
  store_id: string;
  sku: string;
  name: string;
  category_id: string | null;
  description: string;
  price_cents: number;
  cost_cents?: number;
  stock: number;
  low_stock_threshold: number;
  status: "active" | "archived";
  image_path: string | null;
  image_url?: string;
  created_at: string;
  updated_at: string;
}
export type ProductInput = Omit<
  Product,
  "id" | "store_id" | "created_at" | "updated_at" | "image_url"
> & { id?: string };
export interface CartItem {
  product_id: string;
  quantity: number;
  expected_price_cents: number;
}
export type PaymentMethod = "cash" | "card" | "ewallet";
export interface CheckoutInput {
  request_id: string;
  items: CartItem[];
  payment: number;
  method: PaymentMethod;
  discount: number;
}
export interface SaleItem {
  id: string;
  transaction_id: string;
  store_id: string;
  product_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}
export interface Sale {
  id: string;
  store_id: string;
  cashier_id: string;
  cashier_name: string;
  store_name: string;
  receipt_note: string;
  request_id: string;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  payment_cents: number;
  change_cents: number;
  method: PaymentMethod;
  created_at: string;
  items: SaleItem[];
}
export interface Movement {
  id: string;
  store_id: string;
  product_id: string;
  actor_id: string;
  delta: number;
  balance: number;
  reason: string;
  created_at: string;
}
export interface ImportRow {
  sku: string;
  name: string;
  category: string;
  description: string;
  price_cents: number;
  cost_cents: number;
  stock: number;
  low_stock_threshold: number;
  status: "active" | "archived";
  expected_stock: number | null;
}
export interface ImportRun {
  id: string;
  filename: string;
  row_count: number;
  created_at: string;
  result: string;
}
export interface Forecast {
  product_id: string;
  name: string;
  predicted_units: number;
  stock: number;
  restock_units: number;
}
export interface ForecastResult {
  source: "synthetic" | "real" | "insufficient";
  model_version: string;
  training_days: number;
  horizon_days: number;
  validation_mae: number | null;
  results: Forecast[];
}
export interface Snapshot {
  store: Store;
  products: Product[];
  categories: Category[];
  sales: Sale[];
  accounts: Account[];
  movements: Movement[];
  imports: ImportRun[];
}
export interface Repository {
  mode: "demo" | "supabase";
  account: Account;
  load(): Promise<Snapshot>;
  saveProduct(input: ProductInput, expectedStock: number | null): Promise<void>;
  adjustStock(
    id: string,
    stock: number,
    expected: number,
    reason: string,
  ): Promise<void>;
  saveCategory(id: string | null, name: string): Promise<void>;
  manageCashier(email: string, name: string, active: boolean): Promise<void>;
  checkout(input: CheckoutInput): Promise<string>;
  importProducts(rows: ImportRow[], filename: string): Promise<number>;
  uploadImage(file: File): Promise<string>;
  removeImage(path: string): Promise<void>;
  saveSettings(name: string, note: string): Promise<void>;
  saveForecast(result: ForecastResult): Promise<void>;
}
