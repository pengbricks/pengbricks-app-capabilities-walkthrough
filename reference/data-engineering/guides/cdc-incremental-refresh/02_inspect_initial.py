# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Inspect the initial load
# MAGIC
# MAGIC The first update is a **full refresh**: every table is cleared and rebuilt from whatever its source still holds. This notebook reads the pipeline event log to show what each dataset wrote and where each streaming flow started reading, and records it in `cdc_refresh_metrics`.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_cdc", ['catalog', 'schema', 'run_pipeline'], defaults={'run_pipeline': 'true'})
catalog, schema = params["catalog"], params["schema"]
scope = f"{catalog}.{schema}"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Start an update and wait
# MAGIC
# MAGIC Run by hand, this notebook is how you run the pipeline: it starts a full refresh. In the job, the pipeline task has already run, so `run_pipeline` is `false` and this notebook only inspects.

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from de_common.pipelines import find_pipeline_id, run_update

w = WorkspaceClient()
pipeline_id = find_pipeline_id(w, "capability-guides-cdc")
print(f"pipeline {pipeline_id}: {w.config.host.rstrip('/')}/pipelines/{pipeline_id}")
if params["run_pipeline"].lower() == "true":
    run_update(w, pipeline_id, full_refresh=True)
else:
    print("run_pipeline = false: the job's pipeline task already ran, so this notebook only inspects.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## What the update did, from the event log
# MAGIC
# MAGIC - `rows_written` and `rows_deleted` come from `flow_progress` metrics. For a streaming table they count rows upserted into the target, which for SCD type 2 includes the closed versions. The snapshot flow reports no row metrics.
# MAGIC - `source_offsets` come from `stream_progress`: the Delta table versions or the Auto Loader file-queue position the flow read. A first update has no earlier checkpoint, so it starts at the beginning.
# MAGIC - `maintenance_type` is how the materialized view was refreshed. After a full refresh it is a complete recompute.

# COMMAND ----------

from de_common import cdc_metrics

events = cdc_metrics.read_events(spark, pipeline_id)
update_id = cdc_metrics.latest_by_mode(events)["full_refresh"]
summary = cdc_metrics.summarize_update(events, update_id)
print(f"update {update_id[:8]}: {summary['refresh_mode']}, {summary['duration_s']} s")
display(cdc_metrics.dataset_table(spark, summary))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record it
# MAGIC
# MAGIC `cdc_refresh_metrics` is a run log. It gains one row per dataset every time a notebook records an update.

# COMMAND ----------

display(cdc_metrics.record_update(spark, scope, summary, "02_inspect_initial"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Check the targets against their sources
# MAGIC
# MAGIC Each target should hold one current row per source row. Type 2 tables have `__END_AT IS NULL` on current rows.

# COMMAND ----------

def count(sql):
    return spark.sql(sql).first()[0]

checks = {
    "cdc_orders_scd1": (count(f"SELECT count(*) FROM {scope}.cdc_orders_scd1"), count(f"SELECT count(*) FROM {scope}.cdc_orders_source")),
    "cdc_orders_from_cdf": (count(f"SELECT count(*) FROM {scope}.cdc_orders_from_cdf WHERE __END_AT IS NULL"), count(f"SELECT count(*) FROM {scope}.cdc_orders_source")),
    "cdc_orders_snapshot_scd2": (count(f"SELECT count(*) FROM {scope}.cdc_orders_snapshot_scd2 WHERE __END_AT IS NULL"), count(f"SELECT count(*) FROM {scope}.cdc_orders_snapshot")),
}
for name, (target, source) in checks.items():
    print(f"{name:<26} current rows {target:>5}   source rows {source:>5}")
bad = [name for name, (target, source) in checks.items() if target != source]
if bad:
    raise Exception(f"targets differ from their sources: {bad}")
print("Every target matches its source.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## The bronze table
# MAGIC
# MAGIC One row per event, with the file each came from. `cdc_orders_bronze` has `pipelines.reset.allowed = false`, so a full refresh does not clear it.

# COMMAND ----------

display(spark.sql(f"SELECT _source_file, count(*) AS events FROM {scope}.cdc_orders_bronze GROUP BY _source_file ORDER BY _source_file"))
