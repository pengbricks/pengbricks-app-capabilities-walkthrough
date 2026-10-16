# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Extract
# MAGIC
# MAGIC Generates the raw orders from the use-case spec, including a few corrupted rows for the next task to reject. It passes the row count and table name to later tasks as task values. Task values are how one job task hands a result to the next. The table is overwritten, so a rerun replaces it.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_orchestration", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
prefix = f"{catalog}.{schema}"

import guide_lib as g
spec = g.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))

# COMMAND ----------

df = g.build_orders(spark, spec, rows=int(spec["orchestration"]["rows"]), with_bad_rows=True)
table = f"{prefix}.orch_orders_raw"
df.write.mode("overwrite").saveAsTable(table)
row_count = spark.table(table).count()

dbutils.jobs.taskValues.set(key="row_count", value=row_count)
dbutils.jobs.taskValues.set(key="source_table", value=table)
print(f"extract: wrote {row_count} rows to {table}")
