# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Append new data
# MAGIC
# MAGIC Adds new rows so the table moves past the version the tracked run recorded. It adds only keys that are not in the table yet (a left anti join), so running it again adds nothing.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_experiment_rerun", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
ROOT = bundle_root()
spec = c.load_spec(str(ROOT / "use_cases" / f"{params['use_case']}.yml"))

# COMMAND ----------

table = c.fq(catalog, schema, "experiment_data")
before = c.delta_version(spark, table)
rows = spec["source"]["rows"] // 10
new = c.build_frame(spark, spec, rows, spec["seed"] + 1, id_offset=spec["source"]["rows"])
# Only add keys that are not in the table yet, so running this task again adds nothing.
key = spec["source"]["key"]
new = new.join(spark.table(table).select(key), key, "left_anti")
new.write.mode("append").saveAsTable(table)
print(f"Appended up to {rows} new rows: table moved from version {before} to {c.delta_version(spark, table)}")
