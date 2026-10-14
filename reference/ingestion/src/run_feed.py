"""Run the shared framework for one feed. The feed name is the only thing that changes per source."""

from __future__ import annotations

import argparse

from capability_framework.config import load_feed
from capability_framework.runner import TransientSourceError, run_feed


def simulate_transient_failure(dbutils, catalog: str, schema: str, run_id: str) -> None:
    """Fail the first attempt of a run so the job's retry policy is exercised; later attempts pass."""
    marker = f"/Volumes/{catalog}/{schema}/landing/_markers/transient-{run_id}"
    try:
        dbutils.fs.ls(marker)
        print("Retry attempt: transient condition cleared")
    except Exception:
        dbutils.fs.put(marker, "first attempt failed on purpose", True)
        raise TransientSourceError("Simulated transient source outage on first attempt; the job retry policy will rerun")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--feeds-dir", required=True)
    parser.add_argument("--feed", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--simulate-transient-failure", default="false")
    args = parser.parse_args()

    from databricks.sdk.runtime import dbutils, spark

    if args.simulate_transient_failure.lower() == "true":
        simulate_transient_failure(dbutils, args.catalog, args.schema, args.run_id)

    config = load_feed(args.feeds_dir, args.feed)
    record = run_feed(spark, config, args.catalog, args.schema, args.run_id)
    print(
        f"{record.feed}: read={record.rows_read} valid={record.rows_valid} "
        f"quarantined={record.rows_quarantined} status={record.status}"
    )


if __name__ == "__main__":
    main()
