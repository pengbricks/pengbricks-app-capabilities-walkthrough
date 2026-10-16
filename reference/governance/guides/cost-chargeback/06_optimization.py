# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 6. Optimization candidates
# MAGIC
# MAGIC Flags warehouses with auto-stop above 10 minutes or too few statements, and lists the costliest jobs per run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_cost", ['catalog', 'schema', 'budget_threshold_usd'])

# COMMAND ----------

import datetime as dt
from types import SimpleNamespace
from common import run_sql_rows, workspace_id, write_rows
from governance_lib.datagen import write_table
from governance_lib.spec import load_spec
from governance_lib.sqlgen import grant_sql, principal_kind, qualified

args = SimpleNamespace(
    catalog=params["catalog"],
    schema=params["schema"],
    threshold=params["budget_threshold_usd"],
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## The step

# COMMAND ----------

VIEW = "cost_usage_enriched"

def q(args, name: str) -> str:
    return qualified(args.catalog, args.schema, name)

def optimization(args, spark) -> None:
    from databricks.sdk import WorkspaceClient

    wid = workspace_id()
    settings = {w.id: w for w in WorkspaceClient().warehouses.list()}
    stats = run_sql_rows(spark, f"""
        WITH spend AS (SELECT warehouse_id, sum(cost_usd) AS cost_usd FROM {q(args, VIEW)}
                       WHERE usage_date >= date_sub(current_date(), 30) AND warehouse_id IS NOT NULL GROUP BY warehouse_id),
             queries AS (SELECT compute.warehouse_id AS warehouse_id, count(*) AS statements FROM system.query.history
                         WHERE workspace_id = '{wid}' AND start_time >= current_timestamp() - INTERVAL 30 DAYS
                           AND compute.warehouse_id IS NOT NULL GROUP BY 1)
        SELECT coalesce(s.warehouse_id, q.warehouse_id) AS warehouse_id, coalesce(s.cost_usd, 0) AS cost_usd_30d,
               coalesce(q.statements, 0) AS statements_30d
        FROM spend s FULL OUTER JOIN queries q ON s.warehouse_id = q.warehouse_id""")
    rows = []
    for r in stats:
        w = settings.get(r["warehouse_id"])
        auto_stop = w.auto_stop_mins if w else None
        usd_per_statement = round(float(r["cost_usd_30d"]) / r["statements_30d"], 4) if r["statements_30d"] else None
        flags = []
        if w and (auto_stop == 0 or (auto_stop or 0) > 10):
            flags.append("auto-stop above 10 minutes or disabled")
        if r["statements_30d"] < 100 and float(r["cost_usd_30d"]) > 0:
            flags.append("fewer than 100 statements in 30 days")
        if w is None:
            flags.append("warehouse deleted")
        rows.append({"warehouse_id": r["warehouse_id"], "warehouse_name": w.name if w else r["warehouse_id"], "cost_usd_30d": round(float(r["cost_usd_30d"]), 2),
                     "statements_30d": int(r["statements_30d"]), "usd_per_statement": usd_per_statement,
                     "auto_stop_minutes": auto_stop, "flags": "; ".join(flags) or "none"})
    write_rows(spark, args.catalog, args.schema, "opt_idle_warehouses", rows,
               "warehouse_id string, warehouse_name string, cost_usd_30d double, statements_30d long, "
               "usd_per_statement double, auto_stop_minutes int, flags string")

    spark.sql(f"""CREATE OR REPLACE TABLE {q(args, 'opt_costly_jobs')} AS
        SELECT job_id, max(job_name) AS job_name, count(DISTINCT job_run_id) AS runs, round(sum(cost_usd), 2) AS cost_usd_30d,
               round(sum(cost_usd) / nullif(count(DISTINCT job_run_id), 0), 3) AS usd_per_run,
               round(sum(usage_quantity), 1) AS dbus
        FROM {q(args, VIEW)} WHERE usage_date >= date_sub(current_date(), 30) AND job_id IS NOT NULL
        GROUP BY job_id ORDER BY usd_per_run DESC LIMIT 20""")
    for name in ("opt_idle_warehouses", "opt_costly_jobs"):
        print(name, [r.asDict() for r in spark.sql(f"SELECT * FROM {q(args, name)} LIMIT 3").collect()])

# COMMAND ----------

optimization(args, spark)
