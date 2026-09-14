"""CSV file operations used throughout SmartPOS.

Keeping READ, WRITE and APPEND operations here makes the file-handling
requirements easy to demonstrate during the project presentation.
"""

from pathlib import Path
from typing import Iterable, Mapping

import pandas as pd


PROJECT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_DIR / "data"

PRODUCT_COLUMNS = ["product_id", "product_name", "category", "price", "stock_quantity"]
TRANSACTION_COLUMNS = ["transaction_id", "datetime", "total", "payment", "change"]
ITEM_COLUMNS = [
    "transaction_id",
    "product_id",
    "product_name",
    "quantity",
    "unit_price",
    "subtotal",
]
RECOMMENDATION_COLUMNS = [
    "product_id",
    "product",
    "recommended_product_id",
    "recommended_product",
    "times_purchased_together",
]

FILES = {
    "products": (DATA_DIR / "products.csv", PRODUCT_COLUMNS),
    "transactions": (DATA_DIR / "transactions.csv", TRANSACTION_COLUMNS),
    "transaction_items": (DATA_DIR / "transaction_items.csv", ITEM_COLUMNS),
    "recommendations": (DATA_DIR / "recommendations.csv", RECOMMENDATION_COLUMNS),
    "demo_transaction_items": (DATA_DIR / "demo_transaction_items.csv", ITEM_COLUMNS),
}


DEFAULT_PRODUCTS = [
    {"product_id": "P001", "product_name": "Coca-Cola 330ml", "category": "Beverages", "price": 25.00, "stock_quantity": 50},
    {"product_id": "P002", "product_name": "Mineral Water 500ml", "category": "Beverages", "price": 15.00, "stock_quantity": 60},
    {"product_id": "P003", "product_name": "Iced Tea", "category": "Beverages", "price": 20.00, "stock_quantity": 45},
    {"product_id": "P004", "product_name": "Coffee Sachet", "category": "Beverages", "price": 12.00, "stock_quantity": 40},
    {"product_id": "P005", "product_name": "White Bread", "category": "Bakery", "price": 35.00, "stock_quantity": 30},
    {"product_id": "P006", "product_name": "Pandesal Pack", "category": "Bakery", "price": 30.00, "stock_quantity": 25},
    {"product_id": "P007", "product_name": "Chocolate Cookies", "category": "Snacks", "price": 18.00, "stock_quantity": 35},
    {"product_id": "P008", "product_name": "Potato Chips", "category": "Snacks", "price": 22.00, "stock_quantity": 30},
    {"product_id": "P009", "product_name": "Instant Noodles", "category": "Instant Food", "price": 16.00, "stock_quantity": 40},
    {"product_id": "P010", "product_name": "Cup Noodles", "category": "Instant Food", "price": 32.00, "stock_quantity": 20},
    {"product_id": "P011", "product_name": "Fresh Milk 1L", "category": "Dairy", "price": 92.00, "stock_quantity": 18},
    {"product_id": "P012", "product_name": "Chocolate Milk", "category": "Dairy", "price": 35.00, "stock_quantity": 22},
    {"product_id": "P013", "product_name": "Shampoo Sachet", "category": "Personal Care", "price": 8.00, "stock_quantity": 80},
    {"product_id": "P014", "product_name": "Bath Soap", "category": "Personal Care", "price": 28.00, "stock_quantity": 25},
    {"product_id": "P015", "product_name": "Toothpaste", "category": "Personal Care", "price": 55.00, "stock_quantity": 15},
    {"product_id": "P016", "product_name": "Rice Crackers", "category": "Snacks", "price": 20.00, "stock_quantity": 28},
    {"product_id": "P017", "product_name": "Cheese Bread", "category": "Bakery", "price": 28.00, "stock_quantity": 24},
    {"product_id": "P018", "product_name": "Canned Sardines", "category": "Instant Food", "price": 27.00, "stock_quantity": 32},
]


def file_path(name: str) -> Path:
    """Return the path for a known SmartPOS CSV file."""
    return FILES[name][0]


def initialize_data_files() -> None:
    """Create missing CSV files, including the starter product inventory."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for name, (path, columns) in FILES.items():
        if not path.exists() or path.stat().st_size == 0:
            seed = DEFAULT_PRODUCTS if name == "products" else []
            pd.DataFrame(seed, columns=columns).to_csv(path, index=False)


def read_csv(name: str) -> pd.DataFrame:
    """READ a CSV safely. Missing or empty files return an empty, usable table."""
    initialize_data_files()
    path, columns = FILES[name]
    try:
        frame = pd.read_csv(path)
    except (pd.errors.EmptyDataError, pd.errors.ParserError, FileNotFoundError, UnicodeDecodeError):
        return pd.DataFrame(columns=columns)

    # Keep all expected columns available even if a user edited a CSV manually.
    for column in columns:
        if column not in frame.columns:
            frame[column] = pd.NA
    return frame[columns]


def write_csv(name: str, frame: pd.DataFrame) -> None:
    """WRITE a complete CSV file (used for product edits, updates and deletes)."""
    initialize_data_files()
    path, columns = FILES[name]
    clean_frame = frame.copy()
    for column in columns:
        if column not in clean_frame.columns:
            clean_frame[column] = pd.NA
    clean_frame[columns].to_csv(path, index=False)


def append_records(name: str, records: Iterable[Mapping]) -> None:
    """APPEND records to a CSV without removing its existing history."""
    initialize_data_files()
    path, columns = FILES[name]
    rows = list(records)
    if not rows:
        return
    pd.DataFrame(rows, columns=columns).to_csv(path, mode="a", header=False, index=False)
