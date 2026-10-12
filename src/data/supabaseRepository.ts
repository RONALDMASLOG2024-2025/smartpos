import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Account,
  Category,
  CheckoutInput,
  ForecastResult,
  ImportRow,
  Product,
  ProductInput,
  Repository,
  Sale,
  SaleItem,
  Snapshot,
} from "../domain/types";
import { validateImage, validateProduct } from "../domain/rules";
function unwrap<T>(result: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("No data returned.");
  return result.data;
}
export class SupabaseRepository implements Repository {
  mode = "supabase" as const;
  constructor(
    private client: SupabaseClient,
    public account: Account,
  ) {}
  private manager() {
    if (this.account.role !== "manager")
      throw new Error("Manager permission required.");
  }
  async load(): Promise<Snapshot> {
    const c = this.client;
    const manager = this.account.role === "manager";
    const [store, products, categories, sales, accounts, movements, imports] =
      await Promise.all([
        c.from("stores").select("*").eq("id", this.account.store_id).single(),
        manager
          ? this.allRows<Product>("products")
          : this.allRows<Product>("catalogue", true),
        this.allRows<Category>("categories"),
        this.allRows("transactions"),
        this.allRows<Account>("accounts"),
        manager
          ? this.allRows("stock_movements")
          : Promise.resolve({ data: [], error: null }),
        manager
          ? this.allRows<Snapshot["imports"][number]>("import_runs")
          : Promise.resolve({ data: [], error: null }),
      ]);
    const itemResult = await this.allRows("transaction_items");
    const items = unwrap(itemResult) as unknown as SaleItem[];
    const catalogue = unwrap(products) as Product[];
    const imagePaths = catalogue.flatMap((p) =>
      p.image_path ? [p.image_path] : [],
    );
    const urls = new Map<string, string>();
    for (let offset = 0; offset < imagePaths.length; offset += 200) {
      const signed = await c.storage
        .from("product-images")
        .createSignedUrls(imagePaths.slice(offset, offset + 200), 3600);
      if (!signed.error)
        signed.data.forEach((image) => {
          if (image.path && image.signedUrl)
            urls.set(image.path, image.signedUrl);
        });
    }
    catalogue.forEach((p) => {
      if (p.image_path) p.image_url = urls.get(p.image_path);
    });
    return {
      store: unwrap(store),
      products: catalogue,
      categories: unwrap(categories),
      sales: (unwrap(sales) as unknown as Sale[]).map((s) => ({
        ...s,
        items: items.filter((i) => i.transaction_id === s.id),
      })),
      accounts: unwrap(accounts),
      movements: unwrap(movements) as unknown as Snapshot["movements"],
      imports: unwrap(imports),
    };
  }
  private async allRows<T = Record<string, unknown>>(
    table: string,
    rpc = false,
  ) {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 1000) {
      const query = rpc
        ? this.client.rpc(table)
        : this.client.from(table).select("*");
      const result = await query.order("id").range(offset, offset + 999);
      if (result.error) throw new Error(result.error.message);
      rows.push(...(result.data as unknown as T[]));
      if (result.data.length < 1000) break;
    }
    return { data: rows, error: null };
  }
  async saveProduct(input: ProductInput, expectedStock: number | null) {
    this.manager();
    validateProduct(input);
    unwrap(
      await this.client.rpc("save_product", {
        p_data: input,
        p_expected_stock: expectedStock,
      }),
    );
  }
  async adjustStock(
    id: string,
    stock: number,
    expected: number,
    reason: string,
  ) {
    this.manager();
    const { error } = await this.client.rpc("adjust_stock", {
      p_id: id,
      p_stock: stock,
      p_expected: expected,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
  }
  async saveCategory(id: string | null, name: string) {
    this.manager();
    const result = id
      ? await this.client
          .from("categories")
          .update({ name })
          .eq("id", id)
          .select("id")
          .single()
      : await this.client
          .from("categories")
          .insert({ store_id: this.account.store_id, name });
    if (result.error) throw new Error(result.error.message);
  }
  async manageCashier(email: string, name: string, active: boolean) {
    this.manager();
    const { error } = await this.client.rpc("manage_cashier", {
      p_email: email,
      p_name: name,
      p_active: active,
    });
    if (error) throw new Error(error.message);
  }
  async checkout(input: CheckoutInput) {
    return unwrap(
      await this.client.rpc("checkout", {
        p_request_id: input.request_id,
        p_items: input.items,
        p_payment: input.payment,
        p_method: input.method,
        p_discount: input.discount,
      }),
    ) as string;
  }
  async importProducts(rows: ImportRow[], filename: string) {
    this.manager();
    return unwrap(
      await this.client.rpc("import_products", {
        p_rows: rows,
        p_filename: filename,
      }),
    ) as number;
  }
  async uploadImage(file: File) {
    this.manager();
    validateImage(file);
    const extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[file.type];
    const path = `${this.account.store_id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await this.client.storage
      .from("product-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    return path;
  }
  async removeImage(path: string) {
    this.manager();
    const { error } = await this.client.storage
      .from("product-images")
      .remove([path]);
    if (error) throw new Error(error.message);
  }
  async saveSettings(name: string, note: string) {
    this.manager();
    const { error } = await this.client
      .from("stores")
      .update({ name, receipt_note: note })
      .eq("id", this.account.store_id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
  }
  async saveForecast(result: ForecastResult) {
    this.manager();
    const { error } = await this.client.from("forecast_runs").insert({
      store_id: this.account.store_id,
      source: result.source,
      model_version: result.model_version,
      results: result,
    });
    if (error) throw new Error(error.message);
  }
}
