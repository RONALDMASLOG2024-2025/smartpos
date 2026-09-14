"""Cart validation, transaction recording and inventory updates."""

from datetime import datetime

import pandas as pd

from utils.file_handler import append_records, read_csv, write_csv
from utils.product_manager import load_products


def next_transaction_id() -> str:
    """Generate the next sequential ID from saved transaction records."""
    transactions = read_csv("transactions")
    highest = 0
    for transaction_id in transactions["transaction_id"].dropna().astype(str):
        digits = "".join(character for character in transaction_id if character.isdigit())
        if digits:
            highest = max(highest, int(digits))
    return f"T{highest + 1:04d}"


def cart_total(cart: list[dict]) -> float:
    """Calculate the current cart total."""
    return round(sum(float(item["unit_price"]) * int(item["quantity"]) for item in cart), 2)


def validate_cart(cart: list[dict], products: pd.DataFrame | None = None) -> str | None:
    """Ensure the cart is populated and still has enough current stock."""
    if not cart:
        return "The cart is empty."
    products = load_products() if products is None else products
    quantities: dict[str, int] = {}
    for item in cart:
        product_id = str(item.get("product_id", ""))
        quantity = int(item.get("quantity", 0))
        if quantity <= 0:
            return "Each cart quantity must be at least 1."
        quantities[product_id] = quantities.get(product_id, 0) + quantity
    for product_id, quantity in quantities.items():
        matching = products[products["product_id"] == product_id]
        if matching.empty:
            return f"Product {product_id} is no longer available."
        available = int(matching.iloc[0]["stock_quantity"])
        if quantity > available:
            return f"Insufficient stock for {matching.iloc[0]['product_name']}. Available: {available}."
    return None


def complete_transaction(cart: list[dict], payment: float) -> tuple[bool, str, str | None]:
    """APPEND a sale and items, then UPDATE inventory after all validation passes."""
    products = load_products()
    error = validate_cart(cart, products)
    if error:
        return False, error, None
    total = cart_total(cart)
    if payment < total:
        return False, "Payment must be equal to or greater than the total.", None

    transaction_id = next_transaction_id()
    purchased_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    change = round(float(payment) - total, 2)
    transaction_record = {
        "transaction_id": transaction_id,
        "datetime": purchased_at,
        "total": total,
        "payment": round(float(payment), 2),
        "change": change,
    }
    item_records = []
    for item in cart:
        quantity = int(item["quantity"])
        unit_price = round(float(item["unit_price"]), 2)
        item_records.append({
            "transaction_id": transaction_id,
            "product_id": item["product_id"],
            "product_name": item["product_name"],
            "quantity": quantity,
            "unit_price": unit_price,
            "subtotal": round(quantity * unit_price, 2),
        })

    # APPEND preserves every previous completed sale and item.
    append_records("transactions", [transaction_record])
    append_records("transaction_items", item_records)

    # UPDATE inventory only after the checkout records have been written.
    for item in cart:
        matches = products["product_id"] == item["product_id"]
        products.loc[matches, "stock_quantity"] -= int(item["quantity"])
    products["stock_quantity"] = products["stock_quantity"].clip(lower=0).astype(int)
    write_csv("products", products)
    return True, f"Transaction {transaction_id} completed. Change: ₱{change:,.2f}", transaction_id
