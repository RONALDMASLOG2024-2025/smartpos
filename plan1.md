I would like you to create a detailed implementation for fixing and fully updating the **SmartPOS system**.

First, review the entire existing SmartPOS codebase, current features, database structure, UI/UX, navigation, and system flow before making any changes. Do not blindly rebuild everything. Identify what is already working, what needs to be improved, what should be removed, and what needs to be added.

## 1. User Roles

The SmartPOS system should now have two main user roles:

1. **Manager**
2. **Cashier**

Update the entire system architecture, authentication, authorization, database, navigation, dashboards, and features to properly support these two roles.

Clearly define what each role can access and what actions each role is allowed to perform.

### Manager

The Manager should have administrative and business-management capabilities. Identify and implement the features that a real POS manager would need, such as:

- Sales overview
- Today's sales
- Monthly sales
- Revenue trends
- Transaction history
- Product management
- Category management
- Inventory management
- Low-stock monitoring
- Cashier management
- Sales reports
- Product performance
- Best-selling products
- Slow-moving products
- Data import/export
- Machine-learning insights
- System settings

Do not add unnecessary dashboard components simply to fill space. Every dashboard card, chart, table, and metric should provide useful information to the Manager.

### Cashier

The Cashier interface should focus on completing sales quickly and efficiently.

Identify and implement the functions a Cashier actually needs, such as:

- POS checkout
- Product search
- Product/category filtering
- Shopping cart
- Quantity adjustment
- Payment processing
- Transaction confirmation
- Receipt generation
- Recent transactions
- Basic shift or daily sales information, if appropriate

The Cashier should not have access to sensitive Manager functions unless explicitly permitted.

## 2. Authentication and User Management

Use **Google authentication** for the system.

The Manager should be able to sign in using their Google account.

The Manager should also be able to register or authorize the Google accounts of their Cashiers. Only Cashier accounts added or approved by the Manager should be allowed to access that Manager's SmartPOS environment.

Implement proper role-based access control so that users cannot access pages, APIs, or database records outside their permissions simply by manually entering a URL.

After login, automatically redirect users to the appropriate dashboard based on their role.

## 3. Supabase Migration

Migrate the system to **Supabase** for the backend.

Use Supabase for:

- PostgreSQL database
- Authentication
- Google OAuth
- Storage
- Row Level Security (RLS)
- User profiles and roles
- Product data
- Inventory
- Transactions
- Transaction items
- Categories
- Cashier accounts
- Uploaded product images
- Import/export records where necessary
- Machine-learning results where appropriate

Design a clean and scalable relational database schema.

Use proper foreign keys, constraints, indexes, timestamps, enums where appropriate, and Row Level Security policies.

Security must not depend only on hiding UI elements. Authorization must also be enforced at the database/server level.

## 4. Dashboard Redesign

Fully redesign the Manager and Cashier dashboards.

Use a modern, professional, clean, and practical POS design.

Avoid an overdesigned or generic "AI-generated dashboard" appearance. Do not fill the dashboard with excessive gradients, huge cards, random charts, unnecessary statistics, excessive rounded containers, or decorative components that do not provide useful information.

Use:

- Clear visual hierarchy
- Consistent spacing
- Good typography
- Compact cards
- Useful tables
- Appropriate charts
- Responsive layouts
- Consistent buttons and forms
- Clear empty states
- Loading states
- Error states
- Confirmation dialogs where necessary

The design should prioritize usability and speed.

### Manager Dashboard

Determine the most useful information for the Manager.

Possible metrics include:

- Sales today
- Sales this month
- Number of transactions
- Average transaction value
- Products sold
- Low-stock products
- Out-of-stock products
- Best-selling products
- Sales trends
- Recent transactions
- Cashier performance or activity

Only display metrics that can be accurately calculated from the available data.

### Cashier Dashboard

Keep the Cashier dashboard simpler.

The Cashier should immediately understand what they need to do next.

Prioritize:

- Start/open POS
- Today's transactions
- Today's sales handled by the Cashier
- Recent transactions
- Quick access to product search
- Relevant shift information
- Important inventory warnings where appropriate

Do not expose Manager-only analytics.

## 5. POS Interface

Review and improve the actual POS interface.

The checkout experience should be fast and simple.

Consider implementing:

