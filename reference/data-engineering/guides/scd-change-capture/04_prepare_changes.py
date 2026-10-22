# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Prepare the change batch
# MAGIC
# MAGIC Safe to rerun: it checks that the initial load exists, writes the batch only if it is not there yet, and never deletes rows the pipeline may have read.
# MAGIC
# MAGIC Adds the change batch to `accounts_changes` as `change_seq` 2: inserts, updates and deletes. It never deletes rows, because the pipeline may already have read them: if the batch is there, it does nothing.

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
# MAGIC ## Write the batch

# COMMAND ----------

from pyspark.sql import functions as F
from de_common.accounts import change_batch
from de_common.scd import batch_in_changes, initial_loaded
from de_common.spec import load_use_case

spec = load_use_case(USE_CASE_FILE)
table = f"{scope}.accounts_changes"
df = change_batch(spark, spec).withColumn("change_seq", F.lit(2))
have = batch_in_changes(spark, scope)
if not initial_loaded(spark, scope):
    raise RuntimeError("accounts_scd2 is empty or missing. Run 01_prepare_initial and 02_run_pipeline_initial first. Nothing was changed.")
if have not in (0, df.count()):
    raise RuntimeError(f"accounts_changes holds {have} rows of change_seq 2, not the {df.count()} this notebook writes. Rerun the job from 01_prepare_initial. Nothing was changed.")
if have == 0:
    df.write.mode("append").saveAsTable(table)  # the stream only ever sees this batch appended once
else:
    print(f"The change batch is already in {table} ({have} rows); nothing to write.")
counts = {r["change_type"]: r["n"] for r in df.groupBy("change_type").agg(F.count("*").alias("n")).collect()}
print(f"changes: wrote {df.count()} rows to {table}: {counts}")
