
# SmartPOS – Python Streamlit POS with File Handling and Product Recommendations

I want you to help me build a **simple but complete Point-of-Sale (POS) application using Python and Streamlit**.

This is a school Midterm project focused primarily on **Python file handling**. The application should also demonstrate a simple Machine Learning-related functionality through **product recommendations based on previous transactions**.

The application should remain simple, understandable, well-organized, and feasible for a group of three students.

Do not overengineer the project.

---

# 1. Technology Stack

Use the following technologies:

* Python 3
* Streamlit for the user interface
* Pandas for CSV reading, writing, updating, and processing
* CSV files as the primary data storage
* mlxtend for Apriori / Association Rule Learning if needed
* Matplotlib or Streamlit's built-in charts for simple visualization

Do NOT use:

* PostgreSQL
* MySQL
* SQLite
* Supabase
* Firebase
* MongoDB
* Django
* React
* Next.js
* External APIs

The purpose of using CSV files instead of a database is to clearly demonstrate **file-handling operations**.

---

# 2. Application Name

**SmartPOS**

Description:

SmartPOS is a simple Point-of-Sale system for small businesses that manages products, inventory, and sales transactions using CSV file handling.

The system also analyzes transaction history to identify products that are frequently purchased together and provides product recommendations.

---

# 3. Main Navigation

Create a clean Streamlit application with the following pages:

1. Dashboard
2. POS
3. Products
4. Transactions
5. Recommendations

Use Streamlit's sidebar navigation or Streamlit's multipage functionality.

Keep the interface simple, clean, modern, and easy to understand.

---

# 4. Dashboard

Create a simple dashboard showing:

* Total Sales
* Total Transactions
* Total Products
* Low Stock Products
* Most Sold Product
* Recent Transactions

Include simple charts if appropriate, such as:

* Sales by product
* Product quantities sold

All dashboard information must be calculated by reading and processing the CSV files.

Do not hard-code dashboard statistics.

---

# 5. Product Management

Create a Products page where users can:

* View all products
* Add a product
* Edit a product
* Delete a product
* Search products
* Filter products by category
* Update stock quantity

Each product should contain:

* Product ID
* Product Name
* Category
* Price
* Stock Quantity

Example:

| Product ID | Product Name | Category | Price | Stock |
| ---------- | ------------ | -------- | ----- | ----- |
| P001       | Coca-Cola    | Beverage | 25.00 | 50    |
| P002       | Bread        | Bakery   | 20.00 | 30    |
| P003       | Coffee       | Beverage | 15.00 | 40    |
| P004       | Milk         | Dairy    | 40.00 | 25    |

Store this information inside:

`data/products.csv`

The system must demonstrate:

* Reading products from the file
* Writing new products
* Updating existing products
* Deleting products
* Saving changes back to the CSV file

Validate user input.

Do not allow:

* Duplicate Product IDs
* Negative prices
* Negative stock
* Empty product names

---

# 6. POS / Checkout

Create a functional POS page.

The cashier should be able to:

* View available products
* Search for products
* Select a product
* Enter quantity
* Add products to a cart
* View the current cart
* Change quantities
* Remove products from the cart
* See the running total
* Enter customer payment
* Calculate change
* Complete the transaction

Do not allow customers to purchase more products than the available stock.

Example cart:

Bread x2 = ₱40.00
Coffee x1 = ₱15.00

Subtotal: ₱55.00
Payment: ₱100.00
Change: ₱45.00

When the cashier clicks **Complete Transaction**, the application must:

1. Validate the transaction.
2. Generate a unique Transaction ID.
3. Record the date and time.
4. Save the transaction.
5. Save each product purchased.
6. Update product inventory.
7. Clear the cart.
8. Display a transaction success message.

---

# 7. Transaction Storage

Use two files for transactions.

## transactions.csv

Store the overall transaction.

Columns:

* transaction_id
* datetime
* total
* payment
* change

Example:

T001,2026-09-14 14:30:00,55.00,100.00,45.00

## transaction_items.csv

Store individual products belonging to transactions.

Columns:

* transaction_id
* product_id
* product_name
* quantity
* unit_price
* subtotal

Example:

T001,P002,Bread,2,20.00,40.00
T001,P003,Coffee,1,15.00,15.00

This structure is important because `transaction_items.csv` will later be processed for product recommendations.

---

# 8. Inventory Updating

Whenever a transaction is successfully completed, automatically reduce the stock quantity inside:

`data/products.csv`

Example:

Bread stock before transaction:

30

Customer purchases:

2

