"""Plain functions that clean orders and total revenue per day and category.

Each step is a function that takes a DataFrame and returns one, so a test can call it with a few rows.
The pandas versions run anywhere and the unit tests cover them. `spark_daily_revenue` computes the same
total with Spark, so Databricks Connect can run it on serverless compute.
"""

from __future__ import annotations

import pandas as pd

KNOWN_STATUSES = ("placed", "shipped", "delivered", "cancelled")


def sample_orders() -> pd.DataFrame:
    """Eight orders with a few bad rows: a missing customer, a zero quantity, and an unknown status."""
    dates = ["2026-01-01"] * 3 + ["2026-01-02"] * 3 + ["2026-01-03"] * 2
    return pd.DataFrame(
        {
            "order_id": [1, 2, 3, 4, 5, 6, 7, 8],
            "customer_id": ["c1", "c2", None, "c1", "c3", "c2", "c3", "c1"],
            "order_date": pd.to_datetime(dates).date,
            "category": ["books", "books", "games", "games", "books", "games", "books", "games"],
            "quantity": [2, 1, 3, 0, 4, 1, 1, 2],
            "unit_price": [10.0, 20.0, 5.0, 8.0, 10.0, 15.0, 20.0, 12.5],
            "status": ["delivered", "Shipped ", "placed", "placed", "cancelled", "delivered", "unknown", "delivered"],
        }
    )


def clean_orders(orders: pd.DataFrame) -> pd.DataFrame:
    """Drop orders with no customer, a quantity of zero or less, or an unknown status; add `revenue`.

    Status is trimmed and lower-cased first, so "Shipped " counts as "shipped".
    """
    cleaned = orders.assign(status=orders["status"].str.strip().str.lower())
    keep = cleaned["customer_id"].notna() & (cleaned["quantity"] > 0) & cleaned["status"].isin(KNOWN_STATUSES)
    cleaned = cleaned[keep]
    return cleaned.assign(revenue=cleaned["quantity"] * cleaned["unit_price"]).reset_index(drop=True)


def daily_revenue(orders: pd.DataFrame) -> pd.DataFrame:
    """Orders and revenue per day and category, leaving out cancelled orders."""
    kept = orders[orders["status"] != "cancelled"]
    totals = (
        kept.groupby(["order_date", "category"], as_index=False)
        .agg(orders=("order_id", "count"), revenue=("revenue", "sum"))
        .sort_values(["order_date", "category"])
    )
    return totals.reset_index(drop=True)


def spark_daily_revenue(orders):
    """The same total as `daily_revenue`, for a Spark DataFrame of cleaned orders.

    Runs through Databricks Connect on your machine and as-is on Databricks. The import sits inside
    the function so the pandas code above needs no Spark.
    """
    from pyspark.sql import functions as F

    return (
        orders.where(F.col("status") != "cancelled")
        .groupBy("order_date", "category")
        .agg(F.count("order_id").alias("orders"), F.sum("revenue").alias("revenue"))
        .orderBy("order_date", "category")
    )
