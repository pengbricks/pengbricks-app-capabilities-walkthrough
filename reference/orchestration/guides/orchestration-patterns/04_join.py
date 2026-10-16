# Databricks notebook source
# MAGIC %md
# MAGIC # 4. Join
# MAGIC
# MAGIC The join point. The job runs it after both branches finish. It reads each branch's task value and writes one summary row for the run, replacing any row for the same `run_id`. Run by hand, it counts the groups straight from the branch tables.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_orchestration", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
prefix = f"{params['catalog']}.{params['schema']}"
run_id = params["run_id"]

# COMMAND ----------

def task_value(task_key, key):
    """The value an upstream job task passed on, or None when this notebook runs on its own."""
    try:
        return dbutils.jobs.taskValues.get(taskKey=task_key, key=key, default=None, debugValue=None)
    except ValueError:
        return None

def passed(task_key, key, fallback):
    value = task_value(task_key, key)
    return int(value) if value is not None else int(fallback())

region_groups = passed("branch_region", "groups", lambda: spark.table(f"{prefix}.orch_summary_by_region").count())
status_groups = passed("branch_status", "groups", lambda: spark.table(f"{prefix}.orch_summary_by_status").count())
valid_rows = passed("validate", "valid_rows", lambda: spark.table(f"{prefix}.orch_orders_valid").count())
revenue = spark.sql(f"SELECT ROUND(SUM(revenue), 2) FROM {prefix}.orch_summary_by_region").first()[0]

spark.sql(
    f"""
    CREATE TABLE IF NOT EXISTS {prefix}.orch_run_summary
    (job_run_id STRING, valid_rows BIGINT, region_groups INT, status_groups INT, revenue DOUBLE, joined_at TIMESTAMP)
    """
)
spark.sql(f"DELETE FROM {prefix}.orch_run_summary WHERE job_run_id = '{run_id}'")
spark.sql(
    f"INSERT INTO {prefix}.orch_run_summary VALUES "
    f"('{run_id}', {valid_rows}, {region_groups}, {status_groups}, {revenue}, current_timestamp())"
)
dbutils.jobs.taskValues.set(key="revenue", value=revenue)
print(f"join: {valid_rows} valid rows, {region_groups} regions, {status_groups} statuses, revenue {revenue}")
