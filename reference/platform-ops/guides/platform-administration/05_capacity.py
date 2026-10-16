# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Capacity
# MAGIC
# MAGIC Flags warehouses with auto-stop off or above the spec's limit, and sums serverless DBUs from `system.billing.usage`.
# MAGIC
# MAGIC Each row is written to `admin_actions` with a merge keyed on the run, category, action and target, so a retried or repeated task updates its own rows.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_platform_admin", ['catalog', 'schema', 'use_case'])

# COMMAND ----------

from admin_lib import evaluate_warehouse

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

def capacity(w, spark, spec, **_):
    rows = []
    n = 0
    for wh in w.warehouses.list():
        n += 1
        rows.append(
            evaluate_warehouse(
                wh.name,
                wh.cluster_size or "unknown",
                wh.auto_stop_mins,
                bool(wh.enable_serverless_compute),
                spec["warehouse_max_auto_stop_mins"],
            )
        )
    rows.append(action("capacity", "warehouse_inventory", "all", "ok", f"{n} warehouses listed"))
    days = spec["usage_lookback_days"]
    try:
        usage = spark.sql(
            f"""SELECT sku_name, ROUND(SUM(usage_quantity), 2) AS dbus
                FROM system.billing.usage
                WHERE usage_date >= date_sub(current_date(), {days}) AND sku_name LIKE '%SERVERLESS%'
                GROUP BY sku_name ORDER BY dbus DESC LIMIT 10"""
        ).collect()
        if usage:
            for r in usage:
                rows.append(action("capacity", "serverless_usage", r["sku_name"], "ok", f"{r['dbus']} DBUs in last {days} days"))
        else:
            rows.append(action("capacity", "serverless_usage", "all", "ok", f"no serverless usage rows in last {days} days"))
    except Exception as e:  # noqa: BLE001
        rows.append(action("capacity", "serverless_usage", "system.billing.usage", "not_allowed", str(e)[:500]))
    return rows

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it and record the result

# COMMAND ----------

rows = capacity(w, spark, spec)
record(spark, table, run_id, rows)
for r in rows:
    print(f"[{r['status']}] {r['category']}/{r['action']} {r['target']}: {r['detail']}")
