import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Package,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { useApp } from "../context";
import { Brand, Modal } from "../components/ui";
import type { Role } from "../domain/types";
import { demoEnabled, supabase } from "../lib/supabase";
export function Landing() {
  const { repo, login, demoLogin, error, loading, logout } = useApp();
  const [showSignIn, setShowSignIn] = useState(false);
  function chooseRole(role: Role) {
    setShowSignIn(false);
    void login(role);
  }
  if (repo) return <Navigate to="/app/dashboard" replace />;
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link to="/" aria-label="SmartPOS home">
          <Brand />
        </Link>
        <div>
          <a href="#features">Features</a>
          <a href="#workflow">How it works</a>
          <button
            onClick={() => setShowSignIn(true)}
            disabled={loading || !supabase}
          >
            Sign in with Google <ArrowRight size={16} />
          </button>
        </div>
      </nav>
      <main>
        <section className="landing-hero">
          <div>
            <span className="eyebrow">THE EVERYDAY POINT OF SALE</span>
            <h1>
              Your shop,
              <br />
              <em>in order.</em>
            </h1>
            <p>
              Keep checkout moving. Know what’s on your shelves. Make the next
              business decision with a clear view of your sales.
            </p>
            <button
              className="primary"
              onClick={() => setShowSignIn(true)}
              disabled={loading || !supabase}
            >
              Sign in with Google <ArrowRight size={18} />
            </button>
            <p className="small">
              Start your store as a Manager, or join your team as a Cashier.
            </p>
          </div>
          <img
            src="/retail-checkout.jpg"
            alt="A retail counter ready to serve customers"
          />
        </section>
        {error && (
          <div className="alert error" role="alert">
            {error}
            <button onClick={() => void logout()}>
              Sign out / try another account
            </button>
          </div>
        )}
        {!supabase && (
          <section className="setup-notice">
            <h2>
              {demoEnabled
                ? "Explore SmartPOS"
                : "Your workspace is being connected"}
            </h2>
            <p>
              {demoEnabled
                ? "This isolated demo uses fictional accounts and sample sales saved only in this browser. Google sign-in is available in connected workspaces."
                : "Google sign-in will be available when SmartPOS is connected. Managers can then create a store and add Cashiers."}
            </p>
            {demoEnabled && (
              <div className="actions">
                <button
                  className="primary"
                  onClick={() => demoLogin("manager")}
                >
                  Explore as Manager
                </button>
                <button onClick={() => demoLogin("cashier")}>
                  Explore as Cashier
                </button>
              </div>
            )}
          </section>
        )}
        <section id="features" className="landing-features">
          <div className="section-intro">
            <span className="eyebrow">BUILT FOR THE DAILY WORK</span>
            <h2>
              From your first sale
              <br />
              to your next delivery.
            </h2>
          </div>
          <article>
            <ShoppingBag />
            <h3>A faster counter</h3>
            <p>
              Find products, adjust a basket, accept payment, and print a
              receipt. Inventory updates with every completed sale.
            </p>
          </article>
          <article>
            <Package />
            <h3>Stock you can trust</h3>
            <p>
              Manage products, images, categories and deliveries. Catch low
              stock and update your catalogue with CSV imports.
            </p>
          </article>
          <article>
            <BarChart3 />
            <h3>A clearer picture</h3>
            <p>
              Track daily sales, review product performance and explore demand
              forecasts with clearly identified training data.
            </p>
          </article>
        </section>
        <section id="workflow" className="landing-workflow">
          <h2>A place for every role.</h2>
          <div>
            <article>
              <span>01 / MANAGER</span>
              <h3>Run the business</h3>
              <p>
                Set up your store, approve Cashier Google accounts, manage
                stock, and review sales and reports.
              </p>
            </article>
            <article>
              <span>02 / CASHIER</span>
              <h3>Serve the customer</h3>
              <p>
                Sign in with an approved Google account. Open POS, complete
                checkout, and review your own sales.
              </p>
            </article>
          </div>
          <button
            className="primary"
            onClick={() => setShowSignIn(true)}
            disabled={loading || !supabase}
          >
            Get started with Google <ArrowRight size={16} />
          </button>
        </section>
      </main>
      <footer>
        <Brand />
        <span>Built for the everyday sale.</span>
      </footer>
      {showSignIn && (
        <Modal title="Sign in to SmartPOS" onClose={() => setShowSignIn(false)}>
          <p className="muted">
            Choose how you use SmartPOS, then continue with Google.
          </p>
          <div className="sign-in-roles">
            <button
              className="sign-in-role"
              onClick={() => chooseRole("manager")}
            >
              <Store size={26} aria-hidden="true" />
              <span>
                <strong>Manager</strong>
                <span>
                  Create your store on your first sign-in. Manage products,
                  sales and Cashiers.
                </span>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button
              className="sign-in-role"
              onClick={() => chooseRole("cashier")}
            >
              <Users size={26} aria-hidden="true" />
              <span>
                <strong>Cashier</strong>
                <span>
                  Join your store and handle checkout. Your Manager must add
                  your Google email first.
                </span>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
          <p className="small muted">
            Already have an account? Choose your existing role to return to your
            workspace.
          </p>
        </Modal>
      )}
    </div>
  );
}
