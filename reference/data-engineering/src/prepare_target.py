"""Create the MERGE target (initial snapshot) and the source batch (inserts, updates, deletes)."""

from __future__ import annotations

import argparse

from de_common.accounts import change_batch, initial_snapshot
from de_common.spec import load_use_case


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    spec = load_use_case(args.use_case_file)
    scope = f"{args.catalog}.{args.schema}"
    initial_snapshot(spark, spec).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(
        f"{scope}.accounts_target"
    )
    change_batch(spark, spec).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(
        f"{scope}.accounts_source_batch"
    )
    print("target rows:", spark.table(f"{scope}.accounts_target").count())
    spark.table(f"{scope}.accounts_source_batch").groupBy("change_type").count().show()


if __name__ == "__main__":
    main()
