"""Entry point for the job's Python wheel task: write the daily revenue table.

    orders-demo --catalog <catalog> --schema <schema>

The job runs it on serverless compute. After `uv sync` you can run the same command on your machine:
Databricks Connect sends the Spark work to serverless compute and the table lands in your workspace.
"""

from __future__ import annotations

import argparse
import os

from orders_demo.orders import clean_orders, daily_revenue, sample_orders, spark_daily_revenue


def get_spark():
    """The running Spark session on Databricks, a serverless Databricks Connect session elsewhere."""
    from databricks.connect import DatabricksSession

    builder = DatabricksSession.builder
    if "DATABRICKS_RUNTIME_VERSION" not in os.environ:  # set on Databricks compute, not on your machine
        builder = builder.serverless()
    return builder.getOrCreate()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Write the daily revenue table for the sample orders.")
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    args = parser.parse_args(argv)

    spark = get_spark()
    cleaned = clean_orders(sample_orders())
    totals = spark_daily_revenue(spark.createDataFrame(cleaned))
    table = f"`{args.catalog}`.`{args.schema}`.daily_revenue"
    totals.write.mode("overwrite").saveAsTable(table)

    expected = len(daily_revenue(cleaned))
    written = spark.table(table).count()
    if written != expected:
        raise RuntimeError(f"{table} has {written} rows, expected {expected}")
    print(f"Wrote {written} rows to {table}")


if __name__ == "__main__":
    main()
