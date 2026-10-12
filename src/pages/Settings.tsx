import { PageHead } from "../components/ui";
import { useWorkspace } from "../context";
export function Settings() {
  const { repo, data, busy, act } = useWorkspace();
  return (
    <>
      <PageHead
        title="Store settings"
        description="Business details used on new receipts."
      />
      <section className="panel settings-panel">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await act(
              () =>
                repo.saveSettings(
                  String(f.get("name")).trim(),
                  String(f.get("note")).trim(),
                ),
              "Store settings saved.",
            );
          }}
        >
          <label>
            Store name
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={data.store.name}
            />
          </label>
          <label>
            Receipt message
            <textarea
              name="note"
              maxLength={500}
              defaultValue={data.store.receipt_note}
            />
          </label>
          <div className="form-grid">
            <label>
              Currency
              <input readOnly value="Philippine peso (PHP)" />
            </label>
            <label>
              Store timezone
              <input readOnly value="Asia/Manila" />
            </label>
          </div>
          <p className="muted small">
            Completed receipts retain the store name and message from the time
            of sale.
          </p>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </button>
        </form>
      </section>
    </>
  );
}