Updated stock:

28

The updated stock must persist even after the Streamlit application is restarted.

---

# 9. Transaction History

Create a Transactions page.

Display completed transactions in a table.

Allow the user to:

* View all transactions
* Search by Transaction ID
* Filter transactions by date
* Select a transaction
* View the individual products belonging to that transaction

For example:

Transaction: T001

Date: September 14, 2026

Items:

Bread x2 = ₱40
Coffee x1 = ₱15

Total: ₱55
Payment: ₱100
Change: ₱45

All information must come from the CSV files.

---

# 10. Product Recommendation Feature

Create a Recommendations page.

The purpose is to analyze historical transactions and identify products commonly purchased together.

Start with a **simple frequency-based recommendation algorithm**.

For example:

Transactions:

T001 → Bread, Coffee
T002 → Bread, Coffee, Milk
T003 → Bread, Juice
T004 → Bread, Coffee

The system should recognize that Bread and Coffee frequently occur within the same transaction.

It could produce:

Bread → Coffee
Purchased Together: 3 times

Display a table containing:

* Product
* Recommended Product
* Number of Times Purchased Together

---

# 11. Machine Learning Extension

After the basic frequency-based recommendation system works correctly, implement or prepare an optional **Market Basket Analysis** feature using:

* Apriori Algorithm
* Association Rules
* mlxtend

Use `transaction_items.csv` as the dataset.

Generate association rules containing information such as:

* Antecedent
* Consequent
* Support
* Confidence
* Lift

Example:

Bread → Coffee

Support: 0.60
Confidence: 0.75
Lift: 1.25

Only implement this after the basic POS and file-handling functionality is stable.

The POS should still function even if there is not enough transaction data to run Apriori.

Display a clear message such as:

"More transaction data is needed to generate Machine Learning recommendations."

---

# 12. Recommendations Inside the POS

If enough transaction history exists, integrate recommendations into the POS page.

When the cashier adds a product to the cart, analyze previous transactions and display a recommendation.

Example:

Current Cart:

Bread – ₱20

Recommended Product:

Coffee – ₱15

"Frequently purchased with Bread."

Allow the cashier to easily add the recommended product to the cart.

If no recommendation exists, simply do not display one.

---

# 13. File Handling Requirements

File handling is one of the most important parts of this project.

Clearly implement and organize the following operations:

### READ

Read products and transactions from CSV files.

Examples:

* Load products
* Load inventory
* Load transaction history
* Load transaction items

### WRITE

Write new information into files.

Examples:

* Create new product records
* Initialize missing CSV files

### APPEND

Append new transactions without deleting previous records.

Examples:

* Append transaction to `transactions.csv`
* Append transaction items to `transaction_items.csv`

### UPDATE

Modify existing file information.

Examples:

* Update product details
* Update inventory after checkout

### DELETE

Remove product records when requested.

### PROCESS

Process file contents to calculate:

* Total sales
* Total transactions
* Most sold products
* Low stock products
* Frequently purchased product combinations
* Product recommendations

Keep these operations easy to identify in the source code because we need to explain them during our presentation.

---

# 14. Project Structure

Use a clean structure similar to:

smartpos/
│
├── app.py
├── requirements.txt
├── README.md
│
├── data/
│   ├── products.csv
│   ├── transactions.csv
│   ├── transaction_items.csv
│   └── recommendations.csv
│
├── pages/
│   ├── dashboard.py
│   ├── pos.py
│   ├── products.py
│   ├── transactions.py
│   └── recommendations.py
│
└── utils/
├── file_handler.py
├── product_manager.py
├── transaction_manager.py
└── recommendation.py

You may modify the structure if Streamlit requires a different naming convention, but keep responsibilities separated and understandable.

---

# 15. File Handler

Create a dedicated file-handling module.

For example:

`utils/file_handler.py`

Centralize common operations such as:

* Reading CSV files
* Writing CSV files
* Appending records
* Checking whether files exist
* Creating files if they do not exist
* Handling empty files
* Handling missing files

Use Pandas where appropriate, but also make the file-handling process easy for students to understand.

Add comments explaining important file operations.

---

# 16. Error Handling

The application should gracefully handle:

* Missing CSV files
* Empty CSV files
* Invalid data
* Duplicate Product IDs
* Insufficient stock
* Invalid quantity
* Invalid payment
* Payment lower than total
* Empty cart
* Missing transaction data
* Insufficient data for recommendations

The application should not crash because of simple user mistakes.

Use Streamlit messages such as:

* st.success()
* st.warning()
* st.error()
* st.info()

