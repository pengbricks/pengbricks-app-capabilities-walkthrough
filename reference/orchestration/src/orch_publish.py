"""Condition branch outcome. `publish` runs when the condition is true, `hold` when it is false."""

from __future__ import annotations

import argparse


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--outcome", required=True, choices=["publish", "hold"])
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    prefix = f"{args.catalog}.{args.schema}"
    spark.sql(f"CREATE TABLE IF NOT EXISTS {prefix}.orch_branch_outcomes (job_run_id STRING, outcome STRING, decided_at TIMESTAMP)")
    spark.sql(f"INSERT INTO {prefix}.orch_branch_outcomes VALUES ('{args.run_id}', '{args.outcome}', current_timestamp())")
    if args.outcome == "publish":
        spark.sql(f"CREATE OR REPLACE TABLE {prefix}.orch_published_summary AS SELECT * FROM {prefix}.orch_summary_by_region")
    print(f"branch outcome: {args.outcome}")


if __name__ == "__main__":
    main()
