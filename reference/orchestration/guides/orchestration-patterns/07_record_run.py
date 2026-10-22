# Databricks notebook source
# MAGIC %md
# MAGIC # 7. Record the run
# MAGIC
# MAGIC Safe to rerun: the task rows for a `run_id` are replaced; each recorded run adds its own rows to `orch_task_log`, a run log.
# MAGIC
# MAGIC The final task. It records each task's state, attempts and duration for the run, replacing any rows already logged for that `run_id`. Run by hand with `run_id` blank, it records the most recent finished run of the orchestration job.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
params = load_params(dbutils, "capability_guides_orchestration", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
prefix = f"{params['catalog']}.{params['schema']}"
run_id = params["run_id"]

from datetime import datetime, timezone
from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
if not run_id.isdigit():
    job = next(j for j in w.jobs.list() if ((j.settings.tags if j.settings else None) or {}).get(JOB_TAG) == "capability_guides_orchestration")
    finished = [r for r in w.jobs.list_runs(job_id=job.job_id, completed_only=True, limit=5)]
    if not finished:
        raise RuntimeError("No finished run of the orchestration job to record. Run the job first.")
    run_id = str(finished[0].run_id)
    print(f"Recording the latest finished run: {run_id}")

# COMMAND ----------

run = w.jobs.get_run(run_id=int(run_id))
rows = []
for task in run.tasks or []:
    state = task.state
    result = (state.result_state.value if state and state.result_state else None) or (
        "EXCLUDED" if state and state.life_cycle_state and state.life_cycle_state.value == "SKIPPED" else "RUNNING"
    )
    rows.append(
        (
            run_id,
            task.task_key,
            result,
            task.attempt_number or 0,
            datetime.fromtimestamp(task.start_time / 1000, timezone.utc) if task.start_time else None,
            int((task.end_time - task.start_time) / 1000) if task.start_time and task.end_time else None,
        )
    )
schema_ddl = "job_run_id STRING, task_key STRING, result_state STRING, attempt_number INT, started_at TIMESTAMP, duration_s INT"
spark.sql(f"CREATE TABLE IF NOT EXISTS {prefix}.orch_task_log ({schema_ddl})")
spark.sql(f"DELETE FROM {prefix}.orch_task_log WHERE job_run_id = '{run_id}'")
spark.createDataFrame(rows, schema_ddl).write.mode("append").saveAsTable(f"{prefix}.orch_task_log")
spark.sql(
    f"SELECT task_key, result_state, attempt_number, duration_s FROM {prefix}.orch_task_log "
    f"WHERE job_run_id = '{run_id}' ORDER BY started_at"
).show(truncate=False)
