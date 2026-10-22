# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
import time
params = load_params(dbutils, "capability_guides_batch_real_time", ["catalog", "schema", "use_case"])

from pyspark.sql import functions as F
from capability_framework.datagen import bad_row_exprs, canonical
from capability_framework.landing import batch_file_name, batch_id_offset
from capability_framework.use_case import load_use_case

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read the streaming settings
# MAGIC
# MAGIC The spec's `streaming` block sets the feed folder, how many batches to land, and how many events each holds. Safe to rerun: each batch has a fixed file name and id range, and a batch already in the landing folder is skipped.

# COMMAND ----------

spec = load_use_case(bundle_root() / "use_cases" / f"{params['use_case']}.yml")
stream = spec["streaming"]
landing = f"/Volumes/{params['catalog']}/{params['schema']}/landing"
events_dir = f"{landing}/{stream['feed']}"
staging_root = f"{landing}/_staging"
rows = int(stream["rows_per_batch"])
batches = int(stream["batches"])
print(events_dir, batches, "batches of", rows, "events")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Find what is already landed
# MAGIC
# MAGIC Each batch has a fixed file name and a fixed id range. A batch that is already in the folder is skipped, so a rerun never gives Auto Loader a second copy of the same sample events.

# COMMAND ----------

def exists(path: str) -> bool:
    try:
        dbutils.fs.ls(path)
        return True
    except Exception:
        return False


wanted = {batch_file_name(b) for b in range(batches)}
existing = {f.name for f in dbutils.fs.ls(events_dir)} if exists(events_dir) else set()

# Files from earlier runs that used time-based names. Auto Loader tracks files by path,
# so removing them cannot re-ingest anything, and they stop piling up in the landing folder.
for name in sorted(existing - wanted):
    dbutils.fs.rm(f"{events_dir}/{name}")
    print(f"Removed stale landed file {name}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Land the missing batches
# MAGIC
# MAGIC Each batch is written outside the watched folder and then moved in as one file under its fixed name, so Auto Loader never sees a half-written file.

# COMMAND ----------

for batch in range(batches):
    final = f"{events_dir}/{batch_file_name(batch)}"
    if batch_file_name(batch) in existing:
        print(f"Batch {batch + 1} already landed as {batch_file_name(batch)}; skipping")
        continue
    events = canonical(spark, spec, rows, seed_offset=1000 + batch, id_offset=batch_id_offset(batch, rows))
    for column, expression in bad_row_exprs(spec):
        events = events.withColumn(column, F.expr(expression))
    events = events.select(
        F.col("record_id").alias("event_id"),
        "account_id",
        F.date_format(F.current_timestamp(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").alias("event_ts"),
        F.col("amount").cast("double").alias("amount"),
        "currency",
        "status",
    )
    staging = f"{staging_root}/{batch_file_name(batch)}"
    dbutils.fs.rm(staging, True)
    events.coalesce(1).write.mode("overwrite").json(staging)
    part = next(f.path for f in dbutils.fs.ls(staging) if f.name.startswith("part-") and f.name.endswith(".json"))
    dbutils.fs.mv(part, final)
    dbutils.fs.rm(staging, True)
    print(f"Landed streaming batch {batch + 1} with {rows} events as {batch_file_name(batch)}")
    time.sleep(5)
