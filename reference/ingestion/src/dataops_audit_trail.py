"""Record run history and the audit trail for the DataOps job, including retry attempts."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()

    from databricks.sdk import WorkspaceClient
    from databricks.sdk.runtime import spark

    prefix = f"{args.catalog}.{args.schema}"
    w = WorkspaceClient()
    run = w.jobs.get_run(run_id=int(args.run_id))

    attempts = [
        (
            args.run_id,
            task.task_key,
            task.attempt_number or 0,
            task.state.result_state.value if task.state and task.state.result_state else "RUNNING",
            datetime.fromtimestamp(task.start_time / 1000, timezone.utc) if task.start_time else None,
        )
        for task in run.tasks or []
    ]
    spark.createDataFrame(
        attempts, "job_run_id STRING, task_key STRING, attempt_number INT, result_state STRING, started_at TIMESTAMP"
    ).write.mode("append").saveAsTable(f"{prefix}.dataops_task_attempts")

    history = [
        (
            str(item.run_id),
            item.state.result_state.value if item.state and item.state.result_state else "RUNNING",
            item.trigger.value if item.trigger else None,
            datetime.fromtimestamp(item.start_time / 1000, timezone.utc) if item.start_time else None,
            item.run_page_url,
        )
        for item in w.jobs.list_runs(job_id=int(args.job_id), limit=25)
    ]
    spark.createDataFrame(
        history, "job_run_id STRING, result_state STRING, trigger STRING, started_at TIMESTAMP, run_page_url STRING"
    ).write.mode("overwrite").saveAsTable(f"{prefix}.dataops_run_history")

    spark.sql(f"SELECT * FROM {prefix}.dataops_task_attempts WHERE job_run_id = '{args.run_id}'").show(truncate=False)
    spark.sql(f"SELECT feed, status, rows_read, rows_valid, started_at FROM {prefix}.audit_log ORDER BY started_at DESC LIMIT 10").show(truncate=False)
    spark.sql(f"DESCRIBE HISTORY {prefix}.transactions_silver").select("version", "timestamp", "operation").show(10, truncate=False)


if __name__ == "__main__":
    main()
