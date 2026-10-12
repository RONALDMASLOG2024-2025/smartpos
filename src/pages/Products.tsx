import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useWorkspace } from "../context";
import {
  Badge,
  Empty,
  Modal,
  PageHead,
  ProductImage,
  Table,
} from "../components/ui";
import {
  cents,
  integer,
  money,
  validateImage,
  validateProduct,
} from "../domain/rules";
import type { Product, ProductInput } from "../domain/types";
export function Products() {
  const { data } = useWorkspace();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("active");
  const [editing, setEditing] = useState<Product | null | undefined>();
  const rows = data.products.filter(
    (p) =>
      (!status || p.status === status) &&
      (!category || p.category_id === category) &&
      `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Products"
        description="Your catalogue, prices, and product images."
        action={
          <button className="primary" onClick={() => setEditing(null)}>
            <Plus size={17} />
            Add product
          </button>
        }
      />
      <div className="toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search catalogue"
            value={search}
            placeholder="Search products or SKU…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter product status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="active">Active products</option>
          <option value="archived">Archived products</option>
          <option value="">All products</option>
        </select>
      </div>
      <section className="panel">
        {rows.length ? (
          <Table
            headers={[
              "Product",
              "SKU",
              "Category",
              "Price",
              "Cost",
              "Stock",
              "Status",
              "Actions",
            ]}
          >
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="table-product">
                    <ProductImage product={p} />
                    <b>{p.name}</b>
                  </div>
                </td>
                <td>{p.sku}</td>
                <td>
                  {data.categories.find((c) => c.id === p.category_id)?.name ??
                    "—"}
                </td>
                <td>{money(p.price_cents)}</td>
                <td>{money(p.cost_cents ?? 0)}</td>
                <td>
                  <Badge
                    tone={p.stock <= p.low_stock_threshold ? "warn" : "neutral"}
                  >
                    {p.stock}
                  </Badge>
                </td>
                <td>
                  <Badge tone={p.status === "active" ? "good" : "neutral"}>
                    {p.status}
                  </Badge>
                </td>
                <td>
                  <button
                    className="small-button"
                    onClick={() => setEditing(p)}
                    aria-label={`Edit ${p.name}`}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="No products here">
            Add a product or change your filters.
          </Empty>
        )}
      </section>
      <p className="muted small">
        {rows.length} products · Archive products to preserve their sales
        history.
      </p>
      {editing !== undefined && (
        <ProductEditor
          key={editing?.id ?? "new"}
          product={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
function ProductEditor({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const { repo, data, busy, act, error } = useWorkspace();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [localError, setLocalError] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <Modal
      title={product ? "Edit product" : "Add product"}
      onClose={() => !busy && onClose()}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setLocalError("");
          const values = new FormData(e.currentTarget);
          try {
            const v = (key: string) => String(values.get(key) ?? "").trim();
            const input: ProductInput = {
              id: product?.id,
              sku: v("sku").toUpperCase(),
              name: v("name"),
              category_id: v("category_id") || null,
              description: v("description"),
              price_cents: cents(v("price")),
              cost_cents: cents(v("cost")),
              stock: integer(v("stock"), "Stock"),
              low_stock_threshold: integer(v("threshold"), "Threshold"),
              status: v("status") as ProductInput["status"],
              image_path: product?.image_path ?? null,
            };
            validateProduct(input);
            let uploaded = "";
            const ok = await act(async () => {
              if (file) {
                validateImage(file);
                uploaded = await repo.uploadImage(file);
                input.image_path = uploaded;
              }
              try {
                await repo.saveProduct(input, product?.stock ?? null);
              } catch (err) {
                if (uploaded)
                  await repo.removeImage(uploaded).catch(() => undefined);
                throw err;
              }
            }, "Product saved.");
            if (ok) {
              if (uploaded && product?.image_path)
                void repo
                  .removeImage(product.image_path)
                  .catch(() => undefined);
              onClose();
            }
          } catch (err) {
            setLocalError((err as Error).message);
          }
        }}
      >
        <div className="form-grid">
          <label>
            SKU
            <input
              required
              name="sku"
              maxLength={64}
              defaultValue={product?.sku ?? ""}
              placeholder="e.g. COFFEE-001"
            />
          </label>
          <label>
            Product name
            <input
              required
              name="name"
              maxLength={120}
              defaultValue={product?.name ?? ""}
            />
          </label>
          <label>
            Category
            <select
              name="category_id"
              defaultValue={product?.category_id ?? ""}
            >
              <option value="">Uncategorized</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={product?.status ?? "active"}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            Price (₱)
            <input
              required
              name="price"
              inputMode="decimal"
              defaultValue={((product?.price_cents ?? 0) / 100).toFixed(2)}
            />
          </label>
          <label>
            Cost (₱)
            <input
              required
              name="cost"
              inputMode="decimal"
              defaultValue={((product?.cost_cents ?? 0) / 100).toFixed(2)}
            />
          </label>
          <label>
            Stock quantity
            <input
              required
              name="stock"
              type="number"
              min="0"
              max="1000000"
              step="1"
              defaultValue={product?.stock ?? 0}
            />
          </label>
          <label>
            Low-stock threshold
            <input
              required
              name="threshold"
              type="number"
              min="0"
              max="1000000"
              step="1"
              defaultValue={product?.low_stock_threshold ?? 10}
            />
          </label>
        </div>
        <label>
          Description
          <textarea
            name="description"
            maxLength={1000}
            defaultValue={product?.description ?? ""}
          />
        </label>
        <label>
          Product image · JPEG, PNG or WebP, max 5 MB
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const selected = e.target.files?.[0] ?? null;
              setLocalError("");
              if (selected) {
                try {
                  validateImage(selected);
                  const image = await createImageBitmap(selected);
                  image.close();
                  setFile(selected);
                } catch (err) {
                  setFile(null);
                  e.target.value = "";
                  setLocalError(
                    (err as Error).message || "Image could not be decoded.",
                  );
                }
              } else setFile(null);
            }}
          />
        </label>
        {(preview || product?.image_url) && (
          <img
            className="image-preview"
            src={preview || product?.image_url}
            alt="Product image preview"
          />
        )}
        {(localError || error) && (
          <p className="field-error" role="alert">
            {localError || error}
          </p>
        )}
        <p className="muted small">
          Stock changes are recorded. Archiving preserves completed receipts.
        </p>
        <div className="form-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
