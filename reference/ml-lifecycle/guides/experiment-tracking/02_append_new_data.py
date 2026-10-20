# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Append new data
# MAGIC
# MAGIC Adds the customers who are new by the 2010-12-01 snapshot (945 in the reference run) so the table moves past the version the tracked run recorded. It adds only keys that are not in the table yet (a left anti join), so running it again adds nothing.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_experiment_rerun", ['catalog', 'schema', 'use_case', 'source_volume'])
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
ROOT = bundle_root()
spec = c.load_spec(str(ROOT / "use_cases" / f"{params['use_case']}.yml"))

# COMMAND ----------

table = c.fq(catalog, schema, "experiment_data")
before = c.delta_version(spark, table)
transactions = c.fq(catalog, schema, spec["source"]["transactions_table"])
c.ensure_transactions(spark, spec, transactions, f"/Volumes/{catalog}/{schema}/{params['source_volume']}")
later = spec["experiment"]["append_snapshot_date"]
# Customers who placed a first order after the tracked snapshot. Only keys not in the table yet are
# added, so running this task again adds nothing.
key = spec["source"]["key"]
new = c.snapshot_frame(spark, spec, transactions, later).join(spark.table(table).select(key), key, "left_anti")
rows = new.count()
new.write.mode("append").saveAsTable(table)
print(f"Appended {rows} customers new by {later}: table moved from version {before} to {c.delta_version(spark, table)}")
