"""Record latency, throughput, and pipeline update metrics for one batch and real-time run."""

from __future__ import annotations

import argparse


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--pipeline-id", required=True)
    args = parser.parse_args()

    from databricks.sdk import WorkspaceClient
    from databricks.sdk.runtime import spark

    prefix = f"{args.catalog}.{args.schema}"
    w = WorkspaceClient()
    update = next(iter(w.pipelines.list_updates(pipeline_id=args.pipeline_id, max_results=1).updates or []), None)

    metrics = spark.sql(
        f"""
        SELECT
          :run_id AS job_run_id,
          :update_id AS pipeline_update_id,
          :update_state AS pipeline_update_state,
          current_timestamp() AS recorded_at,
          (SELECT count(*) FROM {prefix}.events_bronze) AS bronze_events_total,
          (SELECT count(*) FROM {prefix}.events_silver) AS silver_events_total,
          (SELECT count(*) FROM {prefix}.events_bronze) - (SELECT count(*) FROM {prefix}.events_silver) AS dropped_by_expectations,
          (SELECT percentile_approx(latency_seconds, 0.5) FROM {prefix}.events_silver
             WHERE ingested_at >= current_timestamp() - INTERVAL 1 HOUR) AS p50_latency_seconds,
          (SELECT percentile_approx(latency_seconds, 0.95) FROM {prefix}.events_silver
             WHERE ingested_at >= current_timestamp() - INTERVAL 1 HOUR) AS p95_latency_seconds,
          (SELECT max(events) / 60.0 FROM {prefix}.ingestion_latency_by_minute) AS peak_events_per_second,
          (SELECT count(*) FROM {prefix}.transactions_daily_summary) AS batch_summary_rows
        """,
        args={
            "run_id": args.run_id,
            "update_id": update.update_id if update else "",
            "update_state": str(update.state.value) if update and update.state else "",
        },
    )
    metrics.write.mode("append").option("mergeSchema", "true").saveAsTable(f"{prefix}.ingestion_run_metrics")
    metrics.show(vertical=True, truncate=False)


if __name__ == "__main__":
    main()
