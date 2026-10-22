# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Workspace checks
# MAGIC
# MAGIC Records the caller identity, workspace ID, metastore and the workspace settings listed in the spec. Read only.
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

def workspace_checks(w, spark, spec, **_):
    rows = []
    me = w.current_user.me()
    groups = [g.display for g in (me.groups or [])]
    rows.append(action("workspace", "caller_identity", me.user_name or "unknown", "ok", f"member of {len(groups)} groups; admins={'admins' in groups}"))
    rows.append(action("workspace", "workspace_info", str(w.get_workspace_id()), "ok", f"host={w.config.host}"))
    try:
        ms = w.metastores.current()
        rows.append(action("workspace", "metastore", ms.metastore_id, "ok", f"region={getattr(ms, 'region', None)}"))
    except DatabricksError as e:
        rows.append(action("workspace", "metastore", "current", "error", str(e)))
    try:
        conf = w.workspace_conf.get_status(",".join(spec["workspace_conf_keys"]))
        for key in spec["workspace_conf_keys"]:
            rows.append(action("workspace", "setting", key, "ok", f"value={conf.get(key)!r}"))
    except DatabricksError as e:
        rows.append(action("workspace", "settings", "workspace_conf", "not_allowed", str(e)))
    return rows

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it and record the result

# COMMAND ----------

rows = workspace_checks(w, spark, spec)
record(spark, table, run_id, rows)
for r in rows:
    print(f"[{r['status']}] {r['category']}/{r['action']} {r['target']}: {r['detail']}")
