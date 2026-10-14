"""Task 1: generate the raw orders and pass the row count to later tasks as task values."""

from __future__ import annotations

import argparse

import guide_lib as g


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import dbutils, spark

    spec = g.load_spec(args.use_case_file)
    df = g.build_orders(spark, spec, rows=int(spec["orchestration"]["rows"]), with_bad_rows=True)
    table = f"{args.catalog}.{args.schema}.orch_orders_raw"
    df.write.mode("overwrite").saveAsTable(table)
    row_count = spark.table(table).count()

    # Task values are how one task hands a result to the next.
    dbutils.jobs.taskValues.set(key="row_count", value=row_count)
    dbutils.jobs.taskValues.set(key="source_table", value=table)
    print(f"extract: wrote {row_count} rows to {table}")


if __name__ == "__main__":
    main()
