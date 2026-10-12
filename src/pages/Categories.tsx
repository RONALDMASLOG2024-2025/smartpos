import { useState } from "react";
import { Plus } from "lucide-react";
import { Empty, Modal, PageHead, Table } from "../components/ui";
import type { Category } from "../domain/types";
import { useWorkspace } from "../context";
export function Categories() {
  const { repo, data, act, busy, error } = useWorkspace();
  const [edit, setEdit] = useState<Category | null | undefined>();
  return (
    <>
      <PageHead
        title="Categories"
        description="Keep your catalogue easy to browse at the counter."
        action={
          <button className="primary" onClick={() => setEdit(null)}>
            <Plus size={16} />
            Add category
          </button>
        }
      />
      <section className="panel">
        {data.categories.length ? (
          <Table headers={["Category", "Products", "Actions"]}>
            {data.categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  {data.products.filter((p) => p.category_id === c.id).length}
                </td>
                <td>
                  <button className="small-button" onClick={() => setEdit(c)}>
                    Edit {c.name}
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="No categories yet">
            Add a category to organize your products.
          </Empty>
        )}
      </section>
      {edit !== undefined && (
        <Modal
          title={edit ? "Edit category" : "Add category"}
          onClose={() => !busy && setEdit(undefined)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const name = String(
                new FormData(e.currentTarget).get("name"),
              ).trim();
              if (
                await act(
                  () => repo.saveCategory(edit?.id ?? null, name),
                  "Category saved.",
                )
              )
                setEdit(undefined);
            }}
          >
            <label>
              Category name
              <input
                name="name"
                required
                maxLength={80}
                defaultValue={edit?.name ?? ""}
              />
            </label>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button type="button" onClick={() => setEdit(undefined)}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                Save category
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