- Product grid
- Product images
- Search
- Category filters
- Product availability
- Stock quantity
- Add-to-cart
- Quantity controls
- Remove item
- Subtotal
- Discounts if supported
- Total
- Payment amount
- Change calculation
- Payment method
- Transaction confirmation
- Receipt
- Print/download receipt
- Transaction history

Prevent invalid transactions, such as selling more items than are currently available in inventory.

Inventory should be updated correctly after successful transactions.

## 6. Product and Inventory Management

The Manager should be able to:

- Create products
- Edit products
- Archive/deactivate products
- Upload product images
- Manage categories
- Update prices
- Update stock
- View stock history where appropriate
- Identify low-stock products
- Search and filter products
- Import products through CSV
- Export products through CSV

Avoid permanently deleting important historical records if those records are referenced by completed transactions.

## 7. Product Images

Allow Managers to upload images for products.

Store the images using **Supabase Storage** rather than storing image files directly inside database rows.

Implement:

- Image upload
- Preview
- Image replacement
- Image validation
- File-size limits
- Supported file-type validation
- Fallback image
- Proper storage organization

Display product images consistently throughout the POS and product-management interfaces.

## 8. CSV Import and Export

Implement proper file-handling features.

Allow authorized users to download system data where appropriate.

For product management, allow the Manager to upload a CSV file to perform bulk product updates or imports.

Provide a downloadable **CSV template** so users know exactly what format the system expects.

The template may contain fields such as:

- SKU
- Product Name
- Category
- Description
- Price
- Cost
- Stock Quantity
- Low Stock Threshold
- Status

Determine the final fields based on the actual database schema.

Before importing:

1. Parse the CSV.
2. Validate all rows.
3. Show an import preview.
4. Identify invalid rows.
5. Explain validation errors.
6. Allow the user to correct the file.
7. Require confirmation before applying changes.
8. Record the import result.

Do not silently import malformed data.

Also allow appropriate system data to be exported to CSV, such as products, inventory, transactions, and sales reports, depending on the user's permissions.

## 9. Machine Learning

The machine-learning feature should be functional and integrated with the SmartPOS system.

Because real historical data may not yet be sufficient, create a clearly separated **synthetic dataset** for development and initial testing.

Use the synthetic data to build and test useful POS-related machine-learning functionality.

First determine which ML functionality provides actual value to SmartPOS. Possible applications include:

- Sales forecasting
- Product demand forecasting
- Inventory demand prediction
- Restocking recommendations
- Product sales trends

Do not create an ML feature simply for decoration.

Clearly separate:

- Synthetic/training data
- Real POS transactional data
- Training pipeline
- Model artifacts
- Inference logic
- Predictions
- UI presentation

Make sure the ML functionality actually runs and produces reproducible results.

Clearly label predictions generated from synthetic or insufficient data so they are not presented as reliable real-world business forecasts.

Architect the ML module so that real transaction data can eventually replace the synthetic training data without redesigning the entire application.

## 10. Sidebar and Navigation

Review and rebuild the sidebar/navigation where necessary.

Navigation should automatically adapt to the user's role.

### Manager Navigation

Possible sections:

- Dashboard
- POS
- Products
- Inventory
- Transactions
- Reports
- Analytics / Forecasting
- Cashiers
- Import / Export
- Settings

### Cashier Navigation

Possible sections:

- Dashboard
- POS
- Transactions
- Profile

Determine the final navigation based on the actual features implemented.

Fix:

- Incorrect active states
- Multiple menu items appearing active
- Broken routes
- Unnecessary menu items
- Dead links
- Incorrect redirects
- Mobile responsiveness
- Logout behavior
- User profile menu

## 11. Landing Page

Redesign and fix the landing page.

The current landing page is not good enough and has navigation problems.

Create a simple, professional landing page for SmartPOS that clearly explains:

- What SmartPOS is
- Its main purpose
- Core features
- Inventory management
- Sales tracking
- Reports and analytics
- Smart forecasting
- Manager and Cashier support

Include clear actions such as:

- Sign in with Google
- Get Started

Do not overdesign the landing page. Keep it consistent with the actual application.

Make sure every navigation element and CTA works correctly.

## 12. Logo, Branding, and Favicon

Review the existing SmartPOS branding.

If the current logo does not fit the redesigned system, create a new simple and recognizable SmartPOS logo.

Update:

- Application logo
- Sidebar logo
- Login page logo
- Landing page logo
- Favicon
- Browser metadata
- Application title
- Relevant application icons

