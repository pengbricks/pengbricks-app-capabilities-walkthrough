# Databricks notebook source
# MAGIC %md
# MAGIC # JSON, CSV, Parquet, Delta, and Iceberg
# MAGIC
# MAGIC This guide writes one generated order dataset (1 million rows with dates, decimals, nullable and nested fields) as JSON, CSV and Parquet files, a managed Delta table and a managed Iceberg table. It measures the size, the types a reader infers, and the cost of a selective query in each, including how many files and bytes the scan touched. Then it shows what only the table formats do (UPDATE, DELETE, MERGE, time travel, schema evolution, ACID) and lists where each keeps its metadata.
# MAGIC
# MAGIC It does not repeat two other guides: `file-format-ingestion` (landing CSV, Excel, JSON and XML through one pipeline) and `iceberg-support` (managed Iceberg and the REST catalog read).
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_write_formats` | Generates the orders and writes them as JSON, CSV and Parquet files, `ff_orders_delta` and `ff_orders_iceberg`. Records file count and bytes per format. |
# MAGIC | `02_compare_reads` | Reads each format back, records the inferred types, times the same selective query, and records pruning and skipping evidence. |
# MAGIC | `03_table_only_features` | Runs UPDATE, DELETE and MERGE on a plain folder versus Delta and Iceberg, plus time travel, schema evolution, schema enforcement and ACID behavior. |
# MAGIC | `04_metadata_layout` | Lists the `_delta_log` files, the Iceberg metadata.json, manifest list and manifests, and a UniForm table that exposes Delta as Iceberg. |
# MAGIC | `05_scan_metrics` | Waits for `system.query.history` (about ten minutes) and records files read, files skipped and bytes read for the timed queries. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-format-compare` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. Every run overwrites the data and appends its measurements to `ff_results`, so reruns keep the same row counts and the results table keeps a history.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables and the `format_compare` volume. |
# MAGIC | `rows` | Number of order rows to generate. Defaults to 1,000,000. |
# MAGIC | `seed` | Seed for the generator. The same seed gives the same rows. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_format_compare"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'rows', 'seed'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
