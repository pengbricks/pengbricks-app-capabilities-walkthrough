# Databricks notebook source
# MAGIC %md
# MAGIC # AI Functions in SQL
# MAGIC
# MAGIC This guide runs AI Functions over small sample tables and scores every result against the answer a person would give. It triages support tickets, reads invoice PDFs and two real scanned documents with OCR, masks personal details in call notes, matches company names across two lists, translates reviews with `ai_query`, and forecasts daily orders. The last step reads who can call the functions and what they have cost.
# MAGIC
# MAGIC Every notebook shows what goes in next to what comes out: the ticket text beside its category, each call note before and after masking, and every scanned page with the elements OCR found drawn on top.
# MAGIC
# MAGIC All sample data lives in `use_cases/general.yml`. The names, emails, and phone numbers are made up. The scans are public domain: [a 1947 letter from Harry S. Truman to Eleanor Roosevelt](https://commons.wikimedia.org/wiki/File:Letter_from_Harry_S._Truman_to_Eleanor_Roosevelt_-_DPLA_-_49b1c8f89d84a70ed20acf75b97ae3bf.pdf) (National Archives) and [Edison's 1880 electric lamp patent](https://patents.google.com/patent/US223898A/en). Step 1 downloads them and checks their checksums.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_land_samples` | Writes and shows the sample tables, renders six invoice PDFs, and downloads the two scans into the `aif_documents` volume. |
# MAGIC | `02_triage_tickets` | `ai_classify`, `ai_analyze_sentiment`, and `ai_summarize` over 24 tickets, scored against the expected category and sentiment; then `ai_decide` (Beta, needs the AI Decide preview) for a service-down probability and an urgency score. |
# MAGIC | `03_extract_invoices` | `ai_parse_document` over the invoices and scans, with page images, bounding boxes, and figure descriptions; then `ai_extract`, scored field by field. |
# MAGIC | `04_mask_and_match` | `ai_mask` over call notes, checked for leaked values; `ai_similarity` over company names, scored for precision and recall. |
# MAGIC | `05_translate` | `ai_query` translation to Japanese with `failOnError => false`. |
# MAGIC | `06_forecast` | SQL notebook on a SQL warehouse: `ai_forecast` backtest against September 2026, then a forward forecast. |
# MAGIC | `07_usage_and_access` | Reads `SHOW GRANTS ON SCHEMA system.ai` and 30 days of usage from `system.billing.usage`. Changes nothing. |
# MAGIC
# MAGIC # MAGIC ## How to run
# MAGIC
# MAGIC **By hand, in this folder:** open `01_land_samples` and click Run all, then open the others in order and Run all in each. `02` to `05` run on serverless notebook compute; attach `06_forecast` to a Pro or serverless SQL warehouse. The widgets fill themselves from the deployed job, so nothing needs editing.
# MAGIC
# MAGIC **As a job:** run `capability-guides-ai-functions` (or **Quick run** in the app). Steps 2 to 6 run in parallel.
# MAGIC
# MAGIC **Safe to rerun, in any mix.** Every table is replaced, never appended. Each step swaps its own rows in `aif_results`. The page-image folder is cleared before each parse, and a scan whose checksum already matches is not downloaded again. Running a notebook by hand after the job, or the job twice, leaves the same tables.
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
catalog, schema = params["catalog"], params["schema"]
tables = {
    "Inputs": ["aif_tickets", "aif_call_notes", "aif_accounts", "aif_vendors", "aif_reviews", "aif_daily_orders", "aif_invoice_truth", "aif_scans"],
    "Outputs": ["aif_tickets_triaged", "aif_documents_parsed", "aif_document_elements", "aif_invoices_extracted", "aif_scans_extracted",
                "aif_call_notes_masked", "aif_account_vendor_scores", "aif_reviews_translated", "aif_forecast_backtest", "aif_order_forecast", "aif_results"],
}
for group, names in tables.items():
    links.append(f"<li>{group}: " + ", ".join(f'<a href="{host}/explore/data/{catalog}/{schema}/{n}">{n}</a>' for n in names) + "</li>")
links.append(f'<li>Documents: <a href="{host}/explore/data/volumes/{catalog}/{schema}/aif_documents">aif_documents volume</a> (invoices/, public/, parsed_images/)</li>')

no_job = "" if any("Job <b>" in link for link in links) else f"<p>No deployed job is tagged {JOB_KEY}. Deploy the bundle to run it as a job; the notebooks still run by hand.</p>"
displayHTML(no_job + "<ul>" + "".join(links) + "</ul>")
