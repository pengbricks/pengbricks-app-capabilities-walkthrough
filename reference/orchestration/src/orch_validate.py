"""Task 2: read the upstream task value, reject bad rows, and publish the valid-row count."""

from __future__ import annotations

import argparse


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import dbutils, spark

    prefix = f"{args.catalog}.{args.schema}"
    expected = int(dbutils.jobs.taskValues.get(taskKey="extract", key="row_count", debugValue=0))
    source = dbutils.jobs.taskValues.get(taskKey="extract", key="source_table", debugValue=f"{prefix}.orch_orders_raw")

    raw = spark.table(source)
    valid = raw.where("order_id IS NOT NULL AND amount >= 0")
    valid.write.mode("overwrite").saveAsTable(f"{prefix}.orch_orders_valid")
    valid_rows = spark.table(f"{prefix}.orch_orders_valid").count()
    rejected = expected - valid_rows

    dbutils.jobs.taskValues.set(key="valid_rows", value=valid_rows)
    dbutils.jobs.taskValues.set(key="rejected_rows", value=rejected)
    print(f"validate: {expected} rows from extract, {valid_rows} valid, {rejected} rejected")


if __name__ == "__main__":
    main()
