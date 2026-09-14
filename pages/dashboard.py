"""Dashboard page: calculated sales and inventory information."""

import pandas as pd
import streamlit as st

from utils.file_handler import read_csv
from utils.product_manager import load_products


LOW_STOCK_THRESHOLD = 10


def peso(value: float) -> str:
    return f"₱{float(value):,.2f}"


def render() -> None:
    st.title("Dashboard")
    st.caption("A live summary calculated from your CSV files.")

    products = load_products()
    transactions = read_csv("transactions")
    items = read_csv("transaction_items")
    transactions["total"] = pd.to_numeric(transactions["total"], errors="coerce").fillna(0)
    items["quantity"] = pd.to_numeric(items["quantity"], errors="coerce").fillna(0).astype(int)

    total_sales = transactions["total"].sum()
    total_transactions = len(transactions)
    low_stock = products[products["stock_quantity"] < LOW_STOCK_THRESHOLD]
    most_sold = "—"
    if not items.empty:
        most_sold = items.groupby("product_name")["quantity"].sum().sort_values(ascending=False).index[0]

    metrics = st.columns(5)
    metrics[0].metric("Total sales", peso(total_sales))
    metrics[1].metric("Transactions", total_transactions)
    metrics[2].metric("Products", len(products))
    metrics[3].metric("Low stock", len(low_stock), help=f"Fewer than {LOW_STOCK_THRESHOLD} units")
    metrics[4].metric("Most sold", most_sold)

    left, right = st.columns(2)
    with left:
        st.subheader("Sales by product")
        if items.empty:
            st.info("Complete a sale to see product sales here.")
        else:
            items["subtotal"] = pd.to_numeric(items["subtotal"], errors="coerce").fillna(0)
            sales = items.groupby("product_name")["subtotal"].sum().sort_values(ascending=False)
            st.bar_chart(sales)
    with right:
        st.subheader("Units sold")
        if items.empty:
            st.info("Complete a sale to see quantities sold here.")
        else:
            quantities = items.groupby("product_name")["quantity"].sum().sort_values(ascending=False)
            st.bar_chart(quantities)

    st.subheader("Recent transactions")
    if transactions.empty:
        st.info("No completed transactions yet.")
    else:
        recent = transactions.tail(8).iloc[::-1].copy()
        recent["total"] = recent["total"].map(peso)
        recent["payment"] = pd.to_numeric(recent["payment"], errors="coerce").fillna(0).map(peso)
        recent["change"] = pd.to_numeric(recent["change"], errors="coerce").fillna(0).map(peso)
        st.dataframe(
            recent.rename(columns={
                "transaction_id": "Transaction ID", "datetime": "Date & time", "total": "Total",
                "payment": "Payment", "change": "Change",
            }),
            use_container_width=True,
            hide_index=True,
        )

    if not low_stock.empty:
        st.subheader("Low-stock products")
        st.dataframe(
            low_stock[["product_id", "product_name", "stock_quantity"]].rename(columns={
                "product_id": "Product ID", "product_name": "Product", "stock_quantity": "Stock",
            }),
            use_container_width=True,
            hide_index=True,
        )
