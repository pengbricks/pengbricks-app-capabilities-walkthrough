# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Apply the changes
# MAGIC
# MAGIC Safe to rerun: it checks that the source table and the batch 1 files exist, the MERGE sets rows to the same values the second time, batch 2 files keep fixed names, and the snapshot is overwritten.
# MAGIC
# MAGIC Changes all three sources, so the next pipeline update has something new to find:
# MAGIC
# MAGIC - `cdc_orders_source`: a MERGE applies inserts, updates and deletes. The change data feed records each row change.
# MAGIC - The landing folder: change batch 2 is written as new files with fixed names. Batch 1 stays where it is.
# MAGIC - `cdc_orders_snapshot`: replaced with the full table as it looks after the changes.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_cdc", ['catalog', 'schema', 'volume', 'rows', 'inserts', 'updates', 'deletes'])
catalog, schema, volume = params["catalog"], params["schema"], params["volume"]
scope = f"{catalog}.{schema}"
rows, inserts, updates, deletes = (int(params[k]) for k in ("rows", "inserts", "updates", "deletes"))
LANDING = f"/Volumes/{catalog}/{schema}/{volume}/cdc_orders_events"
if not spark.catalog.tableExists(f"{scope}.cdc_orders_source") or not any(n.startswith("batch1") for n in (os.listdir(LANDING) if os.path.isdir(LANDING) else [])):
    raise RuntimeError("cdc_orders_source or the batch 1 landing files are missing. Run 01_reset_sources first. Nothing was changed.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Plan the batch
# MAGIC
# MAGIC Disjoint ids for the updates, deletes and inserts. One in three updates changes only `channel`, which the history table ignores because it tracks `status` and `amount`.

# COMMAND ----------

from de_common import cdc

seed = cdc.seed_orders(rows)
plan = cdc.plan_batch2(rows, inserts, updates, deletes)
after = cdc.apply_batch2(seed, plan)
print(f"{inserts} inserts, {updates} updates ({plan['channel_only_updates']} channel-only), {deletes} deletes -> {len(after)} orders")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Change the operational table with one MERGE

# COMMAND ----------

from pyspark.sql import functions as F

RAW_DDL = "order_id BIGINT, customer_id BIGINT, status STRING, amount DOUBLE, channel STRING, updated_at STRING"  # Python floats load as DOUBLE
changes = spark.createDataFrame(
    [o | {"op": "u"} for o in after if o["order_id"] in set(plan["update_ids"])]
    + [o | {"op": "c"} for o in after if o["order_id"] in set(plan["insert_ids"])]
    + [seed[i] | {"op": "d"} for i in plan["delete_ids"]],
    RAW_DDL + ", op STRING",
).withColumn("amount", F.col("amount").cast("decimal(10,2)"))
changes.createOrReplaceTempView("cdc_batch2")
result = spark.sql(f"""
MERGE INTO {scope}.cdc_orders_source t USING cdc_batch2 s ON t.order_id = s.order_id
WHEN MATCHED AND s.op = 'd' THEN DELETE
WHEN MATCHED THEN UPDATE SET t.customer_id = s.customer_id, t.status = s.status, t.amount = s.amount,
                             t.channel = s.channel, t.updated_at = s.updated_at
WHEN NOT MATCHED AND s.op != 'd' THEN INSERT (order_id, customer_id, status, amount, channel, updated_at)
VALUES (s.order_id, s.customer_id, s.status, s.amount, s.channel, s.updated_at)
""")
display(result)
print(f"{scope}.cdc_orders_source: {spark.table(f'{scope}.cdc_orders_source').count()} rows (expected {len(after)})")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Land change batch 2
# MAGIC
# MAGIC Updates, deletes and inserts with ascending LSNs, written newest first so the files arrive out of order. One extra event is a late, stale change to the first updated order, with an LSN below the real update. AUTO CDC drops it because `sequence_by` already applied a later LSN. Files from an earlier run of this notebook are overwritten, not duplicated.

# COMMAND ----------

files = cdc.event_files(cdc.batch2_events(seed, plan), "batch2", reverse=True)
for name, text in files.items():
    with open(f"{LANDING}/{name}", "w") as handle:
        handle.write(text)
print(f"wrote {len(files)} files to {LANDING}")
display(dbutils.fs.ls(LANDING))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Replace the snapshot
# MAGIC
# MAGIC The snapshot source has no change information. It is the full table after the changes, and the pipeline works out the differences.

# COMMAND ----------

(spark.table(f"{scope}.cdc_orders_source")
    .write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{scope}.cdc_orders_snapshot"))
print(f"{scope}.cdc_orders_snapshot: {spark.table(f'{scope}.cdc_orders_snapshot').count()} rows")
