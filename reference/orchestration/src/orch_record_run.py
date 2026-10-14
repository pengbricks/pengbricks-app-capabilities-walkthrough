"""Final task: record each task's state, attempts, and duration for this run."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()

    from databricks.sdk import WorkspaceClient
    from databricks.sdk.runtime import spark

    prefix = f"{args.catalog}.{args.schema}"
    run = WorkspaceClient().jobs.get_run(run_id=int(args.run_id))
    rows = []
    for task in run.tasks or []:
        state = task.state
        result = (state.result_state.value if state and state.result_state else None) or (
            "EXCLUDED" if state and state.life_cycle_state and state.life_cycle_state.value == "SKIPPED" else "RUNNING"
        )
        rows.append(
            (
                args.run_id,
                task.task_key,
                result,
                task.attempt_number or 0,
                datetime.fromtimestamp(task.start_time / 1000, timezone.utc) if task.start_time else None,
                int((task.end_time - task.start_time) / 1000) if task.start_time and task.end_time else None,
            )
        )
    df = spark.createDataFrame(
        rows, "job_run_id STRING, task_key STRING, result_state STRING, attempt_number INT, started_at TIMESTAMP, duration_s INT"
    )
    df.write.mode("append").saveAsTable(f"{prefix}.orch_task_log")
    spark.sql(
        f"SELECT task_key, result_state, attempt_number, duration_s FROM {prefix}.orch_task_log "
        f"WHERE job_run_id = '{args.run_id}' ORDER BY started_at"
    ).show(truncate=False)


if __name__ == "__main__":
    main()