Keep the branding professional and appropriate for a retail POS application.

## 13. Architecture

Refactor the project into a clean, maintainable, and modular architecture.

Separate concerns between:

- UI components
- Pages/routes
- Authentication
- Authorization
- Database access
- Business logic
- POS logic
- Inventory logic
- Reporting
- File handling
- CSV import/export
- Machine learning
- Validation
- Supabase integration
- Storage
- Types
- Utilities

Avoid large files containing unrelated functionality.

Reuse components where appropriate, but do not over-engineer simple functionality.

Use a single source of truth for shared types, permissions, business rules, and validation.

The architecture should make future features easier to add without rewriting the system.

## 14. Data Integrity

Pay special attention to POS transaction integrity.

A completed transaction should preserve historical information even when a product is later renamed or its price changes.

Transaction records should preserve important information such as:

- Product
- Product name at time of sale
- Price at time of sale
- Quantity
- Line total
- Transaction subtotal
- Discount
- Total
- Payment amount
- Change
- Payment method
- Cashier
- Timestamp

Use proper transaction handling so that inventory updates and sales creation cannot leave the database in an inconsistent state.

## 15. Responsive Design and Accessibility

Make the system usable on common desktop and tablet screen sizes.

Cashier workflows should be optimized for quick interaction.

Also review:

- Keyboard navigation
- Form labels
- Button states
- Contrast
- Error messages
- Loading states
- Touch targets
- Responsive tables
- Confirmation dialogs

## 16. UAT and End-to-End Testing

After implementation, perform a complete **User Acceptance Test (UAT)**.

Do not only test individual components. Navigate through the system as actual users would.

Create realistic dummy accounts and data.

### Manager Test Flow

Test:

Login → Manager Dashboard → Cashier Management → Add Cashier → Categories → Products → Upload Product Image → Inventory → CSV Template Download → CSV Import → POS → Complete Transaction → Transaction History → Reports → Export → ML/Forecasting → Settings → Logout.

### Cashier Test Flow

Test:

Google Login → Cashier Dashboard → POS → Search Product → Add Products → Change Quantity → Checkout → Payment → Change Calculation → Complete Transaction → Receipt → Transaction History → Logout.

Also test permission boundaries.

For example:

- Cashier attempts to open a Manager route.
- Unauthorized Google account attempts to access SmartPOS.
- Cashier attempts to modify inventory.
- Invalid CSV is uploaded.
- Duplicate product data is imported.
- Product has insufficient stock.
- Product image upload fails.
- Transaction fails midway.
- Empty database state.
- Mobile/tablet navigation.

Capture screenshots of important UAT stages.

If you discover a problem during UAT, **fix the problem and repeat the affected test** rather than simply documenting that the feature failed.

At the end, provide a UAT report containing:

- Test scenario
- User role
- Expected result
- Actual result
- Pass/Fail
- Screenshot/evidence
- Problem discovered
- Fix applied
- Retest result

## 17. Final Cleanup

Before considering the SmartPOS update complete:

- Remove unused components.
- Remove dead routes.
- Remove unused dependencies.
- Remove old database code that has been replaced by Supabase.
- Remove placeholder dashboard data unless intentionally marked as demo data.
- Remove console errors.
- Fix TypeScript/lint/build errors if applicable.
- Verify environment-variable handling.
- Verify authentication redirects.
- Verify RLS.
- Verify role permissions.
- Verify responsive behavior.
- Verify every sidebar item.
- Verify every important button.
- Verify CSV import/export.
- Verify product image storage.
- Verify transaction integrity.
- Verify the ML pipeline.
- Verify the production build.

## 18. Implementation Approach

Keep the implementation **fast, practical, simple, and maintainable**.

Do not over-engineer SmartPOS.

However, "simple" does not mean incomplete. The important workflows must actually work from end to end.

Work in this order:

**Audit → Architecture → Supabase Schema → Authentication/Roles → Core POS → Products/Inventory → Manager Features → Cashier Features → Import/Export → ML → UI/UX Redesign → Landing/Branding → Testing → UAT → Final Cleanup**

Before modifying the project, provide a short audit and implementation plan. Then proceed with the implementation.

Do not stop after creating mockups or plans. Implement the functionality, connect it to Supabase, test it, and fix discovered problems.

The final SmartPOS should feel like a coherent POS product rather than a collection of disconnected pages.