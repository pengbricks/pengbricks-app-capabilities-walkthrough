# Databricks notebook source
# MAGIC %md
# MAGIC # Legacy workload migration
# MAGIC
# MAGIC This guide assesses one legacy T-SQL nightly sales batch. It classifies each step, converts the SQL to Databricks SQL, runs the converted pipeline on generated data, reconciles the outputs against an independent Python reference, and estimates the effort per role. Lakebridge is the supported product for real estates. This guide shows the same assess, convert, reconcile loop on one workload.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_assess` | Splits `legacy/nightly_sales_batch.sql` into steps and classifies each by construct. Writes `assessment_classification`. |
# MAGIC | `02_convert` | Transpiles each step with sqlglot, marks it clean, warning or manual, and attaches the hand-written fix from `remediation/` for manual steps. Writes `assessment_conversion`. |
# MAGIC | `03_reconcile` | Generates sample input, runs the converted steps, and compares every output table to the Python reference. Writes `assessment_test_results`. |
# MAGIC | `04_record` | Writes `assessment_statements`, `assessment_summary` and `assessment_effort`, and logs the run to `etl_log`. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-legacy-conversion-assessment` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. Each one reads the table the one before it wrote.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the legacy tables, converted outputs and assessment tables. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the sample data, workload, expected results and effort model. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_legacy_conversion_assessment"
params = load_params(dbutils, JOB_KEY, ["catalog", "schema", "use_case"])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
