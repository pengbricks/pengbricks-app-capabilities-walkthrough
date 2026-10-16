# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Generate the source table
# MAGIC
# MAGIC Writes the source table from the use-case spec with dbldatagen and a fixed seed. The table is overwritten, so a rerun replaces the data.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_feature_preparation", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
spec = c.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))

# COMMAND ----------

table = c.fq(catalog, schema, spec["source"]["table"])
df = c.build_frame(spark, spec, spec["source"]["rows"], spec["seed"])
df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
version = c.delta_version(spark, table)
nulls = spark.sql(f"SELECT count(*) FROM {table} WHERE usage_score IS NULL").collect()[0][0]
dbutils.jobs.taskValues.set(key="source_version", value=version)
print(f"Wrote {spark.table(table).count()} rows to {table} (Delta version {version}, {nulls} null usage_score)")
