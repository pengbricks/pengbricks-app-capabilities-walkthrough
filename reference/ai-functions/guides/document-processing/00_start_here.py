# Databricks notebook source
# MAGIC %md
# MAGIC # Document processing pipeline and its cost
# MAGIC
# MAGIC This guide runs a document pipeline end to end on 28 generated documents and measures what it cost. It follows the patterns in the walkthrough: land and track documents incrementally, parse once and store the result, classify and route by type, extract a schema per type, validate and quarantine, mask personal data, and then measure the bill and divide it by pages and documents.
# MAGIC
# MAGIC The documents are made up and rendered at run time: 9 invoices (two run to a second page, one has no total), 7 request forms (one has no date), 6 letters, and 6 scanned receipts (images with no text layer; one is faint and tilted to test OCR). The names, emails, and phone numbers are fake. The answer key is in `dp_truth`. The function-by-function guide is `AI Functions in SQL`; this one covers the pipeline around the functions and what it costs.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_land_documents` | Writes the PDFs to a volume, ingests them with Auto Loader (`binaryFile`) into a metadata table, and shows that a second pass reads nothing. |
# MAGIC | `02_parse_once` | `ai_parse_document` over files not yet in the parsed table, stored as VARIANT with page and error counts. A second pass parses nothing. |
# MAGIC | `03_classify_and_route` | `ai_classify` with described labels and confidence scores; low confidence goes to a `review` route. |
# MAGIC | `04_extract_fields` | `ai_extract` with one schema per type and confidence scores, unpacked to one row per field and scored against the answer key. |
# MAGIC | `05_validate_and_mask` | Null, confidence, date, and range checks into a validated table and a quarantine table; `ai_mask` on forms and letters, checked for leaks. |
# MAGIC | `06_measure_cost` | Reads the run's usage from `system.billing.usage`, polls briefly, and writes cost per page and per document. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC **By hand, in this folder:** run `01_land_documents` with Run all, then each notebook after it in order. Everything runs on serverless notebook compute. The widgets fill themselves from the deployed job.
# MAGIC
# MAGIC **As a job:** run `capability-guides-document-processing` (or Quick run in the app).
# MAGIC
# MAGIC **Billing lags.** `system.billing.usage` receives rows hours after the work. The job's last task polls for a few minutes and records `billing_status` as `complete`, `partial`, or `not_available`. Run `06_measure_cost` again a few hours later and it fills in the numbers for the latest run.
# MAGIC
# MAGIC **Safe to rerun.** The first notebook clears the landing folder, the Auto Loader checkpoint, and every table this guide writes except `dp_run_log`, so each run starts from the same state. The notebooks after it add only what is new.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables and the `aif_documents` volume. |
# MAGIC | `run_id` | Set by the job. Defaults to `manual` when run by hand. |
# MAGIC | `measure_run_id` | Optional, on `06_measure_cost`: the job run to measure. Blank means the latest run in `dp_run_log`. |

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_document_processing"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')
catalog, schema = params["catalog"], params["schema"]
tables = {
    "Documents": ["dp_truth", "dp_documents_raw", "dp_documents_parsed"],
    "Pipeline": ["dp_documents_classified", "dp_fields_extracted", "dp_documents_validated", "dp_documents_quarantine", "dp_documents_masked"],
    "Cost": ["dp_run_log", "dp_billing_usage", "dp_results"],
}
for group, names in tables.items():
    links.append(f"<li>{group}: " + ", ".join(f'<a href="{host}/explore/data/{catalog}/{schema}/{n}">{n}</a>' for n in names) + "</li>")
links.append(f'<li>Documents: <a href="{host}/explore/data/volumes/{catalog}/{schema}/aif_documents">aif_documents volume</a> (dp_landing/)</li>')

no_job = "" if any("Job <b>" in link for link in links) else f"<p>No deployed job is tagged {JOB_KEY}. Deploy the bundle to run it as a job; the notebooks still run by hand.</p>"
displayHTML(no_job + "<ul>" + "".join(links) + "</ul>")