where appropriate.

---

# 17. Sample Dataset

Generate sample products for testing.

Create approximately 15–20 products from categories such as:

* Beverages
* Snacks
* Bakery
* Dairy
* Instant Food
* Personal Care

Also create optional sample transaction data that can demonstrate the recommendation functionality.

However, clearly separate sample/demo transactions from transactions generated by actual POS usage.

---

# 18. UI Design

Keep the UI simple but professional.

Use:

* Clear page titles
* Cards/metrics
* Columns
* Forms
* Tables/dataframes
* Buttons
* Tabs where appropriate
* Sidebar navigation

Do not spend too much time creating complicated custom CSS.

Functionality and understandability are more important than visual complexity.

Use Philippine Peso (₱) for monetary values.

---

# 19. Code Quality

The code should be:

* Beginner-friendly
* Modular
* Well-commented
* Easy to explain
* Easy to modify
* Free from unnecessary abstractions

Avoid overly advanced programming patterns unless necessary.

Important functions should have short docstrings explaining their purpose.

Do not put the entire application inside one Python file.

---

# 20. README

Create a README.md containing:

## Project Description

Explain what SmartPOS does.

## Technologies

Explain:

* Python
* Streamlit
* Pandas
* CSV
* mlxtend

## Installation

Include instructions such as:

pip install -r requirements.txt

## Running the Application

streamlit run app.py

## File Handling

Explain how the application demonstrates:

* Reading
* Writing
* Appending
* Updating
* Deleting
* Processing

## Machine Learning

Explain the basic recommendation algorithm and the optional Apriori implementation.

## Project Structure

Explain the purpose of the main folders and files.

---

# 21. Development Priority

Build the project incrementally.

Follow this order:

### Phase 1 – Project Setup

Create the Streamlit project structure and CSV files.

### Phase 2 – Product Management

Implement product CRUD and inventory file handling.

### Phase 3 – POS

Implement cart, checkout, payment, and change calculation.

### Phase 4 – Transaction Recording

Implement `transactions.csv` and `transaction_items.csv`.

### Phase 5 – Inventory

Automatically update stock after checkout.

### Phase 6 – Transaction History

Implement transaction viewing and filtering.

### Phase 7 – Dashboard

Calculate basic statistics from CSV files.

### Phase 8 – Basic Recommendations

Implement frequently-bought-together analysis.

### Phase 9 – Machine Learning

Add Apriori/Association Rules only after the basic application works.

### Phase 10 – Testing and Cleanup

Test file handling, validation, calculations, and edge cases.

---

# 22. Important Development Rules

Please follow these rules throughout development:

1. Keep the application simple enough for three students to understand and present.
2. Do not replace CSV storage with a database.
3. File handling must remain a central part of the project.
4. Do not fake or hard-code dashboard statistics.
5. Do not hard-code recommendations.
6. Recommendations must be calculated from transaction history.
7. Make sure inventory persists after restarting the application.
8. Make sure previous transactions persist after restarting.
9. Validate data before modifying files.
10. Prioritize a stable POS before implementing Machine Learning.
11. Do not introduce unnecessary dependencies.
12. Explain major implementation decisions in comments.
13. Keep the recommendation algorithm separate from the POS logic.
14. Ensure the project can run locally with a simple `streamlit run app.py` command.

---

# 23. Expected Final Workflow

The final application should work approximately like this:

User opens SmartPOS
↓
Products are loaded from `products.csv`
↓
Cashier selects products
↓
Products are added to cart
↓
System optionally recommends related products
↓
Cashier enters payment
↓
System calculates total and change
↓
Transaction is completed
↓
Transaction is appended to `transactions.csv`
↓
Purchased items are appended to `transaction_items.csv`
↓
Stock quantities are updated in `products.csv`
↓
Transaction history grows
↓
Recommendation algorithm processes transaction history
↓
Future transactions receive better product suggestions

---

# 24. Before Coding

Before implementing everything at once:

1. Review these requirements.
2. Propose the final project folder structure.
3. Identify each CSV file and its exact columns.
4. Explain how the POS transaction flow will work.
5. Explain how each READ, WRITE, APPEND, UPDATE, DELETE, and PROCESS file operation will be implemented.
6. Identify which functionality belongs in each Python module.
7. Create a short implementation plan.

Then begin implementing the project **phase by phase**.

After completing each major phase, verify that it works before proceeding to the next one.

The final result should be a **working, understandable, file-handling-focused Python Streamlit POS application with a simple pathway toward Machine Learning product recommendations.**
