"""Recommendations page: frequency analysis plus optional Apriori rules."""

import streamlit as st

from utils.recommendation import association_rules_table, frequency_recommendations, save_recommendations, transaction_items


def render() -> None:
    st.title("Recommendations")
    st.caption("Find products that are frequently purchased in the same transaction.")

    include_demo = st.checkbox(
        "Include supplied demo baskets", value=True,
        help="Demo baskets are stored separately in data/demo_transaction_items.csv and never affect sales or inventory.",
    )
    items = transaction_items(include_demo)
    actual_items = transaction_items(include_demo=False)
    st.info(
        f"Analyzing {items['transaction_id'].nunique() if not items.empty else 0} basket(s). "
        f"Real POS history currently has {actual_items['transaction_id'].nunique() if not actual_items.empty else 0} basket(s)."
    )

    recommendations = frequency_recommendations(include_demo)
    if recommendations.empty:
        st.warning("More transaction data is needed to generate product recommendations.")
    else:
        st.subheader("Frequently purchased together")
        display = recommendations[["product", "recommended_product", "times_purchased_together"]].rename(columns={
            "product": "Product", "recommended_product": "Recommended Product",
            "times_purchased_together": "Times Purchased Together",
        })
        st.dataframe(display, use_container_width=True, hide_index=True)
        if st.button("Save calculated recommendations to CSV"):
            save_recommendations(include_demo)
            st.success("Calculated recommendations were saved to data/recommendations.csv.")

    with st.expander("Optional Machine Learning: Apriori association rules"):
        st.write("This optional extension uses mlxtend to calculate support, confidence and lift from the same baskets.")
        if st.button("Generate Apriori rules"):
            rules, message = association_rules_table(include_demo)
            if message:
                st.info(message)
            else:
                formatted = rules.copy()
                for column in ["support", "confidence", "lift"]:
                    formatted[column] = formatted[column].map(lambda value: f"{float(value):.2f}")
                st.dataframe(formatted.rename(columns={
                    "antecedent": "Antecedent", "consequent": "Consequent", "support": "Support",
                    "confidence": "Confidence", "lift": "Lift",
                }), use_container_width=True, hide_index=True)
