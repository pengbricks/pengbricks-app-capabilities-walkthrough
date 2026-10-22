# Databricks notebook source
# MAGIC %md
# MAGIC # Pipeline operations
# MAGIC
# MAGIC The DataOps job runs a feed through settings an operations team relies on: retries, failure and duration alerts, a timeout, single-run concurrency, run history, and an audit trail. The first attempt of the ingest task fails on purpose to show the retry working. A separate rollback job restores the silver table to an earlier Delta version. Safe to rerun: landed files and run history are replaced, silver is merged by key, quarantine rows are replaced per feed, and only `audit_log` and `dataops_task_attempts` grow.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_land_files` | Generates the sample files for every feed. |
# MAGIC | `02_ingest_with_retry` | Ingests `provider_a`. In the job the first attempt fails on purpose (`simulate_transient_failure`) so the retry policy shows; the retry passes. |
# MAGIC | `03_record_audit_trail` | Records this run's task attempts, the last 25 runs of the job, and the silver table's Delta history. |
# MAGIC | `04_rollback_table` | Rollback job: restores a table to an earlier Delta version. Run it after the job, on its own. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the **DataOps job**, then the **Rollback job** from the guide page (or **Quick run**). To work step by step, open the notebooks in order and press Run all in each. Run on its own, `02_ingest_with_retry` does not simulate the outage unless you set its `simulate_transient_failure` widget to `true`. Blank widgets take the deployed job's defaults.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for this guide's tables and the `landing` volume. |
# MAGIC | `use_case` | Use-case spec under `use_cases/` that defines the feeds and sample data. |
# MAGIC | `table` | Rollback job only: the Delta table to restore (default: `transactions_silver`). |
# MAGIC | `version` | Rollback job only: the version to restore. Blank undoes the latest write. |

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from databricks.sdk import WorkspaceClient
from capability_framework.workspace import guide_links_html

params = load_params(dbutils, "capability_guides_dataops", ["catalog", "schema", "use_case"])
rollback = load_params(dbutils, "capability_guides_rollback", ["table"])  # the rollback job has its own parameters

w = WorkspaceClient()
displayHTML(guide_links_html(w, ["capability_guides_dataops", "capability_guides_rollback"], []))
