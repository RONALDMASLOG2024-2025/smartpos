import { Badge, PageHead } from "../components/ui";
import { useWorkspace } from "../context";
export function Profile() {
  const { repo, logout } = useWorkspace();
  return (
    <>
      <PageHead
        title="My profile"
        description="Your workspace account and access."
      />
      <section className="panel settings-panel">
        <dl>
          <dt>Name</dt>
          <dd>{repo.account.name}</dd>
          <dt>Google email</dt>
          <dd>{repo.account.email}</dd>
          <dt>Role</dt>
          <dd>
            <Badge tone="good">{repo.account.role}</Badge>
          </dd>
          <dt>Workspace</dt>
          <dd>
            {repo.mode === "demo"
              ? "Isolated local demo"
              : "Supabase connected"}
          </dd>
        </dl>
        <button onClick={() => void logout()}>Log out</button>
      </section>
    </>
  );
}
