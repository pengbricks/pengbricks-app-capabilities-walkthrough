"""Parallel branch: aggregate the valid rows by one dimension. Run twice, once per branch."""

from __future__ import annotations

import argparse


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--dimension", required=True, choices=["region", "status"])
    args = parser.parse_args()

    from databricks.sdk.runtime import dbutils, spark

    prefix = f"{args.catalog}.{args.schema}"
    table = f"{prefix}.orch_summary_by_{args.dimension}"
    spark.sql(
        f"""
        CREATE OR REPLACE TABLE {table} AS
        SELECT {args.dimension} AS dimension_value, COUNT(*) AS orders, ROUND(SUM(amount), 2) AS revenue
        FROM {prefix}.orch_orders_valid
        GROUP BY {args.dimension}
        """
    )
    groups = spark.table(table).count()
    dbutils.jobs.taskValues.set(key="groups", value=groups)
    print(f"branch {args.dimension}: {groups} groups in {table}")


if __name__ == "__main__":
    main()
