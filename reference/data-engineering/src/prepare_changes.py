"""Write the CDC feed for the SCD pipeline.

--phase initial  replace accounts_changes with the initial snapshot (change_seq 1, all INSERT)
--phase changes  append the change batch (change_seq 2: inserts, updates, deletes)
"""

from __future__ import annotations

import argparse

from de_common.accounts import change_batch, initial_snapshot
from de_common.spec import load_use_case


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    parser.add_argument("--phase", choices=["initial", "changes"], required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import spark
    from pyspark.sql import functions as F

    spec = load_use_case(args.use_case_file)
    table = f"{args.catalog}.{args.schema}.accounts_changes"
    if args.phase == "initial":
        df = initial_snapshot(spark, spec).withColumn("change_type", F.lit("INSERT")).withColumn("change_seq", F.lit(1))
        df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
    else:
        df = change_batch(spark, spec).withColumn("change_seq", F.lit(2))
        df.write.mode("append").saveAsTable(table)
    counts = {r["change_type"]: r["n"] for r in df.groupBy("change_type").agg(F.count("*").alias("n")).collect()}
    print(f"{args.phase}: wrote {df.count()} rows to {table}: {counts}")


if __name__ == "__main__":
    main()
