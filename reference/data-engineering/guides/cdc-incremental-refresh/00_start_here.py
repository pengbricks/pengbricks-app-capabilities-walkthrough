# Databricks notebook source
# MAGIC %md
# MAGIC # CDC and incremental refresh in pipelines
# MAGIC
# MAGIC This guide loads change data from three kinds of source into one serverless Lakeflow Declarative Pipeline with AUTO CDC, then measures what an incremental update, a full refresh and a selective full refresh each do. The sources are Debezium-style change files, the Delta change data feed of an operational table, and a snapshot table that is replaced whole on every run. A materialized view over the type 1 table shows incremental materialized view refresh.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_reset_sources` | Resets `cdc_orders_source` and `cdc_orders_snapshot` to the seed, drops `cdc_orders_bronze`, and writes change batch 1 to the landing folder under fixed file names. Makes reruns identical. |
# MAGIC | `02_inspect_initial` | After the full refresh (the job's first pipeline task): reads the event log, shows rows written and the offsets each flow started from, and records them. |
# MAGIC | `03_apply_changes` | MERGEs inserts, updates and deletes into `cdc_orders_source`, lands change batch 2 as new files, and replaces the snapshot table. |
# MAGIC | `04_inspect_incremental` | After the incremental update: shows that only the new data was processed and where each flow resumed. Checks the targets against the plan. |
# MAGIC | `05_compare_refresh_modes` | After a selective full refresh of `cdc_orders_daily`: sets the three updates side by side and shows what the full refresh keeps. |
# MAGIC | `pipeline/cdc_orders.py` | The pipeline source: Auto Loader bronze, the three AUTO CDC flows and the materialized view. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability_guides_cdc` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. `02`, `04` and `05` start the pipeline update themselves when run by hand.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog`, `schema` | Unity Catalog location of the tables and the pipeline. |
# MAGIC | `volume` | Volume that holds the landing folder `cdc_orders_events/`. Defaults to `exports`. |
# MAGIC | `rows`, `inserts`, `updates`, `deletes` | Seed orders, and the size of change batch 2. Defaults: 500, 50, 120, 30. |
# MAGIC | `run_pipeline` | `true` starts a pipeline update and waits for it. The job sets it to `false` because its pipeline task already ran. Defaults to `true` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC ## How the pipeline knows what is new
# MAGIC
# MAGIC | Part | What marks "new" | Where it is stored |
# MAGIC |---|---|---|
# MAGIC | Auto Loader (bronze) | The files it has already processed. Rewriting or renaming a file does not make it new again by itself. | The flow's checkpoint. The pipeline manages the checkpoint and schema locations; you do not set them. |
# MAGIC | Delta streaming read | The last Delta table version processed. | The flow's checkpoint (`reservoirVersion` in the event log). |
# MAGIC | Change data feed | `_change_type`, `_commit_version` and `_commit_timestamp`, computed from the Delta log. With row tracking, Automatic change data feed does this at query time, so the table needs no `delta.enableChangeDataFeed`. | The source table's Delta log and row ids. |
# MAGIC | AUTO CDC | `keys` identify the row, `sequence_by` orders events (late ones lose), `apply_as_deletes` marks deletes. | The target table. |
# MAGIC | AUTO CDC from snapshot | Each snapshot is compared with the previous one by key. | The pipeline's state for the flow. |
# MAGIC | Materialized view | Row tracking and the Delta log of its sources show which rows changed. It recomputes completely when it cannot work that out. | The planning event for each update. |
# MAGIC | Full refresh | Nothing: it clears the checkpoints and state, so everything still in the source is new. | |
# MAGIC
# MAGIC Renaming a flow or a streaming table starts it from a fresh checkpoint.
# MAGIC
# MAGIC ## Where each setting lives
# MAGIC
# MAGIC | Setting | Where | What it controls |
# MAGIC |---|---|---|
# MAGIC | `keys`, `sequence_by`, `apply_as_deletes`, `except_column_list` | `pipeline/cdc_orders.py`, `create_auto_cdc_flow` calls | Row identity, ordering, deletes and dropped columns. |
# MAGIC | `stored_as_scd_type`, `track_history_column_list` | the same calls | Type 1 or type 2, and which columns open a history version. |
# MAGIC | `pipelines.reset.allowed` | table properties of `cdc_orders_bronze` | Whether a full refresh may clear the table. |
# MAGIC | `delta.enableRowTracking` | `cdc_orders_scd1` in the pipeline, `cdc_orders_source` in `01_reset_sources` | Incremental materialized view refresh and Automatic change data feed. |
# MAGIC | `cloudFiles.format`, `schemaHints`, `inferColumnTypes` | `cdc_orders_bronze` options | How Auto Loader reads and types the files. File detection is left at its default, directory listing. |
# MAGIC | `cdc_landing_path`, `cdc_source_table`, `cdc_snapshot_table` | `configuration` in `resources/cdc.pipeline.yml`, read with `spark.conf.get` | Where the pipeline reads. Filled from bundle variables. |
# MAGIC | `full_refresh`, `full_refresh_selection` | `pipeline_task` in `resources/cdc.job.yml` | Which tasks do a full refresh, and of which tables. |
# MAGIC | Flow and table names | `name=` arguments in the pipeline | Checkpoint identity. |

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_cdc"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'volume', 'rows', 'inserts', 'updates', 'deletes'])
print(params)

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

pipelines = [p for p in w.pipelines.list_pipelines() if "capability-guides-cdc" in (p.name or "")]
for p in pipelines:
    links.append(f'<li>Pipeline <b>{p.name}</b>: <a href="{host}/pipelines/{p.pipeline_id}">open</a></li>')
displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
