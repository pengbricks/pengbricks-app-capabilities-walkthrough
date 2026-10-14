"""Build a three-table chain with SQL so Unity Catalog records lineage: source -> silver -> gold."""

from __future__ import annotations

import argparse

import guide_lib as g


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    prefix = f"{args.catalog}.{args.schema}"
    spec = g.load_spec(args.use_case_file)
    baseline = spec["observability"]["batches"][0]

    # Hop 0: the source table.
    g.build_orders(spark, spec, rows=int(baseline["rows"]), seed_offset=int(baseline["seed_offset"])).write.mode(
        "overwrite"
    ).option("overwriteSchema", "true").saveAsTable(f"{prefix}.obs_source_orders")

    # Hop 1: silver keeps valid rows and rounds amounts.
    spark.sql(
        f"""
        CREATE OR REPLACE TABLE {prefix}.obs_silver_orders AS
        SELECT order_id, customer_id, order_ts, region, status, quantity, ROUND(amount, 2) AS amount
        FROM {prefix}.obs_source_orders
        WHERE amount > 0
        """
    )
    # Hop 2: gold aggregates silver by day and region.
    spark.sql(
        f"""
        CREATE OR REPLACE TABLE {prefix}.obs_gold_daily_revenue AS
        SELECT DATE(order_ts) AS order_date, region, COUNT(*) AS orders, ROUND(SUM(amount), 2) AS revenue
        FROM {prefix}.obs_silver_orders
        GROUP BY DATE(order_ts), region
        """
    )
    for name in ("obs_source_orders", "obs_silver_orders", "obs_gold_daily_revenue"):
        print(name, spark.table(f"{prefix}.{name}").count(), "rows")


if __name__ == "__main__":
    main()
