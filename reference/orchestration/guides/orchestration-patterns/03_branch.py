# Databricks notebook source
# MAGIC %md
# MAGIC # 3. Branch
# MAGIC
# MAGIC Aggregates the valid rows by one dimension. The job runs this notebook twice at the same time, once with `dimension = region` and once with `dimension = status`, because both tasks depend only on validate. Run by hand with `dimension` blank, it does both.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_orchestration", ['catalog', 'schema', 'dimension'], defaults={'dimension': 'all'})
prefix = f"{params['catalog']}.{params['schema']}"
dimensions = ["region", "status"] if params["dimension"] in ("all", "") else [params["dimension"]]
for d in dimensions:
    if d not in ("region", "status"):
        raise ValueError(f"dimension must be region, status or all, got {d!r}")

# COMMAND ----------

for dimension in dimensions:
    table = f"{prefix}.orch_summary_by_{dimension}"
    spark.sql(
        f"""
        CREATE OR REPLACE TABLE {table} AS
        SELECT {dimension} AS dimension_value, COUNT(*) AS orders, ROUND(SUM(amount), 2) AS revenue
        FROM {prefix}.orch_orders_valid
        GROUP BY {dimension}
        """
    )
    groups = spark.table(table).count()
    dbutils.jobs.taskValues.set(key="groups", value=groups)
    print(f"branch {dimension}: {groups} groups in {table}")
