# Databricks notebook source
# MAGIC %md
# MAGIC # 6. Publish or hold
# MAGIC
# MAGIC The job's condition task compares the validate task's `valid_rows` with `min_valid_rows`. It runs this notebook with `outcome = publish` when the condition is true and `outcome = hold` when it is false. Run by hand with `outcome` blank, the notebook makes the same comparison itself.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_orchestration", ['catalog', 'schema', 'min_valid_rows', 'run_id', 'outcome'],
                     defaults={'run_id': 'manual', 'outcome': 'auto'})
prefix = f"{params['catalog']}.{params['schema']}"
run_id, outcome = params["run_id"], params["outcome"]
if outcome == "auto":
    valid_rows = spark.table(f"{prefix}.orch_orders_valid").count()
    outcome = "publish" if valid_rows > int(params["min_valid_rows"]) else "hold"
    print(f"{valid_rows} valid rows against a minimum of {params['min_valid_rows']}: {outcome}")
if outcome not in ("publish", "hold"):
    raise ValueError(f"outcome must be publish, hold or auto, got {outcome!r}")

# COMMAND ----------

spark.sql(f"CREATE TABLE IF NOT EXISTS {prefix}.orch_branch_outcomes (job_run_id STRING, outcome STRING, decided_at TIMESTAMP)")
spark.sql(f"DELETE FROM {prefix}.orch_branch_outcomes WHERE job_run_id = '{run_id}'")
spark.sql(f"INSERT INTO {prefix}.orch_branch_outcomes VALUES ('{run_id}', '{outcome}', current_timestamp())")
if outcome == "publish":
    spark.sql(f"CREATE OR REPLACE TABLE {prefix}.orch_published_summary AS SELECT * FROM {prefix}.orch_summary_by_region")
print(f"branch outcome: {outcome}")
