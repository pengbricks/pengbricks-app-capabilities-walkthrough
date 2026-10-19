# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Compare the refresh modes
# MAGIC
# MAGIC The last update is a **selective full refresh** of one dataset, `cdc_orders_daily`. It recomputes that materialized view from scratch and leaves every other dataset alone. This notebook sets the three updates side by side: initial full refresh, incremental, and selective full refresh.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_cdc", ['catalog', 'schema', 'run_pipeline'], defaults={'run_pipeline': 'true'})
catalog, schema = params["catalog"], params["schema"]
scope = f"{catalog}.{schema}"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Start the selective refresh and wait
# MAGIC
# MAGIC In the job, the `pipeline_task` sets `full_refresh_selection: [cdc_orders_daily]` and `run_pipeline` is `false`. Run by hand, this notebook starts the same update with the SDK: `start_update(full_refresh_selection=[...])`.

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from de_common.pipelines import find_pipeline_id, run_update

w = WorkspaceClient()
pipeline_id = find_pipeline_id(w, "capability-guides-cdc")
print(f"pipeline {pipeline_id}: {w.config.host.rstrip('/')}/pipelines/{pipeline_id}")
if params["run_pipeline"].lower() == "true":
    run_update(w, pipeline_id, full_refresh_selection=["cdc_orders_daily"])
else:
    print("run_pipeline = false: the job's pipeline task already ran, so this notebook only inspects.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## The selective update

# COMMAND ----------

from de_common import cdc_metrics

events = cdc_metrics.read_events(spark, pipeline_id)
latest = cdc_metrics.latest_by_mode(events)
selective = cdc_metrics.summarize_update(events, latest["selective_full_refresh"])
print(f"update {selective['update_id'][:8]}: {selective['refresh_mode']}, {selective['duration_s']} s")
display(cdc_metrics.dataset_table(spark, selective))
display(cdc_metrics.record_update(spark, scope, selective, "05_compare_refresh_modes"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Three updates side by side
# MAGIC
# MAGIC Rows written and maintenance type per dataset, from the newest update of each mode. A blank cell means the dataset was not part of that update.
# MAGIC
# MAGIC - Streaming tables: the full refresh rewrote everything the sources still held. The incremental update wrote only the changed rows.
# MAGIC - `cdc_orders_daily`: the maintenance type shows whether the materialized view refreshed incrementally or recomputed completely.

# COMMAND ----------

summaries = [cdc_metrics.summarize_update(events, latest[mode]) for mode in ("full_refresh", "incremental", "selective_full_refresh")]
table = cdc_metrics.comparison(spark, scope, summaries)
display(table)
print(table.toPandas().to_string(index=False))

# COMMAND ----------

# MAGIC %md
# MAGIC ## What a full refresh keeps
# MAGIC
# MAGIC `cdc_orders_bronze` has `pipelines.reset.allowed = false`. A full refresh of the whole pipeline skips it, so the events it ingested stay, even though the files that carried them could be gone. The selective refresh above did not touch it either. Both landing batches are still in bronze:

# COMMAND ----------

display(spark.sql(f"SELECT _source_file, count(*) AS events FROM {scope}.cdc_orders_bronze GROUP BY _source_file ORDER BY _source_file"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## The run log
# MAGIC
# MAGIC `cdc_refresh_metrics` keeps the measurements of every recorded update. It grows by one run's rows each time the job runs.

# COMMAND ----------

display(spark.sql(f"SELECT * FROM {scope}.cdc_refresh_metrics ORDER BY run_ts DESC, update_id, dataset LIMIT 40"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Check the selective update
# MAGIC
# MAGIC Only the materialized view should have run, and it should have recomputed completely.

# COMMAND ----------

assert list(selective["datasets"]) == ["cdc_orders_daily"], selective["datasets"].keys()
assert selective["datasets"]["cdc_orders_daily"]["maintenance_type"] == "COMPLETE_RECOMPUTE", selective["datasets"]
print("The selective full refresh recomputed only cdc_orders_daily.")
