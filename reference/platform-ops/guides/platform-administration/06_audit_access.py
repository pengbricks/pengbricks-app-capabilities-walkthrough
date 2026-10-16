# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 6. Audit logs
# MAGIC
# MAGIC Groups recent `system.access.audit` events by service and action.
# MAGIC
# MAGIC Each row is written to `admin_actions` with a merge keyed on the run, category, action and target, so a retried or repeated task updates its own rows.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_platform_admin", ['catalog', 'schema', 'use_case'])

# COMMAND ----------

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

def audit_access(w, spark, spec, **_):
    days = spec["audit_lookback_days"]
    services = ", ".join(f"'{s}'" for s in spec["audit_services"])
    try:
        out = spark.sql(
            f"""SELECT service_name, action_name, COUNT(*) AS events, COUNT(DISTINCT user_identity.email) AS actors
                FROM system.access.audit
                WHERE event_date >= date_sub(current_date(), {days})
                  AND service_name IN ({services})
                  AND (action_name RLIKE '^(create|delete|update|edit|set|grant|add|remove|change|reset)'
                       OR action_name LIKE '%Permission%' OR action_name LIKE '%Policy%')
                GROUP BY service_name, action_name ORDER BY events DESC LIMIT 15"""
        ).collect()
    except Exception as e:  # noqa: BLE001
        return [action("audit", "admin_actions_7d", "system.access.audit", "not_allowed", str(e)[:500])]
    rows = [action("audit", "admin_actions_7d", f"{r['service_name']}.{r['action_name']}", "ok", f"{r['events']} events by {r['actors']} actors") for r in out]
    rows.append(action("audit", "admin_actions_7d", "summary", "ok", f"{len(out)} service/action pairs in last {days} days"))
    return rows

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it and record the result

# COMMAND ----------

rows = audit_access(w, spark, spec)
record(spark, table, run_id, rows)
for r in rows:
    print(f"[{r['status']}] {r['category']}/{r['action']} {r['target']}: {r['detail']}")
