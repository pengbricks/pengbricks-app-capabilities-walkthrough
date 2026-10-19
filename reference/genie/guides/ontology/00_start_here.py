# Databricks notebook source
# MAGIC %md
# MAGIC # Business terms and synonyms (ontology)
# MAGIC
# MAGIC This guide asks a Genie space the same questions twice: once over raw tables with cryptic column names, and once after a semantic layer exists (comments, tags, a Unity Catalog metric view with synonyms, and space instructions). For each question it compares the rows Genie's SQL returns with the rows of a known-good query, so the effect of the semantic layer shows as match counts.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_generate_data` | Drops and regenerates the sample tables `cust` and `ord_fact` from the use-case spec (sample-data generator, fixed seed). |
# MAGIC | `02_ask_before` | Updates the baseline Genie space (raw tables only, in place if it exists), asks every question, and records whether each answer matches. |
# MAGIC | `03_add_semantics` | Adds table and column comments, tags, and the `sales_metrics` metric view with synonyms. |
# MAGIC | `04_ask_after` | Updates the enhanced Genie space (metric view, instructions, sample questions), asks the same questions, and records the answers. |
# MAGIC | `05_compare_answers` | Pivots both stages into `ontology_comparison_summary` and prints the match counts. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-ontology` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. Each ask notebook takes several minutes: Genie answers one question at a time.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the sample tables, metric view and result tables. |
# MAGIC | `use_case` | Spec under `use_cases/` with the tables, semantics, space text and questions. |
# MAGIC | `warehouse_id` | SQL warehouse the Genie spaces use to run queries. |
# MAGIC | `run_id` | Set by the job on the ask and compare notebooks. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_ontology"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'warehouse_id'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
