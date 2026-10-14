"""Join point: wait for both branches, read each branch's task value, and write one summary row."""

from __future__ import annotations

import argparse


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import dbutils, spark

    prefix = f"{args.catalog}.{args.schema}"
    region_groups = int(dbutils.jobs.taskValues.get(taskKey="branch_region", key="groups", debugValue=0))
    status_groups = int(dbutils.jobs.taskValues.get(taskKey="branch_status", key="groups", debugValue=0))
    valid_rows = int(dbutils.jobs.taskValues.get(taskKey="validate", key="valid_rows", debugValue=0))
    revenue = spark.sql(f"SELECT ROUND(SUM(revenue), 2) FROM {prefix}.orch_summary_by_region").first()[0]

    spark.sql(
        f"""
        CREATE TABLE IF NOT EXISTS {prefix}.orch_run_summary
        (job_run_id STRING, valid_rows BIGINT, region_groups INT, status_groups INT, revenue DOUBLE, joined_at TIMESTAMP)
        """
    )
    spark.sql(
        f"INSERT INTO {prefix}.orch_run_summary VALUES "
        f"('{args.run_id}', {valid_rows}, {region_groups}, {status_groups}, {revenue}, current_timestamp())"
    )
    dbutils.jobs.taskValues.set(key="revenue", value=revenue)
    print(f"join: {valid_rows} valid rows, {region_groups} regions, {status_groups} statuses, revenue {revenue}")


if __name__ == "__main__":
    main()
