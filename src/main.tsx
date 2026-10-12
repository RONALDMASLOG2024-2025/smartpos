import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { AppProvider, useApp } from "./context";
import { Landing } from "./pages/Landing";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { POS } from "./pages/POS";
import { Products } from "./pages/Products";
import { Inventory } from "./pages/Inventory";
import { Categories } from "./pages/Categories";
import { Cashiers } from "./pages/Cashiers";
import { Settings } from "./pages/Settings";
import { Profile } from "./pages/Profile";
import { Transactions, Reports } from "./pages/Reports";
import { DataPage } from "./pages/DataPage";
import { Forecasting } from "./pages/Forecasting";
import "./styles.css";
function Gate({ manager = false }: { manager?: boolean }) {
  const { repo, data, loading, error, refresh, logout } = useApp();
  if (loading)
    return (
      <div className="loading" role="status">
        Loading your workspace…
      </div>
    );
  if (!repo) return <Navigate to="/" replace />;
  if (!data)
    return (
      <div className="loading">
        <h2>Couldn’t load your workspace</h2>
        <p role="alert">{error}</p>
        <button onClick={() => void refresh().catch(() => undefined)}>
          Try again
        </button>
        <button onClick={() => void logout()}>Log out</button>
      </div>
    );
  if (manager && repo.account.role !== "manager")
    return (
      <div className="access-denied">
        <h1>Manager access required</h1>
        <p>Your account can use POS and view your own transactions.</p>
        <a href="/app/dashboard">Return to your dashboard</a>
      </div>
    );
  return <Outlet />;
}
createRoot(document.getElementById("root")!).render(
  <AppProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/callback" element={<Landing />} />
        <Route element={<Gate />}>
          <Route path="/app" element={<Layout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="pos" element={<POS />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="profile" element={<Profile />} />
            <Route element={<Gate manager />}>
              <Route path="products" element={<Products />} />
              <Route path="categories" element={<Categories />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="cashiers" element={<Cashiers />} />
              <Route path="settings" element={<Settings />} />
              <Route path="reports" element={<Reports />} />
              <Route path="data" element={<DataPage />} />
              <Route path="forecasting" element={<Forecasting />} />
            </Route>
          </Route>
        </Route>
        <Route
          path="*"
          element={
            <div className="loading">
              <h1>Page not found</h1>
              <a href="/">Return to SmartPOS</a>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  </AppProvider>,
);
