# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Create the ledger
# MAGIC
# MAGIC Creates the `admin_actions` table that every other task writes to. Safe to run again: the table is created only if it does not exist.
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

def init_ledger(spark, table, **_):
    spark.sql(LEDGER_DDL.format(table=table))
    return [action("setup", "ensure_ledger", table, "ok", "admin_actions table ready")]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it and record the result

# COMMAND ----------

rows = init_ledger(spark, table)
record(spark, table, run_id, rows)
for r in rows:
    print(f"[{r['status']}] {r['category']}/{r['action']} {r['target']}: {r['detail']}")
