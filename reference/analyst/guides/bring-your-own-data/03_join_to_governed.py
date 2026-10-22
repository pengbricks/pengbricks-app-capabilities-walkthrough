# Databricks notebook source
# MAGIC %md
# MAGIC # 3. Join the upload to the governed table
# MAGIC
# MAGIC A full outer join keeps keys from both sides. Each key gets a `match_status`: `matched`, `upload_only` or `governed_only`. Run `02_simulate_upload` first. Safe to rerun: both result tables are overwritten.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_byod", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
fq = f"{catalog}.{schema}"
ROOT = bundle_root()
SPEC_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read the upload and the governed table

# COMMAND ----------

from pyspark.sql import functions as F
from analyst_common.helpers import match_counts, upload_path
from analyst_common.spec import load_spec

upload = load_spec(SPEC_FILE)["upload"]
user = spark.sql("SELECT current_user()").first()[0]
path = upload_path(catalog, schema, "uploads", user, upload["file_name"])

uploaded = (
    spark.read.option("header", "true").option("inferSchema", "true").csv(path)
    .withColumn("customer_id", F.trim("customer_id"))
    .withColumn("in_upload", F.lit(True))
)
governed = spark.table(f"{fq}.analyst_customers").select("customer_id", "region", "segment").withColumn("in_governed", F.lit(True))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Full outer join and classify each key
# MAGIC
# MAGIC The table is overwritten, so a rerun replaces it.

# COMMAND ----------

joined = (
    uploaded.join(governed, "customer_id", "full_outer")
    .withColumn("in_upload", F.coalesce("in_upload", F.lit(False)))
    .withColumn("in_governed", F.coalesce("in_governed", F.lit(False)))
    .withColumn(
        "match_status",
        F.when(F.col("in_upload") & F.col("in_governed"), "matched")
        .when(F.col("in_upload"), "upload_only")
        .otherwise("governed_only"),
    )
    .withColumn("source_path", F.lit(path))
)
joined.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{fq}.byod_joined")
display(spark.table(f"{fq}.byod_joined").groupBy("match_status").count())

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the match counts

# COMMAND ----------

rows = spark.table(f"{fq}.byod_joined").groupBy("match_status").count().collect()
counts = match_counts([r["match_status"] for r in rows for _ in range(r["count"])])
print("Match counts:", counts)
result = spark.createDataFrame(
    [(status, n, path, user, params["run_id"]) for status, n in counts.items()],
    "match_status STRING, key_count BIGINT, source_path STRING, uploaded_by STRING, run_id STRING",
).withColumn("recorded_at", F.current_timestamp())
result.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{fq}.byod_match_counts")
if counts["matched"] == 0:
    raise Exception("No uploaded key matched the governed table")
