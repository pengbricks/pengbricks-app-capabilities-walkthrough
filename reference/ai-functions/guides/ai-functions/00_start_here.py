# Databricks notebook source
# MAGIC %md
# MAGIC # AI Functions in SQL
# MAGIC
# MAGIC This guide runs AI Functions over small sample tables and scores every result against the answer a person would give. It triages support tickets, pulls fields out of invoice PDFs, masks personal details in call notes, matches company names across two lists, translates reviews with `ai_query`, and forecasts daily orders. The last step reads who can call the functions and what they have cost.
# MAGIC
# MAGIC All sample data lives in `use_cases/general.yml`. The names, emails, and phone numbers are made up.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_land_samples` | Writes the sample tables and renders six invoice PDFs into the `aif_documents` volume. |
# MAGIC | `02_triage_tickets` | `ai_classify`, `ai_analyze_sentiment`, and `ai_summarize` over 24 tickets, scored against the expected category and sentiment; then `ai_decide` (Beta, needs the AI Decide preview) for a service-down probability and an urgency score. |
# MAGIC | `03_extract_invoices` | `ai_parse_document` and `ai_extract` over the PDFs, scored field by field. |
# MAGIC | `04_mask_and_match` | `ai_mask` over call notes, checked for leaked values; `ai_similarity` over company names, scored for precision and recall. |
# MAGIC | `05_translate` | `ai_query` translation to Japanese with `failOnError => false`. |
# MAGIC | `06_forecast` | SQL notebook on a SQL warehouse: `ai_forecast` backtest against September 2026, then a forward forecast. |
# MAGIC | `07_usage_and_access` | Reads `SHOW GRANTS ON SCHEMA system.ai` and 30 days of usage from `system.billing.usage`. Changes nothing. |
# MAGIC
# MAGIC Steps 2 to 6 run in parallel. Every step writes its scores to `aif_results`, replacing its own rows, so a rerun does not add a second set.
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-ai-functions` (or **Quick run** in the app). To run by hand, run `01_land_samples` first, then the others in any order, with Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the sample tables, results, and the `aif_documents` volume. |
# MAGIC | `use_case` | Spec under `use_cases/` with the samples, labels, extraction schema, and model endpoint. |
# MAGIC | `warehouse_id` | Bundle variable: the SQL warehouse that runs `06_forecast`. |
# MAGIC | `run_id` | Set by the job on steps 2 to 7. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_ai_functions"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
