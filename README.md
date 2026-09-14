# SmartPOS

SmartPOS is a beginner-friendly Point-of-Sale application for a small business. It manages products, stock and completed sales with CSV files instead of a database. It also processes purchase baskets to recommend products frequently bought together.

## Technologies

- Python 3
- Streamlit for the interface
- Pandas for reading, writing and processing CSV files
- CSV files for persistent storage
- mlxtend for the optional Apriori / association-rule extension

## Installation and running

```bash
pip install -r requirements.txt
python -m streamlit run app.py
```

Open the local address printed by Streamlit in a browser.

Using `python -m streamlit` ensures Streamlit runs from the same Python environment where the requirements were installed. If PowerShell says that `streamlit` is not recognized, use this command or run `./run_app.bat`.

## Pages

- **Dashboard** calculates live sales, transaction, low-stock and product-sales summaries.
- **POS** creates a cart, validates stock and payment, saves a sale, and reduces inventory.
- **Products** supports searching, category filtering, adding, editing, restocking and deleting products.
- **Transactions** searches and filters completed sales and displays their individual items.
- **Recommendations** calculates frequently purchased product pairs and includes an optional Apriori analysis.

## CSV files

| File                                | Columns                                                                                          | Purpose                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `data/products.csv`               | `product_id`, `product_name`, `category`, `price`, `stock_quantity`                    | Inventory catalogue                                                      |
| `data/transactions.csv`           | `transaction_id`, `datetime`, `total`, `payment`, `change`                             | One row per completed sale                                               |
| `data/transaction_items.csv`      | `transaction_id`, `product_id`, `product_name`, `quantity`, `unit_price`, `subtotal` | Products inside each completed sale                                      |
| `data/recommendations.csv`        | product/recommendation IDs and names, pair count                                                 | Saved calculated recommendation results                                  |
| `data/demo_transaction_items.csv` | same columns as transaction items                                                                | Separate demo baskets used only when enabled on the Recommendations page |

The demo baskets do not affect dashboard totals, real transactions, or inventory. They let the recommendation feature be demonstrated before actual checkout history exists.

## File handling demonstration

The app keeps file operations easy to locate:

- **READ:** `utils/file_handler.py` loads every CSV safely, including missing or empty files.
- **WRITE:** product changes and saved recommendations replace their corresponding full CSV safely.
- **APPEND:** checkout adds a new transaction and its item rows without removing prior sales.
- **UPDATE:** editing a product, restocking, and a completed checkout update `products.csv`.
- **DELETE:** deleting a product removes its row while retaining its historical sales records.
- **PROCESS:** the dashboard totals, charts, low-stock list and recommendations are calculated from CSV data.

## Recommendation method

The standard recommendation feature groups `transaction_items.csv` rows by transaction ID, forms every product pair in a basket, and counts its occurrences. For example, if White Bread and Coffee Sachet appear in four transactions, the app can recommend Coffee Sachet when White Bread is in a later cart.

The optional Apriori panel uses `mlxtend` to show association rules with support, confidence and lift. The POS remains fully functional if there is not enough history or if this optional package is unavailable.

## Project structure

```text
smartpos/
├── app.py
├── requirements.txt
├── data/                 # persistent CSV files
├── pages/                # one renderer per app page
└── utils/                # file handling, products, transactions, recommendations
```

## POS transaction flow

1. The cashier adds in-stock products to a temporary Streamlit cart.
2. Checkout checks cart quantities against the latest inventory and confirms payment is enough.
3. The app generates the next transaction ID and appends records to both transaction CSV files.
4. It updates `products.csv` with reduced stock and clears the cart.

All data remains available after restarting the application because it is saved in the `data` folder.
