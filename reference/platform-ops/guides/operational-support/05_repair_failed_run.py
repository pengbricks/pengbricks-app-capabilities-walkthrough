# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Repair the failed run
# MAGIC
# MAGIC Finds the newest finished `capability-guides-operational-support` run whose `fragile_step` failed and has not been repaired, calls the Jobs API repair endpoint for the failed task keys, waits for the run to finish, and records the outcome on the incident in `support_incidents`. If nothing needs repair, it says so and stops, so rerunning does nothing.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_support_repair", ['catalog', 'schema', 'use_case'])

# COMMAND ----------

from support_lib import load_support_spec
spec = load_support_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
catalog, schema = params["catalog"], params["schema"]
import time
from databricks.sdk import WorkspaceClient
from support_lib import INCIDENTS_DDL, failed_tasks, incident_id, pick_repair_target, run_url
w = WorkspaceClient()
table = f"{catalog}.{schema}.support_incidents"
spark.sql(INCIDENTS_DDL.format(table=table))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Find the run to repair

# COMMAND ----------

def find_runs(w, job_key, tag_key, task_key):
    jobs = [j for j in w.jobs.list() if (j.settings.tags or {}).get(tag_key) == job_key]
    if not jobs:
        raise SystemExit(f"No job tagged {tag_key}={job_key}")
    job = jobs[0]
    runs = []
    for listed in w.jobs.list_runs(job_id=job.job_id, expand_tasks=True, limit=25):
        # list_runs omits repair history; get_run(include_history=True) has it.
        r = w.jobs.get_run(listed.run_id, include_history=True)
        runs.append(
            {
                "run_id": r.run_id,
                "start_time": r.start_time,
                "finished": bool(r.state and r.state.result_state),
                "repair_count": sum(1 for h in (r.repair_history or []) if h.type and h.type.value == "REPAIR"),
                "latest_repair_id": next((h.id for h in reversed(r.repair_history or []) if h.id), None),
                "tasks": [
                    {"task_key": t.task_key, "attempt_number": t.attempt_number or 0, "result_state": t.state.result_state.value if t.state and t.state.result_state else None}
                    for t in (r.tasks or [])
                ],
            }
        )
    return job, runs

# COMMAND ----------

job, runs = find_runs(w, spec["repair_job_key"], spec["triage_job_tag"], spec["repair_task_key"])
target = pick_repair_target(runs, spec["repair_task_key"])
if target is None:
    dbutils.notebook.exit("Nothing to repair: no finished run with an unrepaired failure of " + spec["repair_task_key"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Repair and wait

# COMMAND ----------

print(f"Repairing run {target['run_id']} of job {job.job_id}: rerun {[t['task_key'] for t in failed_tasks(target)]}")
resp = w.jobs.repair_run(run_id=target["run_id"], rerun_tasks=[t["task_key"] for t in failed_tasks(target)], latest_repair_id=target["latest_repair_id"])
# Newer SDKs return a waiter that wraps the response; older ones return the response itself.
repair_id = getattr(resp, "response", resp).repair_id
deadline = time.time() + 1500
while True:
    run = w.jobs.get_run(target["run_id"])
    if run.state and run.state.result_state:
        break
    if time.time() > deadline:
        raise TimeoutError("repair did not finish in 25 minutes")
    time.sleep(10)
outcome = run.state.result_state.value
task_states = {t.task_key: (t.state.result_state.value if t.state and t.state.result_state else "NONE") for t in run.tasks}
print(f"Repair {repair_id} finished: run {outcome}; tasks {task_states}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the outcome on the incident
# MAGIC
# MAGIC Updates the triage incident, or inserts one if triage never recorded it.

# COMMAND ----------

iid = incident_id(target["run_id"], spec["repair_task_key"], "jobs_api")
host = w.config.host
status = "repaired" if outcome == "SUCCESS" else "repair_failed"
spark.sql(
    f"""MERGE INTO {table} t
        USING (SELECT '{iid}' AS incident_id, {job.job_id} AS job_id, {target['run_id']} AS run_id, '{spec['repair_task_key']}' AS task_key,
               '{run_url(host, job.job_id, target['run_id'])}' AS run_url, {repair_id} AS repair_id, '{status}' AS status,
               'repair {repair_id}: run finished {outcome}' AS outcome) s
        ON t.incident_id = s.incident_id
        WHEN MATCHED THEN UPDATE SET t.status = s.status, t.resolved_at = current_timestamp(), t.repair_id = s.repair_id, t.outcome = s.outcome
        WHEN NOT MATCHED THEN INSERT (incident_id, detected_at, source, job_id, run_id, task_key, run_url, status, resolved_at, repair_id, outcome)
          VALUES (s.incident_id, current_timestamp(), 'repair_job', s.job_id, s.run_id, s.task_key, s.run_url, s.status, current_timestamp(), s.repair_id, s.outcome)"""
)
if outcome != "SUCCESS":
    raise Exception(f"Repair finished with {outcome}")
