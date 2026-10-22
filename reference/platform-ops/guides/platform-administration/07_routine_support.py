# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 7. Routine support
# MAGIC
# MAGIC Lists failed job runs from the lookback window and workspace tokens that expire soon.
# MAGIC
# MAGIC Each row is written to `admin_actions` with a merge keyed on the run, category, action and target, so a retried or repeated task updates its own rows.
# MAGIC
# MAGIC Safe to rerun: it only reads. A retry updates its own ledger rows.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_platform_admin", ['catalog', 'schema', 'use_case'])

# COMMAND ----------

import time
from datetime import datetime, timezone
from admin_lib import cutoff_ms, tokens_expiring

from admin_lib import LEDGER_DDL, action, record, load_admin_spec
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import DatabricksError

dbutils.widgets.text("run_id", "")
from datetime import datetime, timezone
# In the job, run_id is the job run. Standalone, a blank widget uses one id per day, so a rerun updates its own rows.
run_id = dbutils.widgets.get("run_id").strip() or datetime.now(timezone.utc).strftime("manual-%Y%m%d")
spec = load_admin_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
table = f"{params['catalog']}.{params['schema']}.admin_actions"
catalog, schema = params["catalog"], params["schema"]
w = WorkspaceClient()
spark.sql(LEDGER_DDL.format(table=table))

# COMMAND ----------

# MAGIC %md
# MAGIC ## The task

# COMMAND ----------

def routine_support(w, spark, spec, **_):
    rows = []
    hours = spec["failed_job_lookback_hours"]
    failed = [
        r
        for r in w.jobs.list_runs(completed_only=True, start_time_from=cutoff_ms(hours), expand_tasks=False)
        if r.state and r.state.result_state and r.state.result_state.value == "FAILED"
    ]
    for r in failed[:20]:
        rows.append(action("support", "failed_job_run", f"{r.job_id}/{r.run_id}", "flagged", f"{r.run_name or 'run'}: {r.state.state_message or ''}"[:500]))
    rows.append(action("support", "failed_jobs_24h", "summary", "ok", f"{len(failed)} failed runs in last {hours} hours"))
    now_ms = int(time.time() * 1000)
    try:
        toks = [{"token_id": t.token_id, "expiry_time": t.expiry_time, "owner": t.owner_id} for t in w.token_management.list()]
        soon = tokens_expiring(toks, now_ms, spec["token_expiry_warning_days"])
        for t in soon[:20]:
            exp = datetime.fromtimestamp(t["expiry_time"] / 1000, timezone.utc).date()
            rows.append(action("support", "expiring_token", t["token_id"], "flagged", f"expires {exp}"))
        rows.append(action("support", "tokens_expiring", "summary", "ok", f"{len(soon)} of {len(toks)} workspace tokens expire within {spec['token_expiry_warning_days']} days"))
    except DatabricksError as e:
        rows.append(action("support", "tokens_expiring", "token_management", "not_allowed", str(e)[:500]))
    return rows

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it and record the result

# COMMAND ----------

rows = routine_support(w, spark, spec)
record(spark, table, run_id, rows)
for r in rows:
    print(f"[{r['status']}] {r['category']}/{r['action']} {r['target']}: {r['detail']}")
