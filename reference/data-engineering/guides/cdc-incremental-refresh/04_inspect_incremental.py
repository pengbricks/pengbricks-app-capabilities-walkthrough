# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Inspect the incremental update
# MAGIC
# MAGIC The second update is **not** a full refresh. Each streaming flow resumes from its checkpoint, so it reads only what is new since the first update. This notebook shows the evidence: the rows each dataset wrote, and the offset each flow started from, which is where the first update stopped.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_cdc", ['catalog', 'schema', 'rows', 'inserts', 'updates', 'deletes', 'run_pipeline'], defaults={'run_pipeline': 'true'})
catalog, schema = params["catalog"], params["schema"]
scope = f"{catalog}.{schema}"
rows, inserts, updates, deletes = (int(params[k]) for k in ("rows", "inserts", "updates", "deletes"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Start an update and wait
# MAGIC
# MAGIC Run by hand, this notebook starts an incremental update. In the job, the pipeline task has already run, so `run_pipeline` is `false` and this notebook only inspects.

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from de_common.pipelines import find_pipeline_id, run_update

w = WorkspaceClient()
pipeline_id = find_pipeline_id(w, "capability-guides-cdc")
print(f"pipeline {pipeline_id}: {w.config.host.rstrip('/')}/pipelines/{pipeline_id}")
if params["run_pipeline"].lower() == "true":
    run_update(w, pipeline_id, full_refresh=False)
else:
    print("run_pipeline = false: the job's pipeline task already ran, so this notebook only inspects.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## What the update did, from the event log
# MAGIC
# MAGIC The bronze table should write only the new events: one per update, delete and insert in the change batch, plus the late event. Both flows that read Delta (`cdc_orders_scd1_flow` and `cdc_orders_from_cdf_flow`) write only the changed rows, not all 500 orders. `cdc_orders_snapshot_scd2` reports no row metrics: it compares the whole snapshot with the previous one.

# COMMAND ----------

from de_common import cdc, cdc_metrics

events = cdc_metrics.read_events(spark, pipeline_id)
latest = cdc_metrics.latest_by_mode(events)
summary = cdc_metrics.summarize_update(events, latest["incremental"])
print(f"update {summary['update_id'][:8]}: {summary['refresh_mode']}, {summary['duration_s']} s")
display(cdc_metrics.dataset_table(spark, summary))

# COMMAND ----------

# MAGIC %md
# MAGIC ## How the second update knew where to start
# MAGIC
# MAGIC Each streaming flow keeps a checkpoint. The incremental update starts where the initial update's checkpoint ended: Auto Loader at a file-queue position, the Delta flows at a table version. Compare the end of the first update with the start of the second.

# COMMAND ----------

initial = cdc_metrics.summarize_update(events, latest["full_refresh"])
offsets = [
    (dataset, initial["datasets"][dataset]["source_offsets"], summary["datasets"][dataset]["source_offsets"])
    for dataset in ["cdc_orders_bronze", "cdc_orders_scd1", "cdc_orders_from_cdf"]
]
for dataset, first, second in offsets:
    print(f"{dataset}\n  initial update:     {first}\n  incremental update: {second}")
display(spark.createDataFrame(offsets, "dataset string, initial_update string, incremental_update string"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record it

# COMMAND ----------

display(cdc_metrics.record_update(spark, scope, summary, "04_inspect_incremental"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Check the result
# MAGIC
# MAGIC After the change batch the targets hold the numbers the plan predicts, and the bronze table wrote only the new events.

# COMMAND ----------

expected = cdc.expected_counts(rows, inserts, updates, deletes)
count = lambda sql: spark.sql(sql).first()[0]
actual = {
    "scd1_final": count(f"SELECT count(*) FROM {scope}.cdc_orders_scd1"),
    "cdf_scd2_final_versions": count(f"SELECT count(*) FROM {scope}.cdc_orders_from_cdf"),
    "cdf_scd2_current": count(f"SELECT count(*) FROM {scope}.cdc_orders_from_cdf WHERE __END_AT IS NULL"),
    "snapshot_scd2_final_versions": count(f"SELECT count(*) FROM {scope}.cdc_orders_snapshot_scd2"),
}
for key, value in actual.items():
    print(f"{key:<30} {value:>5}  (expected {expected[key]})")
new_events = inserts + updates + deletes + 1  # plus the late event
written = summary["datasets"]["cdc_orders_bronze"]["rows_written"]
print(f"{'bronze rows written':<30} {written:>5}  (expected {new_events})")
problems = [k for k, v in actual.items() if v != expected[k]]
if written != new_events:
    problems.append("bronze rows written")
if problems:
    raise Exception("incremental result does not match the plan: " + ", ".join(problems))
print("The incremental update read only the new events and the targets match the plan.")
