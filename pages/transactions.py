"""Transaction history page using transactions.csv and transaction_items.csv."""

from datetime import date

import pandas as pd
import streamlit as st

from utils.file_handler import read_csv


def _peso(value: float) -> str:
    return f"₱{float(value):,.2f}"


def render() -> None:
    st.title("Transactions")
    st.caption("Every completed sale is kept in CSV files and can be inspected here.")
    transactions = read_csv("transactions")
    items = read_csv("transaction_items")
    if transactions.empty:
        st.info("No completed transactions yet. Complete a sale in the POS page to build history.")
        return

    transactions["parsed_datetime"] = pd.to_datetime(transactions["datetime"], errors="coerce")
    transactions["total"] = pd.to_numeric(transactions["total"], errors="coerce").fillna(0)
    transactions["payment"] = pd.to_numeric(transactions["payment"], errors="coerce").fillna(0)
    transactions["change"] = pd.to_numeric(transactions["change"], errors="coerce").fillna(0)

    controls = st.columns([2, 1, 1])
    search = controls[0].text_input("Search Transaction ID")
    use_date = controls[1].checkbox("Filter by date")
    selected_date = controls[2].date_input("Date", value=date.today(), disabled=not use_date)
    filtered = transactions.copy()
    if search.strip():
        filtered = filtered[filtered["transaction_id"].astype(str).str.contains(search.strip(), case=False, regex=False)]
    if use_date:
        filtered = filtered[filtered["parsed_datetime"].dt.date == selected_date]

    if filtered.empty:
        st.warning("No transactions match the selected filters.")
        return
    display = filtered.drop(columns="parsed_datetime").sort_values("datetime", ascending=False).copy()
    for column in ["total", "payment", "change"]:
        display[column] = display[column].map(_peso)
    st.dataframe(display.rename(columns={
        "transaction_id": "Transaction ID", "datetime": "Date & time", "total": "Total",
        "payment": "Payment", "change": "Change",
    }), use_container_width=True, hide_index=True)

    selected_id = st.selectbox("View transaction details", filtered.sort_values("datetime", ascending=False)["transaction_id"].tolist())
    transaction = transactions.loc[transactions["transaction_id"] == selected_id].iloc[0]
    transaction_items = items.loc[items["transaction_id"] == selected_id].copy()
    transaction_items["quantity"] = pd.to_numeric(transaction_items["quantity"], errors="coerce").fillna(0).astype(int)
    transaction_items["unit_price"] = pd.to_numeric(transaction_items["unit_price"], errors="coerce").fillna(0)
    transaction_items["subtotal"] = pd.to_numeric(transaction_items["subtotal"], errors="coerce").fillna(0)

    st.subheader(f"Transaction {selected_id}")
    st.write(f"Date & time: {transaction['datetime']}")
    item_display = transaction_items[["product_id", "product_name", "quantity", "unit_price", "subtotal"]].copy()
    item_display["unit_price"] = item_display["unit_price"].map(_peso)
    item_display["subtotal"] = item_display["subtotal"].map(_peso)
    st.dataframe(item_display.rename(columns={
        "product_id": "Product ID", "product_name": "Product", "quantity": "Quantity",
        "unit_price": "Unit price", "subtotal": "Subtotal",
    }), use_container_width=True, hide_index=True)
    metrics = st.columns(3)
    metrics[0].metric("Total", _peso(transaction["total"]))
    metrics[1].metric("Payment", _peso(transaction["payment"]))
    metrics[2].metric("Change", _peso(transaction["change"]))
