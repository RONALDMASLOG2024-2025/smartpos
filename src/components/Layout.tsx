import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Layers,
  Boxes,
  ReceiptText,
  ChartNoAxesCombined,
  TrendingUp,
  Users,
  ArrowDownUp,
  Settings,
  UserRound,
  LogOut,
  Menu,
  RefreshCw,
  X,
} from "lucide-react";
import { useWorkspace } from "../context";
import { Brand } from "./ui";
import { canAccess } from "../domain/rules";
const nav = [
  ["dashboard", "Overview", LayoutDashboard],
  ["pos", "Point of sale", ShoppingBag],
  ["products", "Products", Package],
  ["categories", "Categories", Layers],
  ["inventory", "Inventory", Boxes],
  ["transactions", "Transactions", ReceiptText],
  ["reports", "Sales reports", ChartNoAxesCombined],
  ["forecasting", "Forecasting", TrendingUp],
  ["cashiers", "Cashiers", Users],
  ["data", "Import & export", ArrowDownUp],
  ["settings", "Settings", Settings],
  ["profile", "My profile", UserRound],
] as const;
export function Layout() {
  const { repo, data, busy, error, notice, logout, refresh, clearError } =
    useWorkspace();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(
    () => matchMedia("(max-width:960px)").matches,
  );
  const closeButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    const media = matchMedia("(max-width:960px)");
    const change = () => setMobile(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (mobile && open) closeButton.current?.focus();
    else if (mobile && wasOpen.current) menuButton.current?.focus();
    wasOpen.current = open;
    if (!mobile || !open) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [mobile, open]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  return (
    <div className="app-shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      {mobile && open && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${open ? "open" : ""}`}
        inert={mobile && !open}
        aria-hidden={mobile && !open}
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            ref={closeButton}
            className="mobile-only icon-button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">
          {data.store.name}
          <span>{repo.account.role} workspace</span>
        </div>
        <nav aria-label="Workspace navigation">
          {nav
            .filter(([path]) => canAccess(repo.account.role, path))
            .map(([path, label, Icon]) => (
              <NavLink
                key={path}
                to={`/app/${path}`}
                end
                onClick={() => setOpen(false)}
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-profile">
          <div className="avatar">{repo.account.name[0]}</div>
          <div>
            <b>{repo.account.name}</b>
            <span>{repo.account.role}</span>
          </div>
          <button
            aria-label="Log out"
            className="icon-button"
            onClick={() => void logout()}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace" inert={mobile && open}>
        <header className="topbar">
          <div>
            <button
              ref={menuButton}
              className="mobile-only icon-button"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <span>{data.store.name}</span>
          </div>
          <div>
            <span
              className={`connection ${repo.mode === "demo" ? "demo" : ""}`}
            >
              {repo.mode === "demo" ? "Demo workspace" : "Connected workspace"}
            </span>
            <button
              className="icon-button"
              aria-label="Refresh workspace"
              disabled={busy || refreshing}
              onClick={async () => {
                setRefreshing(true);
                setRefreshError("");
                try {
                  await refresh();
                } catch (e) {
                  setRefreshError((e as Error).message);
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              <RefreshCw size={17} className={refreshing ? "spin" : ""} />
            </button>
          </div>
        </header>
        {repo.mode === "demo" && (
          <div className="demo-banner">
            Sample accounts and sales · Changes stay in this browser · No real
            payments
          </div>
        )}
        <main id="main" className="main-content">
          {(error || refreshError) && (
            <div className="alert error" role="alert">
              {error || refreshError}
              <button
                aria-label="Dismiss error"
                className="icon-button"
                onClick={() => {
                  clearError();
                  setRefreshError("");
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {notice}
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
