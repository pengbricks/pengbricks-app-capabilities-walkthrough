"""Compare feeds processed in one job run and fail if any feed did not succeed."""

from __future__ import annotations

import argparse


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    prefix = f"{args.catalog}.{args.schema}"
    summary = spark.sql(
        f"""
        SELECT feed, status, rows_read, rows_valid, rows_quarantined,
               round(rows_quarantined * 100.0 / nullif(rows_read, 0), 2) AS quarantine_pct,
               timestampdiff(SECOND, started_at, ended_at) AS duration_seconds
        FROM {prefix}.audit_log
        WHERE run_id = :run_id
        ORDER BY feed
        """,
        args={"run_id": args.run_id},
    )
    summary.show(truncate=False)

    reasons = spark.sql(
        f"""
        SELECT source_feed, reason, count(*) AS rows
        FROM {prefix}.transactions_quarantine LATERAL VIEW explode(_quarantine_reasons) r AS reason
        WHERE ingest_run_id = :run_id
        GROUP BY ALL ORDER BY source_feed, rows DESC
        """,
        args={"run_id": args.run_id},
    )
    reasons.show(truncate=False)

    failed = [row.feed for row in summary.collect() if row.status != "SUCCEEDED"]
    if failed or summary.count() == 0:
        raise RuntimeError(f"Feeds without a successful audit record in run {args.run_id}: {failed or 'none recorded'}")


if __name__ == "__main__":
    main()
