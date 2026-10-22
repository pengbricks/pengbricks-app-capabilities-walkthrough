# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Prepare the target and the source batch
# MAGIC
# MAGIC Safe to rerun: both tables are overwritten with the same generated rows.
# MAGIC
# MAGIC Creates `accounts_target` from the initial snapshot, and `accounts_source_batch` with the inserts, updates and deletes to apply. Both are overwritten, so every run starts from the same state.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_target_loading", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
scope = f"{catalog}.{schema}"
ROOT = bundle_root()
USE_CASE_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write both tables

# COMMAND ----------

from de_common.accounts import change_batch, initial_snapshot
from de_common.spec import load_use_case

spec = load_use_case(USE_CASE_FILE)
initial_snapshot(spark, spec).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{scope}.accounts_target")
change_batch(spark, spec).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{scope}.accounts_source_batch")
print("target rows:", spark.table(f"{scope}.accounts_target").count())
display(spark.table(f"{scope}.accounts_source_batch").groupBy("change_type").count())
