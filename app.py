"""SmartPOS entry point. Run with: streamlit run app.py"""

import streamlit as st

from pages import dashboard, pos, products, recommendations, transactions
from utils.file_handler import initialize_data_files


st.set_page_config(page_title="SmartPOS", page_icon="🛒", layout="wide")
initialize_data_files()

st.markdown(
    """
    <style>
        [data-testid="stSidebar"] { background: #f7f8fc; }
        .block-container { padding-top: 2rem; padding-bottom: 2rem; }
    </style>
    """,
    unsafe_allow_html=True,
)

st.sidebar.title("🛒 SmartPOS")
st.sidebar.caption("Simple CSV-based point of sale")
page_name = st.sidebar.radio(
    "Navigation",
    ["Dashboard", "POS", "Products", "Transactions", "Recommendations"],
)
st.sidebar.divider()
st.sidebar.info("Data is stored locally in the data folder as CSV files.")

PAGES = {
    "Dashboard": dashboard.render,
    "POS": pos.render,
    "Products": products.render,
    "Transactions": transactions.render,
    "Recommendations": recommendations.render,
}
PAGES[page_name]()
