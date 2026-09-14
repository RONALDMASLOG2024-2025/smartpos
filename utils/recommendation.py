"""Frequency-based and optional Apriori recommendation processing."""

from itertools import combinations

import pandas as pd

from utils.file_handler import RECOMMENDATION_COLUMNS, read_csv, write_csv


def transaction_items(include_demo: bool = False) -> pd.DataFrame:
    """Return real transaction items, with optional clearly separate demo baskets."""
    actual = read_csv("transaction_items")
    if include_demo:
        demo = read_csv("demo_transaction_items")
        if actual.empty:
            return demo.copy()
        if demo.empty:
            return actual
        return pd.concat([actual, demo], ignore_index=True)
    return actual


def frequency_recommendations(include_demo: bool = False) -> pd.DataFrame:
    """PROCESS baskets to count products that appear together in a transaction."""
    items = transaction_items(include_demo)
    if items.empty:
        return pd.DataFrame(columns=RECOMMENDATION_COLUMNS)

    items = items.dropna(subset=["transaction_id", "product_id", "product_name"]).copy()
    pairs: list[dict] = []
    for _, basket in items.groupby("transaction_id"):
        unique_products = basket.drop_duplicates("product_id")[["product_id", "product_name"]].to_dict("records")
        for first, second in combinations(unique_products, 2):
            # Store both directions so Bread can recommend Coffee and vice versa.
            pairs.extend([
                {"product_id": first["product_id"], "product": first["product_name"], "recommended_product_id": second["product_id"], "recommended_product": second["product_name"]},
                {"product_id": second["product_id"], "product": second["product_name"], "recommended_product_id": first["product_id"], "recommended_product": first["product_name"]},
            ])
    if not pairs:
        return pd.DataFrame(columns=RECOMMENDATION_COLUMNS)
    result = pd.DataFrame(pairs).groupby(
        ["product_id", "product", "recommended_product_id", "recommended_product"], as_index=False
    ).size().rename(columns={"size": "times_purchased_together"})
    return result.sort_values("times_purchased_together", ascending=False).reset_index(drop=True)


def save_recommendations(include_demo: bool = False) -> pd.DataFrame:
    """Write the current calculated recommendation table to recommendations.csv."""
    recommendations = frequency_recommendations(include_demo)
    write_csv("recommendations", recommendations)
    return recommendations


def recommend_for_cart(product_ids: list[str]) -> dict | None:
    """Return the best real-history recommendation not already in the cart."""
    if not product_ids:
        return None
    recommendations = frequency_recommendations(include_demo=False)
    candidates = recommendations[
        recommendations["product_id"].isin(product_ids)
        & ~recommendations["recommended_product_id"].isin(product_ids)
    ]
    if candidates.empty:
        return None
    ranked = candidates.groupby(
        ["recommended_product_id", "recommended_product"], as_index=False
    )["times_purchased_together"].sum().sort_values("times_purchased_together", ascending=False)
    return ranked.iloc[0].to_dict()


def association_rules_table(include_demo: bool = False) -> tuple[pd.DataFrame | None, str | None]:
    """Optional Apriori extension; it stays safe when mlxtend is unavailable."""
    items = transaction_items(include_demo)
    basket_count = items["transaction_id"].nunique() if not items.empty else 0
    if basket_count < 3:
        return None, "More transaction data is needed to generate Machine Learning recommendations."
    try:
        from mlxtend.frequent_patterns import apriori, association_rules
        from mlxtend.preprocessing import TransactionEncoder
    except ImportError:
        return None, "Install mlxtend from requirements.txt to use the optional Apriori analysis."

    baskets = items.groupby("transaction_id")["product_name"].apply(lambda values: sorted(set(values))).tolist()
    encoder = TransactionEncoder()
    encoded = encoder.fit(baskets).transform(baskets)
    frequent = apriori(pd.DataFrame(encoded, columns=encoder.columns_), min_support=0.2, use_colnames=True)
    if frequent.empty:
        return None, "More transaction data is needed to generate Machine Learning recommendations."
    rules = association_rules(frequent, metric="confidence", min_threshold=0.0)
    if rules.empty:
        return None, "No association rules were found yet."
    rules = rules[(rules["antecedents"].map(len) == 1) & (rules["consequents"].map(len) == 1)].copy()
    if rules.empty:
        return None, "No single-product association rules were found yet."
    rules["antecedent"] = rules["antecedents"].map(lambda value: next(iter(value)))
    rules["consequent"] = rules["consequents"].map(lambda value: next(iter(value)))
    return rules[["antecedent", "consequent", "support", "confidence", "lift"]].sort_values("confidence", ascending=False), None
