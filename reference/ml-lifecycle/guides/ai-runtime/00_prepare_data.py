# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 0. Prepare the churn snapshot (CPU)
# MAGIC
# MAGIC AI Runtime has no local Spark (tables are read through Spark Connect), so this serverless CPU task does the Spark work. It downloads the UCI Online Retail II zip (checksum verified, cached in the source volume), builds the 2010-09-01 customer snapshot, and writes it as one Parquet file in a Unity Catalog volume. The GPU notebooks read that file. Safe to rerun: the zip is downloaded once, and the Parquet file and the `ai_runtime_churn` table are overwritten with the same rows.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ai_runtime", ['catalog', 'schema', 'use_case', 'source_volume'])
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
import gpu_churn as g
ROOT = bundle_root()
spec = c.load_spec(str(ROOT / "use_cases" / f"{params['use_case']}.yml"))

# COMMAND ----------

transactions = c.fq(catalog, schema, spec["source"]["transactions_table"])
c.ensure_transactions(spark, spec, transactions, f"/Volumes/{catalog}/{schema}/{params['source_volume']}")
frame = c.snapshot_frame(spark, spec, transactions)
frame.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(c.fq(catalog, schema, "ai_runtime_churn"))

pdf = spark.table(c.fq(catalog, schema, "ai_runtime_churn")).toPandas()
path = g.snapshot_path(catalog, schema, params["source_volume"])
os.makedirs(os.path.dirname(path), exist_ok=True)
pdf.to_parquet(path, index=False)
print(f"Wrote {len(pdf)} customers to {path}")
