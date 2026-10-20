"""Unit tests that run on your machine with no workspace: Testing panel, or `uv run pytest`."""

import pandas as pd

from orders_demo import clean_orders, daily_revenue, sample_orders


def test_clean_orders_drops_bad_rows():
    cleaned = clean_orders(sample_orders())
    # Order 3 has no customer, 4 has quantity 0, 7 has an unknown status.
    assert cleaned["order_id"].tolist() == [1, 2, 5, 6, 8]


def test_clean_orders_normalizes_status_and_adds_revenue():
    cleaned = clean_orders(sample_orders())
    shipped = cleaned[cleaned["order_id"] == 2].iloc[0]
    assert shipped["status"] == "shipped"
    assert shipped["revenue"] == 20.0


def test_daily_revenue_leaves_out_cancelled_orders():
    totals = daily_revenue(clean_orders(sample_orders()))
    assert totals.to_dict("records") == [
        {"order_date": pd.Timestamp("2026-01-01").date(), "category": "books", "orders": 2, "revenue": 40.0},
        {"order_date": pd.Timestamp("2026-01-02").date(), "category": "games", "orders": 1, "revenue": 15.0},
        {"order_date": pd.Timestamp("2026-01-03").date(), "category": "games", "orders": 1, "revenue": 25.0},
    ]
