# SmartPOS

SmartPOS is a retail point-of-sale app with a Manager workspace and a focused Cashier checkout. The original codebase was audited before migration; the audit and permission matrix are in [docs/AUDIT.md](docs/AUDIT.md).

The application now uses React, TypeScript, Vite and Supabase. PostgreSQL holds store data; Supabase Google OAuth authenticates users; RLS and guarded database functions enforce membership and roles; private Supabase Storage holds product images.

## Run locally

Requires Node.js 22.12 or newer. Python 3.10+ is optional for ML training and legacy migration.

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:5173. `run_app.bat` starts the same command from the project directory.

Use `.env.example` to configure your new project. Follow [docs/SETUP.md](docs/SETUP.md) for the Supabase migrations, Google Console callback URLs, automatic Manager registration and Vercel deployment.

For a separate local demo, set `VITE_ENABLE_DEMO=true` in `.env.local` with no Supabase credentials. Demo accounts/sales are fictional, explicitly labelled and stored only in this browser. Production defaults to demo disabled. A configured Supabase project disables demo login even when the flag is set.

## Workspaces

- **Manager:** daily/monthly sales, trends, stock attention, checkout, product/category management, private image upload/replacement, stock adjustments/history, all store receipts, reports, product performance, Cashier Google-account approvals, CSV import/export, demand forecasts, store settings.
- **Cashier:** own daily sales, POS search/category filters, stock-aware basket, quantities, cash payment/change, externally verified card/e-wallet payments, receipts, own transactions and profile.

Choose Manager or Cashier before continuing with Google. A first-time Manager automatically creates their own empty store; returning users keep their existing workspace and role. Cashiers must first be added by their Manager using their exact Google email. Choosing Manager does not promote an existing Cashier or grant access to another store. Cashiers cannot see product costs or another Cashier's transactions. Server/database enforcement is independent of route visibility.

Checkout uses integer cents, current server prices, ordered product locks, a single PostgreSQL transaction and an idempotency UUID. Insufficient stock, stale prices, payment errors or later write failures roll back the complete operation. Receipts retain original product names/SKUs/prices, Cashier and store details. Product archiving keeps history intact. Inventory adjustments/imports reject stale stock balances rather than overwriting a concurrent sale.

Cash, card and e-wallet are recorded payment methods. SmartPOS does not charge a card or wallet; confirm external payment at your terminal/provider before recording it.

## CSV and legacy data

Import & export provides a template matching the schema, file parsing, all-row validation, error messages, create/update preview, explicit approval and atomic application. Successful imports are audited. Products, stock, stock history, transactions, item lines, reports and forecasts can be exported. Spreadsheet formula injection is neutralized in exported text.

Your existing `data/*.csv` files were preserved. They are no longer the active backend and are never automatically imported into live stores. [scripts/migrate_legacy.py](scripts/migrate_legacy.py) validates the three original product/sales/item files and generates reviewable SQL for an empty workspace. It preserves stock balances and receipt history, identifies unknown legacy Cashiers and refuses inconsistent data. See the setup guide before using it. On Windows, install `tzdata` (`python -m pip install tzdata`) if Python reports that Asia/Manila timezone data is missing.

## Forecasting

```powershell
npm run ml:train
```

The Python training pipeline generates 1,344 deterministic synthetic daily observations (seed 42), trains weekday/trend ridge regression, evaluates a 14-day holdout, then writes `ml/artifacts/demand-v1.json` and the browser artifact `src/ml/model.json`. Synthetic observations live only in `ml/data/synthetic_daily.csv`; they never enter POS transactions or inventory.

The Manager can explicitly run labelled synthetic forecasts. Real inference trains from complete historical daily product quantities, including zero-sale days, excluding the incomplete current day. Products need at least 56 completed days of history; insufficient data is clearly reported. Forecast runs record provenance/model version/results in Supabase. Predictions estimate seven-day demand and buffer-based replenishment; they never change inventory automatically.

To train an offline real dataset, supply a CSV with `SKU,Date,Quantity`, continuous dates and zero-sale observations:

```powershell
python ml/train.py --source real --input daily.csv --output ml/artifacts/real-demand.json
```

## Verification

```powershell
npm test
npm run lint
npm run build
npx playwright install chromium
npm run uat
```

UAT expects the development server running with isolated demo enabled. Tests use fresh browser contexts and fictional accounts. [docs/UAT.md](docs/UAT.md) records outcomes, fixes/retests and screenshot evidence. PostgreSQL tests execute the actual SQL in PGlite with mocked Supabase auth/storage schemas; they are not a substitute for testing the hosted provider and Storage services after connection.

Run `npx playwright test --config playwright.auth.config.ts` to test the role chooser, OAuth role persistence, Manager/Cashier callback handling, session restoration and unapproved Cashier errors. This suite starts its own local server with a fake Supabase host and intercepts all authentication and database requests.

A production safety check uses a build with `VITE_ENABLE_DEMO=false` and no credentials:

```powershell
$env:VITE_ENABLE_DEMO='false'
npm run build
Remove-Item Env:\VITE_ENABLE_DEMO
npx playwright test --config playwright.production.config.ts
```

## Structure

```text
src/components/       shared UI, navigation and receipts
src/pages/            focused application routes
src/context.tsx       session, workspace loading and action state
src/data/             Supabase repository and isolated demo repository
src/domain/           shared types, permissions, validation and reporting
src/lib/              OAuth client, CSV/file handling
src/ml/               demand inference and trained model artifact
supabase/migrations/  PostgreSQL schema, RLS, Storage and atomic RPCs
ml/                   separate synthetic data, training and artifacts
scripts/              validated legacy migration
 tests/               business, PostgreSQL, UAT and production safety tests
docs/                 audit, setup, UAT and screenshots
```

Vercel now builds and serves the complete Vite app with SPA route fallback, rather than a separate static-only marketing page. Google provider credentials, actual cloud data and hosted acceptance checks await the new Supabase project connection.
