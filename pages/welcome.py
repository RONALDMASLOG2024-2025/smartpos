"""Welcome and product walkthrough pages."""

from base64 import b64encode
from pathlib import Path

import streamlit as st


def _navigate(destination: str) -> None:
    st.session_state.navigation = destination


def _styles() -> None:
    st.markdown(
        """
        <style>
            .home-hero { min-height: 420px; padding: 55px 6%; display: flex; flex-direction: column;
                justify-content: center; background-size: cover; background-position: center 54%; color: white; }
            .hero-eyebrow, .section-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0; text-transform: uppercase; }
            .hero-eyebrow { color: #def5bd; }
            .home-hero h1 { color: #fff !important; font-size: 4.5rem !important; line-height: 1.08; margin: 18px 0 12px; }
            .home-hero p { max-width: 520px; color: #f1f7ef; font-size: 1.3rem; line-height: 1.55; margin: 0; }
            .hero-meta { margin-top: 34px; color: #d7e9d9; font-size: 12px; font-weight: 700; letter-spacing: 0; }
            .hero-actions { padding: 18px 0 6px; }
            .section-eyebrow { color: #ad533a; margin-bottom: 8px; }
            .section-head { max-width: 690px; padding: 55px 0 25px; }
            .section-head h2 { font-size: 2rem; font-weight: 800; line-height: 1.25; margin: 0 0 10px; }
            .section-head p, .guide-intro { color: #52675d; font-size: 1.05rem; line-height: 1.7; }
            .feature-grid, .step-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 34px; }
            .feature, .step { border-top: 2px solid #1e7059; padding: 20px 0 28px; }
            .feature-number { color: #ae583e; font-size: 12px; font-weight: 800; }
            .feature h3, .step h3 { font-size: 1.2rem; margin: 14px 0 8px; }
            .feature p, .step p { color: #52675d; line-height: 1.65; margin: 0; }
            .step-grid { padding-bottom: 38px; }
            .guide-head { padding: 25px 0 30px; border-bottom: 1px solid #dce5df; }
            .guide-head h1 { margin: 10px 0; }
            .guide-intro { max-width: 690px; margin: 0; }
            .guide-row { display: grid; grid-template-columns: 70px minmax(0, 1fr); gap: 18px;
                padding: 29px 0; border-bottom: 1px solid #dce5df; }
            .guide-number { color: #ae583e; font: 800 1.5rem 'Manrope', sans-serif; }
            .guide-row h2 { font-size: 1.25rem; margin: 0 0 7px; }
            .guide-row p { max-width: 770px; color: #52675d; line-height: 1.7; margin: 0; }
            .guide-note { margin: 34px 0; padding: 19px 23px; background: #e7f0e9;
                border-left: 3px solid #176e58; color: #29483b; line-height: 1.6; }
            @media (max-width: 700px) {
                .home-hero { min-height: 330px; padding: 34px 7%; background-position: 58% center; }
                .home-hero h1 { font-size: 2.8rem !important; }
                .home-hero p { font-size: 1.05rem; }
                .hero-meta { margin-top: 20px; }
                .section-head { padding-top: 32px; }
                .section-head h2 { font-size: 1.55rem; }
                .feature-grid, .step-grid { grid-template-columns: 1fr; gap: 0; }
                .feature, .step { padding: 16px 0 22px; }
                .guide-row { grid-template-columns: 45px minmax(0, 1fr); gap: 10px; }
            }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_home() -> None:
    _styles()
    image_path = Path(__file__).resolve().parents[1] / "public" / "retail-checkout.jpg"
    image = b64encode(image_path.read_bytes()).decode("ascii")
    st.markdown(
        f"""
        <section class="home-hero" style="background-image: linear-gradient(90deg, rgba(12, 39, 30, .93), rgba(12, 39, 30, .58) 58%, rgba(12, 39, 30, .12)), url('data:image/jpeg;base64,{image}')">
            <div class="hero-eyebrow">The everyday point of sale</div>
            <h1>SmartPOS</h1>
            <p>Make every sale feel simple. Keep your shelves, sales, and next best product in one clear place.</p>
            <div class="hero-meta">BUILT FOR SMALL SHOPS &nbsp; / &nbsp; STORED LOCALLY</div>
        </section>
        """,
        unsafe_allow_html=True,
    )
    st.markdown('<div class="hero-actions"></div>', unsafe_allow_html=True)
    start, learn, _ = st.columns([1.1, 1.1, 3])
    start.button("Open checkout", type="primary", use_container_width=True, on_click=_navigate, args=("POS",))
    learn.button("How it works", use_container_width=True, on_click=_navigate, args=("How it works",))

    st.markdown(
        """
        <div class="section-head">
            <div class="section-eyebrow">One place for the daily work</div>
            <h2>Everything you need at the counter.</h2>
            <p>Less switching between notebooks and spreadsheets. More time serving the people in front of you.</p>
        </div>
        <div class="feature-grid">
            <div class="feature"><span class="feature-number">01 / SELL</span><h3>Checkout without the clutter</h3><p>Search products, build a basket, take payment, and see change due before completing a sale.</p></div>
            <div class="feature"><span class="feature-number">02 / STAY READY</span><h3>Know what is on the shelf</h3><p>Add and restock products as you go. Inventory updates automatically after every completed checkout.</p></div>
            <div class="feature"><span class="feature-number">03 / LEARN</span><h3>See what sells together</h3><p>Review sales at a glance and discover product pairs that appear in the same baskets.</p></div>
        </div>
        <div class="section-head">
            <div class="section-eyebrow">How it works</div>
            <h2>From first product to smarter sales.</h2>
        </div>
        <div class="step-grid">
            <div class="step"><span class="feature-number">STEP 01</span><h3>Set up your products</h3><p>Add prices and stock in Products. Your catalogue is ready to search at checkout.</p></div>
            <div class="step"><span class="feature-number">STEP 02</span><h3>Complete a sale</h3><p>Build a cart, enter payment, and complete the transaction. Stock and sales history update together.</p></div>
            <div class="step"><span class="feature-number">STEP 03</span><h3>Spot the patterns</h3><p>Use the Dashboard and Recommendations pages to see trends as your sales history grows.</p></div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_guide() -> None:
    _styles()
    st.markdown(
        """
        <div class="guide-head">
            <div class="section-eyebrow">The workflow</div>
            <h1>How it works</h1>
            <p class="guide-intro">SmartPOS keeps the day-to-day flow in one place, from stocking your shelves to understanding what customers buy together.</p>
        </div>
        <div class="guide-row"><span class="guide-number">01</span><div><h2>Build your catalogue</h2><p>In Products, add a product ID, name, category, price, and starting stock. Search the catalogue, edit details, or update stock whenever deliveries arrive.</p></div></div>
        <div class="guide-row"><span class="guide-number">02</span><div><h2>Ring up a customer</h2><p>In POS, search for available products and add them to the cart. Adjust quantities, enter the amount paid, and review the change. Checkout checks stock and payment before saving the sale.</p></div></div>
        <div class="guide-row"><span class="guide-number">03</span><div><h2>Track what happened</h2><p>Each completed sale records a transaction and its individual items, then reduces stock. Use Transactions to inspect a receipt or Dashboard to see sales, popular products, and low-stock items.</p></div></div>
        <div class="guide-row"><span class="guide-number">04</span><div><h2>Discover useful pairings</h2><p>Recommendations counts products bought in the same basket. You can include separate demo baskets to explore this feature before you have enough real sales; demo data never changes inventory or sales totals.</p></div></div>
        <div class="guide-note"><strong>Local by design.</strong> Products, transactions, and saved recommendations live in CSV files on this device. SmartPOS does not sync them to a cloud service.</div>
        """,
        unsafe_allow_html=True,
    )
    products, checkout, _ = st.columns([1, 1, 3])
    products.button("View products", use_container_width=True, on_click=_navigate, args=("Products",))
    checkout.button("Open checkout", type="primary", use_container_width=True, on_click=_navigate, args=("POS",))