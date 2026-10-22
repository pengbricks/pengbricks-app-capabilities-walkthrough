# Databricks notebook source
# MAGIC %md
# MAGIC # 2. Validate
# MAGIC
# MAGIC Safe to rerun: the valid-rows table is overwritten from the raw table.
# MAGIC
# MAGIC Reads the upstream task value, rejects bad rows, and publishes the valid-row count for the condition task. Run by hand, there is no upstream task value, so the notebook reads the table that `01_extract` wrote.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_orchestration", ['catalog', 'schema'])
prefix = f"{params['catalog']}.{params['schema']}"

# COMMAND ----------

def task_value(task_key, key):
    """The value an upstream job task passed on, or None when this notebook runs on its own."""
    try:
        return dbutils.jobs.taskValues.get(taskKey=task_key, key=key, default=None, debugValue=None)
    except ValueError:
        return None

source = task_value("extract", "source_table") or f"{prefix}.orch_orders_raw"
raw = spark.table(source)
expected = task_value("extract", "row_count")
expected = int(expected) if expected is not None else raw.count()

valid = raw.where("order_id IS NOT NULL AND amount >= 0")
valid.write.mode("overwrite").saveAsTable(f"{prefix}.orch_orders_valid")
valid_rows = spark.table(f"{prefix}.orch_orders_valid").count()
rejected = expected - valid_rows

dbutils.jobs.taskValues.set(key="valid_rows", value=valid_rows)
dbutils.jobs.taskValues.set(key="rejected_rows", value=rejected)
print(f"validate: {expected} rows from extract, {valid_rows} valid, {rejected} rejected")
