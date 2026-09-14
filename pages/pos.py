"""POS checkout page and temporary Streamlit cart."""

import streamlit as st

from utils.product_manager import load_products
from utils.recommendation import recommend_for_cart
from utils.transaction_manager import cart_total, complete_transaction


def _cart() -> list[dict]:
    if "cart" not in st.session_state:
        st.session_state.cart = []
    return st.session_state.cart


def _add_to_cart(product: dict, quantity: int = 1) -> tuple[bool, str]:
    cart = _cart()
    current_quantity = sum(int(item["quantity"]) for item in cart if item["product_id"] == product["product_id"])
    if current_quantity + quantity > int(product["stock_quantity"]):
        return False, f"Only {int(product['stock_quantity'])} unit(s) of {product['product_name']} are available."
    for item in cart:
        if item["product_id"] == product["product_id"]:
            item["quantity"] += quantity
            return True, f"Updated {product['product_name']} in the cart."
    cart.append({
        "product_id": product["product_id"], "product_name": product["product_name"],
        "unit_price": float(product["price"]), "quantity": int(quantity),
    })
    return True, f"Added {product['product_name']} to the cart."


def render() -> None:
    st.title("POS / Checkout")
    st.caption("Select products, build a cart, then complete a CSV-backed sale.")
    notice = st.session_state.pop("pos_notice", None)
    if notice:
        st.success(notice)
    products = load_products()
    available = products[products["stock_quantity"] > 0].copy()
    cart = _cart()

    add_column, cart_column = st.columns([1, 1.25], gap="large")
    with add_column:
        st.subheader("Add to cart")
        if available.empty:
            st.warning("There are no products with available stock.")
        else:
            search = st.text_input("Search available products", placeholder="Name or Product ID", key="pos_search")
            filtered = available
            if search.strip():
                term = search.strip()
                filtered = available[
                    available["product_name"].str.contains(term, case=False, na=False, regex=False)
                    | available["product_id"].str.contains(term, case=False, na=False, regex=False)
                ]
            if filtered.empty:
                st.info("No available products match that search.")
            else:
                product_ids = filtered["product_id"].tolist()
                selected_id = st.selectbox(
                    "Product", product_ids,
                    format_func=lambda value: (
                        f"{value} — {filtered.loc[filtered['product_id'] == value].iloc[0]['product_name']} "
                        f"(₱{float(filtered.loc[filtered['product_id'] == value].iloc[0]['price']):,.2f})"
                    ),
                )
                selected = filtered.loc[filtered["product_id"] == selected_id].iloc[0]
                quantity = st.number_input(
                    f"Quantity (in stock: {int(selected['stock_quantity'])})", min_value=1,
                    max_value=int(selected["stock_quantity"]), value=1, step=1,
                )
                if st.button("Add to cart", type="primary", use_container_width=True):
                    success, message = _add_to_cart(selected.to_dict(), int(quantity))
                    (st.success if success else st.error)(message)
                    if success:
                        st.session_state.pos_notice = message
                        st.rerun()

        if cart:
            recommendation = recommend_for_cart([item["product_id"] for item in cart])
            if recommendation:
                recommended_id = recommendation["recommended_product_id"]
                record = products.loc[products["product_id"] == recommended_id]
                if not record.empty and int(record.iloc[0]["stock_quantity"]) > 0:
                    suggested = record.iloc[0]
                    st.info(
                        f"Suggested: **{suggested['product_name']}** — frequently purchased with your cart "
                        f"({int(recommendation['times_purchased_together'])} time(s))."
                    )
                    if st.button(f"Add suggested {suggested['product_name']}", key=f"recommend_{recommended_id}"):
                        success, message = _add_to_cart(suggested.to_dict())
                        (st.success if success else st.error)(message)
                        if success:
                            st.session_state.pos_notice = message
                            st.rerun()

    with cart_column:
        st.subheader("Current cart")
        if not cart:
            st.info("Your cart is empty.")
        else:
            st.caption("Change quantities or remove an item before payment.")
            for item in list(cart):
                product = products.loc[products["product_id"] == item["product_id"]]
                maximum = int(product.iloc[0]["stock_quantity"]) if not product.empty else int(item["quantity"])
                columns = st.columns([3, 1.2, 1.4, 0.8])
                columns[0].markdown(
                    f"**{item['product_name']}**<br>₱{float(item['unit_price']):,.2f} each",
                    unsafe_allow_html=True,
                )
                item["quantity"] = columns[1].number_input(
                    "Qty", min_value=1, max_value=max(1, maximum), value=min(int(item["quantity"]), max(1, maximum)),
                    step=1, key=f"cart_quantity_{item['product_id']}", label_visibility="collapsed",
                )
                columns[2].write(f"₱{float(item['unit_price']) * int(item['quantity']):,.2f}")
                if columns[3].button("Remove", key=f"remove_{item['product_id']}"):
                    st.session_state.cart = [entry for entry in cart if entry["product_id"] != item["product_id"]]
                    st.rerun()

            total = cart_total(_cart())
            st.divider()
            st.markdown(f"### Total: ₱{total:,.2f}")
            payment = st.number_input("Customer payment (₱)", min_value=0.0, value=0.0, step=1.0, format="%.2f", key="pos_payment")
            if payment >= total:
                st.success(f"Change: ₱{payment - total:,.2f}")
            else:
                st.warning(f"Amount still needed: ₱{total - payment:,.2f}")
            if st.button("Complete transaction", type="primary", use_container_width=True):
                success, message, _ = complete_transaction(_cart(), float(payment))
                (st.success if success else st.error)(message)
                if success:
                    st.session_state.cart = []
                    st.session_state.pos_notice = message
                    st.rerun()
