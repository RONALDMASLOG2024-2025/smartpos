"""SmartPOS entry point. Run with: streamlit run app.py"""

import streamlit as st

from pages import dashboard, pos, products, recommendations, transactions, welcome
from utils.file_handler import initialize_data_files


st.set_page_config(page_title="SmartPOS | Point of sale for small shops", page_icon="🛒", layout="wide")
initialize_data_files()

st.markdown(
    """
    <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap');
        :root {
            --ink: #1d302d;
            --muted: #60736d;
            --green: #176e58;
            --coral: #db7653;
            --line: #dce5df;
            --surface: #ffffff;
        }
        html, body, [class*="st-"]:not([data-testid="stIconMaterial"]) { font-family: 'DM Sans', sans-serif; }
        [data-testid="stAppViewContainer"] { background: #f5f8f5; color: var(--ink); }
        [data-testid="stHeader"] { background: transparent; }
        .block-container { max-width: 1360px; padding-top: 2.8rem; padding-bottom: 4rem; }
        h1, h2, h3, [data-testid="stMetricValue"] { font-family: 'Manrope', sans-serif; letter-spacing: 0; }
        h1 { font-size: 2.7rem !important; font-weight: 800 !important; color: var(--ink); }
        h2, h3 { color: var(--ink); }
        [data-testid="stCaptionContainer"] { color: var(--muted); }
        [data-testid="stSidebar"] { background: #193a32; border-right: 1px solid #31564b; }
        [data-testid="stSidebar"] [data-testid="stSidebarUserContent"] { padding-top: 2rem; }
        [data-testid="stSidebarCollapseButton"] { visibility: visible !important; }
        [data-testid="stSidebar"] p, [data-testid="stSidebar"] label,
        [data-testid="stSidebar"] [data-testid="stCaptionContainer"] { color: #c1d3c9; }
        .brand { display: flex; align-items: center; gap: 12px; margin: 0 0 2.5rem; }
        .brand-mark { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 10px; background: #d9efb7; color: #193a32; font: 800 25px 'Manrope', sans-serif; }
        .brand-name { color: white; font: 800 21px 'Manrope', sans-serif; line-height: 1.1; }
        .brand-caption { color: #a9c4b5; font-size: 12px; margin-top: 3px; }
        .sidebar-label { color: #90b6a3; font-size: 11px; font-weight: 700; letter-spacing: 0; margin-bottom: 10px; }
        [data-testid="stSidebar"] [role="radiogroup"] { gap: 5px; }
        [data-testid="stSidebar"] [role="radiogroup"] label { padding: 10px 12px; border-radius: 8px; color: #d9e7df; font-weight: 600; transition: background .15s ease; }
        [data-testid="stSidebar"] [role="radiogroup"] label:hover { background: #2a5145; }
        [data-testid="stSidebar"] [role="radiogroup"] label:has(input:checked) { background: #d9efb7; color: #193a32; }
        [data-testid="stSidebar"] [role="radiogroup"] label:has(input:checked) p { color: #193a32; }
        [data-testid="stSidebar"] [role="radiogroup"] [data-testid="stWidgetLabel"] { display: none; }
        .sidebar-foot { border-top: 1px solid #426256; margin-top: 2.5rem; padding-top: 1.2rem; color: #b9d1c2; font-size: 13px; line-height: 1.6; }
        .sidebar-foot strong { color: #e3f4df; }
        [data-testid="stMetric"] { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 20px; min-height: 130px; }
        [data-testid="stMetricLabel"] { color: var(--muted); }
        [data-testid="stMetricValue"] { color: var(--ink); font-size: 1.7rem; }
        div.stButton > button[kind="primary"], div.stFormSubmitButton > button[kind="primary"] { background: var(--green); border: 1px solid var(--green); color: white; }
        div.stButton > button[kind="primary"]:hover, div.stFormSubmitButton > button[kind="primary"]:hover { background: #105440; border-color: #105440; color: white; }
        div.stButton > button[kind="secondary"], div.stFormSubmitButton > button[kind="secondary"] { background: var(--surface); border: 1px solid #c6d6cb; color: var(--ink); }
        div.stButton > button[kind="secondary"]:hover, div.stFormSubmitButton > button[kind="secondary"]:hover { background: #e7f0e9; border-color: var(--green); color: var(--ink); }
        div.stButton > button, div.stFormSubmitButton > button { border-radius: 7px; font-weight: 700; min-height: 42px; }
        [data-testid="stDataFrame"], [data-testid="stForm"], [data-testid="stPlotlyChart"] { border-radius: 8px; overflow: hidden; }
        [data-testid="stTabs"] [role="tablist"] { border-bottom: 1px solid var(--line); gap: 12px; }
        [data-testid="stTabs"] [role="tab"] { font-weight: 700; }
        [data-testid="stTabs"] [aria-selected="true"] { color: var(--green); }
        @media (max-width: 700px) {
            .block-container { padding-top: 1.2rem; padding-bottom: 2rem; }
            h1 { font-size: 2rem !important; }
            [data-testid="stMetric"] { min-height: 105px; padding: 14px; }
        }
    </style>
    """,
    unsafe_allow_html=True,
)

st.sidebar.markdown(
    '<div class="brand"><span class="brand-mark">S</span><div><div class="brand-name">smartpos</div>'
    '<div class="brand-caption">A better way to run the counter.</div></div></div>',
    unsafe_allow_html=True,
)
st.sidebar.markdown('<div class="sidebar-label">WORKSPACE</div>', unsafe_allow_html=True)
page_name = st.sidebar.radio(
    "Navigation",
    ["Home", "Dashboard", "POS", "Products", "Transactions", "Recommendations", "How it works"],
    label_visibility="collapsed",
    key="navigation",
)
st.sidebar.markdown(
    '<div class="sidebar-foot"><strong>Your data stays local.</strong><br>'
    'Products and sales are saved as CSV files on this device.</div>',
    unsafe_allow_html=True,
)

PAGES = {
    "Home": welcome.render_home,
    "Dashboard": dashboard.render,
    "POS": pos.render,
    "Products": products.render,
    "Transactions": transactions.render,
    "Recommendations": recommendations.render,
    "How it works": welcome.render_guide,
}
PAGES[page_name]()
