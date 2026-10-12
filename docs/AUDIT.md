# SmartPOS audit and implementation plan

Reviewed before changes: every Python module in app.py, pages and utils; README, dependencies, Streamlit/Vercel configuration, static landing HTML/CSS, and CSV structure. Modified CSV files are user data and will be preserved.

## Findings

- Keep searchable catalogue, category filters, stock-aware cart, payment/change, historical item names/prices, summaries and separate demonstration data.
- Fix non-atomic three-file checkout, colliding sequential sale IDs, floating-point money, absent authentication/permissions, hardcoded thresholds and destructive product deletion.
- Replace Streamlit and static-only Vercel with a typed browser app for reliable Google OAuth callbacks, responsive checkout and one deployable app. Retain green identity and retail photo.
- Add tenant memberships, Google-account approvals, RLS, atomic/idempotent checkout, stock audit, images, archive status, CSV validation/preview, receipts, reports, trained demand forecasting and role dashboards.
- Remove replaced Python persistence and obsolete routes after implementation. Preserve existing CSV files and provide an explicit migration tool.

## Sequence

Architecture/shared validation → Supabase schema/RLS → Google auth/roles → atomic checkout → products/inventory → manager/cashier pages → CSV → ML → responsive UI/landing/branding → business/SQL tests → browser UAT/screenshots → cleanup/build.

## Architecture

React/TypeScript/Vite UI, repository boundary with live Supabase and explicitly opted-in isolated demo implementations, integer-cent money, PostgreSQL RPCs for atomic business operations, private Storage, separate synthetic/training/model/inference layers. Managers are explicitly provisioned, never auto-elevated on signup.

| Access                                            | Manager             | Cashier                      |
| ------------------------------------------------- | ------------------- | ---------------------------- |
| Dashboard                                         | Tenant analytics    | Own daily sales              |
| Checkout                                          | Yes                 | Yes                          |
| Transactions/receipts                             | Tenant              | Own only                     |
| Catalogue                                         | Full including cost | Active products without cost |
| Inventory/products/categories/images              | Manage              | Read availability            |
| Reports/forecasts/import/export/cashiers/settings | Yes                 | No                           |
| Profile/logout                                    | Yes                 | Yes                          |

## External setup

User is creating Supabase/Google projects on another account. Live OAuth/hosted RLS/Storage checks require credentials and provider setup. Local PostgreSQL tests and isolated demo tests must be reported separately from live verification.
