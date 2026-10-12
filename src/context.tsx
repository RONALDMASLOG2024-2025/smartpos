import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase, demoEnabled } from "./lib/supabase";
import {
  DemoRepository,
  DEMO_CASHIER,
  DEMO_MANAGER,
} from "./data/demoRepository";
import { SupabaseRepository } from "./data/supabaseRepository";
import type { Account, Repository, Role, Snapshot } from "./domain/types";
interface AppContext {
  repo: Repository | null;
  data: Snapshot | null;
  loading: boolean;
  busy: boolean;
  error: string;
  notice: string;
  login: (role: Role) => Promise<void>;
  demoLogin: (role: Role) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  act: (fn: () => Promise<unknown>, message: string) => Promise<boolean>;
  clearError: () => void;
}
const Context = createContext<AppContext | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() =>
    (new URLSearchParams(location.search).get("error_description") ?? "").slice(
      0,
      500,
    ),
  );
  const [notice, setNotice] = useState("");
  const running = useRef(false);
  useEffect(() => {
    let alive = true;
    let generation = 0;
    async function authenticate() {
      const seq = ++generation;
      try {
        if (supabase) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (data.session) {
            const requestedRole = sessionStorage.getItem("smartpos-login-role");
            const result = await supabase.rpc(
              "claim_account",
              requestedRole === "manager" || requestedRole === "cashier"
                ? { p_role: requestedRole }
                : {},
            );
            if (result.error) throw result.error;
            if (alive && seq === generation) {
              sessionStorage.removeItem("smartpos-login-role");
              setError("");
              setRepo(new SupabaseRepository(supabase, result.data as Account));
            }
          } else if (alive && seq === generation) {
            setRepo(null);
            setData(null);
          }
        } else if (demoEnabled) {
          const role = sessionStorage.getItem("smartpos-demo-role");
          if (role === "manager" || role === "cashier")
            setRepo(
              new DemoRepository(
                role === "manager" ? DEMO_MANAGER : DEMO_CASHIER,
                localStorage,
              ),
            );
        }
      } catch (e) {
        if (alive && seq === generation) {
          setError((e as Error).message);
          setRepo(null);
          setData(null);
        }
      } finally {
        if (alive && seq === generation) setLoading(false);
      }
    }
    void authenticate();
    const listener = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT")
        setTimeout(() => {
          if (alive) void authenticate();
        }, 0);
    });
    return () => {
      alive = false;
      listener?.data.subscription.unsubscribe();
    };
  }, []);
  const refresh = useCallback(async () => {
    if (repo) {
      const result = await repo.load();
      setData(result);
    }
  }, [repo]);
  useEffect(() => {
    let alive = true;
    if (repo) {
      setLoading(true);
      repo
        .load()
        .then((d) => {
          if (alive) setData(d);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }
    return () => {
      alive = false;
    };
  }, [repo]);
  async function login(role: Role) {
    setError("");
    if (!supabase) {
      setError(
        "Google sign-in will be available when this workspace is connected.",
      );
      return;
    }
    try {
      sessionStorage.setItem("smartpos-login-role", role);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (e) {
      sessionStorage.removeItem("smartpos-login-role");
      setError((e as Error).message);
    }
  }
  function demoLogin(role: Role) {
    if (!demoEnabled) return;
    sessionStorage.setItem("smartpos-demo-role", role);
    setError("");
    setRepo(
      new DemoRepository(
        role === "manager" ? DEMO_MANAGER : DEMO_CASHIER,
        localStorage,
      ),
    );
  }
  async function logout() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setError(error.message);
        return;
      }
    }
    sessionStorage.removeItem("smartpos-demo-role");
    sessionStorage.removeItem("smartpos-login-role");
    setRepo(null);
    setData(null);
    setError("");
    setNotice("");
  }
  async function act(fn: () => Promise<unknown>, message: string) {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(message);
      try {
        await refresh();
      } catch (e) {
        setError(
          `Saved, but refresh failed: ${(e as Error).message}. Use Refresh to reload.`,
        );
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <Context.Provider
      value={{
        repo,
        data,
        loading,
        busy,
        error,
        notice,
        login,
        demoLogin,
        logout,
        refresh,
        act,
        clearError: () => setError(""),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const c = useContext(Context);
  if (!c) throw new Error("Missing app context");
  return c;
}
export function useWorkspace() {
  const c = useApp();
  if (!c.repo || !c.data) throw new Error("Workspace unavailable");
  return { ...c, repo: c.repo, data: c.data };
}
