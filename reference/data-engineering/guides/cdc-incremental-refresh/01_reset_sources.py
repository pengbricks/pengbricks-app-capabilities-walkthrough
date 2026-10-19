# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Reset the sources
# MAGIC
# MAGIC Puts all three sources back to the seed state, so the job gives the same result on every run:
# MAGIC
# MAGIC - `cdc_orders_source`: the operational Delta table, replaced with the seed orders.
# MAGIC - `cdc_orders_snapshot`: the snapshot table, replaced with the same seed.
# MAGIC - The landing folder: old event files deleted, then change batch 1 written under fixed file names.
# MAGIC - `cdc_orders_bronze`: dropped if it exists, because a full refresh will not clear it (see below).

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_cdc", ['catalog', 'schema', 'volume', 'rows', 'inserts', 'updates', 'deletes'])
catalog, schema, volume = params["catalog"], params["schema"], params["volume"]
scope = f"{catalog}.{schema}"
rows = int(params["rows"])
LANDING = f"/Volumes/{catalog}/{schema}/{volume}/cdc_orders_events"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Seed orders
# MAGIC
# MAGIC The same deterministic orders every run. `order_id` is the key.

# COMMAND ----------

from de_common import cdc

orders = cdc.seed_orders(rows)
print(f"{len(orders)} seed orders, first: {orders[0]}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## The operational table
# MAGIC
# MAGIC `cdc_orders_source` stands in for a source system's table. Row tracking is on, which is what Automatic change data feed needs. The next notebook reads it as a change feed, so a MERGE on it shows up as inserts, updates and deletes.

# COMMAND ----------

from pyspark.sql import functions as F

schema_ddl = "order_id BIGINT, customer_id BIGINT, status STRING, amount DECIMAL(10,2), channel STRING, updated_at STRING"
RAW_DDL = schema_ddl.replace("DECIMAL(10,2)", "DOUBLE")  # Python floats load as DOUBLE, then cast
spark.sql(f"""
CREATE OR REPLACE TABLE {scope}.cdc_orders_source ({schema_ddl})
TBLPROPERTIES ('delta.enableRowTracking' = 'true')
""")
orders_df = spark.createDataFrame(orders, RAW_DDL).withColumn("amount", F.col("amount").cast("decimal(10,2)"))
orders_df.writeTo(f"{scope}.cdc_orders_source").append()
print(spark.sql(f"SHOW TBLPROPERTIES {scope}.cdc_orders_source").where("key LIKE 'delta.enable%'").toPandas().to_string(index=False))

# COMMAND ----------

# MAGIC %md
# MAGIC ## The snapshot table
# MAGIC
# MAGIC A source that only gives full extracts. It is replaced whole on every run, with no change column.

# COMMAND ----------

(orders_df
    .write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{scope}.cdc_orders_snapshot"))
print(f"{scope}.cdc_orders_snapshot: {spark.table(f'{scope}.cdc_orders_snapshot').count()} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Start bronze from empty
# MAGIC
# MAGIC `cdc_orders_bronze` has `pipelines.reset.allowed = false`, so the job's full refresh keeps its rows and its Auto Loader checkpoint. Left alone, a rerun would still hold last run's batch 2 events and the "initial" load would already include them. Dropping the table is the deliberate way to reset it: the next pipeline update creates it again with a new checkpoint and reads the files from scratch.

# COMMAND ----------

spark.sql(f"DROP TABLE IF EXISTS {scope}.cdc_orders_bronze")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Change batch 1: the landing folder
# MAGIC
# MAGIC Debezium-style events: `op` is `c`, `u` or `d`, with a `before` and an `after` image, a source timestamp and an LSN. Old files are deleted first and the new ones get fixed names (`batch1_part_000.json`), so a rerun rewrites the same files instead of adding new ones.

# COMMAND ----------

dbutils.fs.rm(LANDING, True)
dbutils.fs.mkdirs(LANDING)
files = cdc.event_files(cdc.batch1_events(orders), "batch1")
for name, text in files.items():
    with open(f"{LANDING}/{name}", "w") as handle:
        handle.write(text)
print(f"wrote {len(files)} files to {LANDING}")
display(dbutils.fs.ls(LANDING))
