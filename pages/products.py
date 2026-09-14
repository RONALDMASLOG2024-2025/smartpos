"""Products page: CSV-backed product management."""

import streamlit as st

from utils.product_manager import add_product, delete_product, edit_product, load_products, update_stock


def _product_table(products):
    display = products.copy()
    display["price"] = display["price"].map(lambda value: f"₱{float(value):,.2f}")
    return display.rename(columns={
        "product_id": "Product ID", "product_name": "Product Name", "category": "Category",
        "price": "Price", "stock_quantity": "Stock",
    })


def render() -> None:
    st.title("Products")
    st.caption("Add, edit, delete and restock products stored in data/products.csv.")
    notice = st.session_state.pop("products_notice", None)
    if notice:
        st.success(notice)
    products = load_products()

    browse_tab, add_tab, edit_tab, stock_tab, delete_tab = st.tabs([
        "Browse", "Add product", "Edit product", "Update stock", "Delete product"
    ])

    with browse_tab:
        filters = st.columns([2, 1])
        search = filters[0].text_input("Search products", placeholder="Name or Product ID")
        categories = sorted(products["category"].dropna().unique().tolist())
        category = filters[1].selectbox("Category", ["All categories", *categories])
        filtered = products.copy()
        if search.strip():
            term = search.strip()
            filtered = filtered[
                filtered["product_name"].str.contains(term, case=False, na=False, regex=False)
                | filtered["product_id"].str.contains(term, case=False, na=False, regex=False)
            ]
        if category != "All categories":
            filtered = filtered[filtered["category"] == category]
        st.dataframe(_product_table(filtered), use_container_width=True, hide_index=True)
        st.caption(f"Showing {len(filtered)} of {len(products)} products.")

    with add_tab:
        with st.form("add_product_form", clear_on_submit=True):
            columns = st.columns(2)
            product_id = columns[0].text_input("Product ID", placeholder="Example: P019")
            product_name = columns[1].text_input("Product name")
            category = columns[0].text_input("Category", placeholder="Example: Snacks")
            price = columns[1].number_input("Price (₱)", min_value=0.0, step=0.5, format="%.2f")
            stock = columns[0].number_input("Starting stock", min_value=0, step=1)
            submitted = st.form_submit_button("Add product", type="primary")
        if submitted:
            success, message = add_product(product_id, product_name, category, price, stock)
            (st.success if success else st.error)(message)
            if success:
                st.session_state.products_notice = message
                st.rerun()

    with edit_tab:
        if products.empty:
            st.info("Add a product before editing.")
        else:
            selected_id = st.selectbox("Product to edit", products["product_id"].tolist(), key="product_edit_selector")
            current = products.loc[products["product_id"] == selected_id].iloc[0]
            with st.form("edit_product_form"):
                columns = st.columns(2)
                product_id = columns[0].text_input("Product ID", value=current["product_id"], key=f"edit_id_{selected_id}")
                product_name = columns[1].text_input("Product name", value=current["product_name"], key=f"edit_name_{selected_id}")
                category = columns[0].text_input("Category", value=current["category"], key=f"edit_category_{selected_id}")
                price = columns[1].number_input("Price (₱)", min_value=0.0, value=float(current["price"]), step=0.5, format="%.2f", key=f"edit_price_{selected_id}")
                stock = columns[0].number_input("Stock quantity", min_value=0, value=int(current["stock_quantity"]), step=1, key=f"edit_stock_{selected_id}")
                submitted = st.form_submit_button("Save changes", type="primary")
            if submitted:
                success, message = edit_product(selected_id, product_id, product_name, category, price, stock)
                (st.success if success else st.error)(message)
                if success:
                    st.session_state.products_notice = message
                    st.rerun()

    with stock_tab:
        if products.empty:
            st.info("No products available.")
        else:
            selected_id = st.selectbox("Product to restock", products["product_id"].tolist(), key="stock_selector")
            current = products.loc[products["product_id"] == selected_id].iloc[0]
            st.write(f"**{current['product_name']}** — current stock: {int(current['stock_quantity'])}")
            with st.form("update_stock_form"):
                new_stock = st.number_input("New stock quantity", min_value=0, value=int(current["stock_quantity"]), step=1)
                submitted = st.form_submit_button("Update stock")
            if submitted:
                success, message = update_stock(selected_id, new_stock)
                (st.success if success else st.error)(message)
                if success:
                    st.session_state.products_notice = message
                    st.rerun()

    with delete_tab:
        if products.empty:
            st.info("No products available.")
        else:
            selected_id = st.selectbox("Product to delete", products["product_id"].tolist(), key="delete_selector")
            current = products.loc[products["product_id"] == selected_id].iloc[0]
            st.warning(f"Delete **{current['product_name']}**? This does not delete completed transactions.")
            with st.form("delete_product_form"):
                confirm = st.checkbox("I understand this removes the product from the inventory list.")
                submitted = st.form_submit_button("Delete product")
            if submitted:
                if not confirm:
                    st.error("Please confirm before deleting the product.")
                else:
                    success, message = delete_product(selected_id)
                    (st.success if success else st.error)(message)
                    if success:
                        st.session_state.products_notice = message
                        st.rerun()
