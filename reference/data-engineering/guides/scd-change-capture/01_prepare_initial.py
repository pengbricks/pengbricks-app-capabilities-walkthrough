# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Prepare the initial snapshot
# MAGIC
# MAGIC Safe to rerun: `accounts_changes` is overwritten with the same snapshot every run.
# MAGIC
# MAGIC Replaces `accounts_changes` with the initial snapshot: every row is an INSERT with `change_seq` 1.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_scd", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
scope = f"{catalog}.{schema}"
ROOT = bundle_root()
USE_CASE_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the snapshot

# COMMAND ----------

from pyspark.sql import functions as F
from de_common.accounts import initial_snapshot
from de_common.spec import load_use_case

spec = load_use_case(USE_CASE_FILE)
table = f"{scope}.accounts_changes"
df = initial_snapshot(spark, spec).withColumn("change_type", F.lit("INSERT")).withColumn("change_seq", F.lit(1))
df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
counts = {r["change_type"]: r["n"] for r in df.groupBy("change_type").agg(F.count("*").alias("n")).collect()}
print(f"initial: wrote {df.count()} rows to {table}: {counts}")
