# Databricks notebook source
# MAGIC %md
# MAGIC # Automated data documentation
# MAGIC
# MAGIC Safe to rerun: it only lists links to the deployed job and writes nothing.
# MAGIC
# MAGIC This guide builds a bronze, silver and gold table chain from a spec file, then writes a markdown page for each table: schema, lineage, quality, ownership and usage. It applies AI-drafted descriptions back to Unity Catalog as table and column comments. Each refresh overwrites the pages and adds one row to a log table.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_build_sample_tables` | Builds `bronze_orders`, `silver_orders` and `gold_daily_revenue` from the use-case spec (sample-data generator, fixed seed) and sets tags. |
# MAGIC | `02_generate_docs` | Profiles each table, reads lineage and query history, drafts descriptions with `ai_query`, applies comments, writes one page per table plus `index.md` to the `docs` volume, and logs the refresh. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-documentation-refresh` (or **Quick run** in the app). To run by hand, open `01_build_sample_tables`, then `02_generate_docs`, and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the sample tables, the log table and the `docs` volume. |
# MAGIC | `use_case` | Spec under `use_cases/` that defines the sample tables. |
# MAGIC | `model_endpoint` | Foundation Model chat endpoint that `ai_query` uses to draft descriptions (used by `02_generate_docs`). |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_documentation_refresh"
params = load_params(dbutils, JOB_KEY, ["catalog", "schema", "use_case", "model_endpoint"])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
