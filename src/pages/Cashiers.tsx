import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Empty, Modal, PageHead, Table } from "../components/ui";
import type { Account } from "../domain/types";
import { useWorkspace } from "../context";
export function Cashiers() {
  const { repo, data, busy, error, act } = useWorkspace();
  const [edit, setEdit] = useState<Account | null | undefined>();
  const [disable, setDisable] = useState<Account | null>(null);
  const cashiers = data.accounts.filter((a) => a.role === "cashier");
  return (
    <>
      <PageHead
        title="Cashiers"
        description="Authorize Google accounts to use your store’s checkout."
        action={
          <button className="primary" onClick={() => setEdit(null)}>
            <Plus size={16} />
            Add cashier
          </button>
        }
      />
      <section className="panel">
        {cashiers.length ? (
          <Table
            headers={[
              "Cashier",
              "Google email",
              "Status",
              "Account",
              "Actions",
            ]}
          >
            {cashiers.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.email}</td>
                <td>
                  <Badge tone={a.active ? "good" : "neutral"}>
                    {a.active ? "Authorized" : "Disabled"}
                  </Badge>
                </td>
                <td>{a.user_id ? "Linked" : "Awaiting Google login"}</td>
                <td>
                  <div className="actions">
                    <button className="small-button" onClick={() => setEdit(a)}>
                      Edit {a.name}
                    </button>
                    <button
                      className="small-button"
                      onClick={() => setDisable(a)}
                    >
                      {a.active ? "Disable" : "Enable"} {a.name}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="No cashiers yet">
            Add the Google email of your first Cashier.
          </Empty>
        )}
      </section>
      <p className="muted">
        Only the listed active accounts can join your workspace. Cashiers can
        complete sales and read their own receipts.
      </p>
      {edit !== undefined && (
        <Modal
          title={edit ? "Edit cashier" : "Add cashier"}
          onClose={() => !busy && setEdit(undefined)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await act(
                  () =>
                    repo.manageCashier(
                      String(f.get("email")),
                      String(f.get("name")),
                      edit?.active ?? true,
                    ),
                  "Cashier authorization saved.",
                )
              )
                setEdit(undefined);
            }}
          >
            <label>
              Cashier name
              <input
                required
                name="name"
                maxLength={100}
                defaultValue={edit?.name ?? ""}
              />
            </label>
            <label>
              Google account email
              <input
                required
                name="email"
                type="email"
                readOnly={!!edit}
                defaultValue={edit?.email ?? ""}
                placeholder="cashier@gmail.com"
              />
            </label>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button type="button" onClick={() => setEdit(undefined)}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                Authorize cashier
              </button>
            </div>
          </form>
        </Modal>
      )}
      {disable && (
        <Modal
          title={`${disable.active ? "Disable" : "Enable"} cashier`}
          onClose={() => !busy && setDisable(null)}
        >
          <p>
            {disable.active ? "Disable" : "Enable"} access for {disable.name} (
            {disable.email})?{" "}
            {disable.active && "Their historical sales will be preserved."}
          </p>
          {error && <p className="field-error">{error}</p>}
          <div className="form-actions">
            <button onClick={() => setDisable(null)}>Cancel</button>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                if (
                  await act(
                    () =>
                      repo.manageCashier(
                        disable.email,
                        disable.name,
                        !disable.active,
                      ),
                    "Cashier access updated.",
                  )
                )
                  setDisable(null);
              }}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
