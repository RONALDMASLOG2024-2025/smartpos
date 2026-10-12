# Connect the new Supabase and Google accounts

The Google Cloud project and Supabase project may be owned by different Google accounts. Your Google Cloud OAuth client is configured in Supabase. A new store owner chooses Manager at sign-in and creates their account and store automatically with Google.

1. Create the new Supabase project. In SQL Editor, run the complete [001_smartpos.sql](../supabase/migrations/001_smartpos.sql) migration once. It creates tables, protected business functions, RLS and a private `product-images` bucket.
2. Run [002_manager_self_registration.sql](../supabase/migrations/002_manager_self_registration.sql) in SQL Editor after the original migration. For an existing project that has already run `001`, run only `002`. This enables first-time Manager registration and preserves existing accounts and stores. Manual Manager provisioning is no longer required. Existing Cashiers keep their assigned role; selecting Manager cannot promote them or restore disabled access.

3. In Google Cloud Console, select/create a project, configure the OAuth consent screen, choose the audience, and create a **Web application OAuth client**. While the consent screen is in Testing, add the Manager and Cashier emails as test users. Configure authorized JavaScript origins for your app origins (local `http://127.0.0.1:5173` and the final HTTPS domain).
4. In Supabase **Authentication → Sign In / Providers → Google**, copy the callback URL. Add that exact URL as an **Authorized redirect URI** in Google Console; typically `https://PROJECT.supabase.co/auth/v1/callback`. Paste Google's client ID and client secret into Supabase's Google provider settings and enable the provider. Keep the client secret out of this repository.
5. In Supabase **Authentication → URL Configuration**, set Site URL to the final app origin. Add allowed callback URLs: `http://127.0.0.1:5173/auth/callback`, optionally `http://localhost:5173/auth/callback`, and `https://YOUR_DOMAIN/auth/callback`. Disable unused email/password providers for this Google-only application.
6. Copy `.env.example` to `.env.local` and set:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   VITE_ENABLE_DEMO=false
   ```

   The publishable key is intended for browsers; RLS enforces access. For a legacy anon key, use `VITE_SUPABASE_ANON_KEY` instead; the app supports both names and prefers the publishable key. Never set a service-role key or Google client secret in a `VITE_` variable. Restart Vite after changing environment variables.

7. Run `npm install` and `npm run dev`. Click **Sign in with Google**, choose **Manager**, and sign in. A first-time Manager gets a new empty workspace named **My store**, which can be renamed in **Settings**. Use **Cashiers → Add cashier** to authorize each Cashier's exact Google email. Cashiers choose **Cashier** at sign-in to join your workspace; an unapproved Cashier cannot join. Returning users choose their existing role. Disable Cashier access from the Cashiers page when necessary; every database RPC checks current active membership.
8. For Vercel, set the same public environment variables in project settings, leave demo disabled, and deploy the repository with its Vite configuration. Add the exact deployed callback URL to Supabase. All app routes are served by the SPA rewrite.

## Local demo

Set only `VITE_ENABLE_DEMO=true` in `.env.local`, with no Supabase URL/key. Use “Explore as Manager” or “Explore as Cashier.” The demo is deliberately isolated, labelled, and persists one JSON state in localStorage. It is a single-browser development tool, not a production multi-register database or payment processor. A configured Supabase client always disables demo login.

## Preserve and migrate the existing CSV data

Original `data/products.csv`, `data/transactions.csv`, and `data/transaction_items.csv` remain unchanged by this implementation. They are never automatically seeded into Supabase.

For products only, convert/import through the new template and preview. To preserve historical sales as well, generate and review a SQL migration:

```powershell
python scripts/migrate_legacy.py --store-id YOUR_STORE_UUID --output legacy-import.sql
```

Run the generated file in Supabase SQL Editor **before adding products or sales to that workspace**. It validates all totals first and executes inside one PostgreSQL transaction. It imports the existing current stock balances without deducting historical sales again. Missing historical products become archived. Legacy timestamps are interpreted in Asia/Manila; original transaction IDs are retained in `request_payload.legacy_id`. Original cashier/store details did not exist and are explicitly labelled as unrecorded rather than invented. Keep a copy of your original CSVs. Generated SQL contains store data; do not commit it publicly.

## Live acceptance checks after connection

Use a first-time Manager, returning Manager, approved Cashier and unapproved Cashier Google account:

- Verify the role chooser and Google callback. A first-time Manager must get one new store; repeat sign-ins must reuse it. Check Cashier invitation access, wrong-role errors, logout and unapproved Cashier denial.
- Cashier direct URL to `/app/inventory` must be denied; direct API inventory writes and other tenants' rows must also fail.
- Upload/replace a JPEG/PNG/WebP, verify private signed image URLs, and reject unsupported/oversized files.
- Submit overlapping checkouts from two browser sessions against a one-unit product: exactly one sale must succeed.
- Retry an identical checkout request: one receipt and one stock deduction only.
- Run valid/invalid/duplicate/stale CSV previews and confirm no partial imports.
- Review Security Advisor, RLS and Storage policies in the project. Google provider configuration, hosted Storage delivery and real simultaneous connections cannot be certified by the offline PostgreSQL harness.

Reference: [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions).
