"""Product validation and CRUD operations for products.csv."""

import pandas as pd

from utils.file_handler import read_csv, write_csv


def load_products() -> pd.DataFrame:
    """Load products and normalize numeric values from the CSV file."""
    products = read_csv("products")
    products["product_id"] = products["product_id"].fillna("").astype(str).str.strip().str.upper()
    products["product_name"] = products["product_name"].fillna("").astype(str).str.strip()
    products["category"] = products["category"].fillna("").astype(str).str.strip()
    products["price"] = pd.to_numeric(products["price"], errors="coerce").fillna(0.0)
    products["stock_quantity"] = pd.to_numeric(products["stock_quantity"], errors="coerce").fillna(0).astype(int)
    return products


def validate_product(product_id: str, name: str, category: str, price: float, stock: int) -> str | None:
    """Return a validation message, or None when a product is valid."""
    if not product_id.strip():
        return "Product ID is required."
    if not name.strip():
        return "Product name cannot be empty."
    if not category.strip():
        return "Category is required."
    if price < 0:
        return "Price cannot be negative."
    if stock < 0:
        return "Stock quantity cannot be negative."
    return None


def add_product(product_id: str, name: str, category: str, price: float, stock: int) -> tuple[bool, str]:
    """Add a product after validation (WRITE)."""
    products = load_products()
    product_id = product_id.strip().upper()
    error = validate_product(product_id, name, category, price, stock)
    if error:
        return False, error
    if product_id in set(products["product_id"]):
        return False, "That Product ID already exists."
    new_row = pd.DataFrame([{
        "product_id": product_id,
        "product_name": name.strip(),
        "category": category.strip(),
        "price": round(float(price), 2),
        "stock_quantity": int(stock),
    }])
    write_csv("products", pd.concat([products, new_row], ignore_index=True))
    return True, f"{name.strip()} was added."


def edit_product(original_id: str, product_id: str, name: str, category: str, price: float, stock: int) -> tuple[bool, str]:
    """Update one product record in products.csv (UPDATE)."""
    products = load_products()
    product_id = product_id.strip().upper()
    error = validate_product(product_id, name, category, price, stock)
    if error:
        return False, error
    matches = products["product_id"] == original_id
    if not matches.any():
        return False, "The selected product no longer exists."
    if product_id != original_id and product_id in set(products["product_id"]):
        return False, "That Product ID already exists."
    products.loc[matches, ["product_id", "product_name", "category", "price", "stock_quantity"]] = [
        product_id, name.strip(), category.strip(), round(float(price), 2), int(stock)
    ]
    write_csv("products", products)
    return True, f"{name.strip()} was updated."


def update_stock(product_id: str, stock: int) -> tuple[bool, str]:
    """Set a product stock quantity (UPDATE)."""
    if stock < 0:
        return False, "Stock quantity cannot be negative."
    products = load_products()
    matches = products["product_id"] == product_id
    if not matches.any():
        return False, "The selected product no longer exists."
    products.loc[matches, "stock_quantity"] = int(stock)
    write_csv("products", products)
    return True, "Stock quantity was updated."


def delete_product(product_id: str) -> tuple[bool, str]:
    """Delete a product record from products.csv (DELETE)."""
    products = load_products()
    if product_id not in set(products["product_id"]):
        return False, "The selected product no longer exists."
    write_csv("products", products[products["product_id"] != product_id])
    return True, "Product deleted. Existing transaction history was kept."
