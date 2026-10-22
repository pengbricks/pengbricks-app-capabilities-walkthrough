# Databricks notebook source
# MAGIC %md
# MAGIC # AI Functions for data quality
# MAGIC
# MAGIC This guide runs five data quality checks on 300 made-up order records. Rules go first. AI Functions run only on the rows the rules cannot judge. Every result lands in one table, `aidq_quality_results`, next to the rule results, and the last notebook scores each check against a labelled answer key.
# MAGIC
# MAGIC | Check | Rule (first pass) | AI Function (residue only) |
# MAGIC |---|---|---|
# MAGIC | `reason_code` | One keyword set matches the text | `ai_classify` |
# MAGIC | `address` | Canonical `street, city, ST zip` pattern | `ai_extract` |
# MAGIC | `duplicate_company` | Same normalized name as an earlier record | `ai_similarity` |
# MAGIC | `sensitive_note` | Email, phone, and SSN patterns | `ai_mask` |
# MAGIC | `status_comment` | No comment means nothing to contradict | `ai_query` with structured output |
# MAGIC
# MAGIC The data is generated from a fixed seed, so every run sees the same rows. All names, emails, and phone numbers are made up (example.com addresses, 555-01xx numbers). The answer key sits in `aidq_truth`, and no AI call reads it.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_messy_sample` | Writes `aidq_records` (inputs) and `aidq_truth` (answers). |
# MAGIC | `02_rule_checks` | SQL rules write `pass`, `fail`, or `unknown` per record and check to `aidq_rule_results`, and report the share left unknown. |
# MAGIC | `03_ai_checks` | AI Functions on the unknown rows only. Writes `aidq_ai_results`, `aidq_quality_results`, `aidq_quarantine`, and `aidq_records_accepted`. |
# MAGIC | `04_accuracy_and_cost` | Precision and recall per check and source, threshold gates, token estimate, and billed cost from `system.billing.usage`. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC **By hand, in this folder:** run `01` to `04` with Run all, in order. Widgets fill from the deployed job.
# MAGIC
# MAGIC **As a job:** run `capability-guides-ai-functions-data-quality` (or Quick run in the app). It uses serverless notebook compute, the same as the `ai-functions` bundle's other jobs, and needs no SQL warehouse. A Pro or serverless SQL warehouse also runs these functions if you attach one to a notebook by hand.
# MAGIC
# MAGIC **Cost is bounded.** 300 rows. The row-level checks send 150 or fewer rows each to a model after the rules filter, and the duplicate check scores about 900 short name pairs, capped at 1,500 by `max_pairs`. Nothing is created that bills while idle.
# MAGIC
# MAGIC **Safe to rerun.** Every table is replaced, not appended. A second run leaves the same tables with the same row counts. The model can answer differently between runs, so scores can move a little.
# MAGIC
# MAGIC **Cleanup.** Nothing keeps costing money. To remove the guide's data, run `DROP TABLE` on each `aidq_` table in the schema.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the `aidq_` tables. |
# MAGIC | `run_id` | Set by the job. Defaults to `manual` when run by hand. |

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC - **AI Functions in your region.** The functions here run on Databricks-hosted models for batch inference, which are available only in some regions. `ai_classify` and `ai_extract` version 2.1 are not offered everywhere. Check the [AI Functions page](https://docs.databricks.com/aws/en/large-language-models/ai-functions) and the [Designated Services page](https://docs.databricks.com/aws/en/resources/designated-services). If the workspace Geo does not host them, an admin may have to enable cross-Geo processing. Data is still not stored outside the Geo.
# MAGIC - **Partner-powered AI features.** The [partner-powered AI features setting](https://docs.databricks.com/aws/en/databricks-ai/partner-powered) covers Genie, AI/BI visuals, and similar features. Its page does not list AI Functions, so the job should not need it. It defaults to off on workspaces with the compliance security profile and is scheduled for removal on November 1, 2026. If a function returns a partner-powered error, ask your account team.
# MAGIC - **Compute.** Serverless notebook compute, or a Pro or serverless SQL warehouse. Classic SQL warehouses do not run AI Functions.
# MAGIC - **`ai_query` endpoint.** `03_ai_checks` calls the endpoint named in `use_cases/data_quality.yml` (`endpoint`). Not every pay-per-token endpoint accepts batch calls, and structured output (`responseFormat`) needs a chat model. Change the name if your workspace does not serve it.
# MAGIC - **Billing data.** `04_accuracy_and_cost` reads `system.billing.usage`, which needs access to the `system.billing` schema. Without it the cost lines record `-1` and the rest of the notebook still runs.
# MAGIC - **Permissions.** Create tables in the schema, and `EXECUTE` on the AI Functions (everyone has it on `system.ai` by default).

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_ai_functions_data_quality"
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
    "Sample": ["aidq_records", "aidq_truth"],
    "Checks": ["aidq_rule_results", "aidq_ai_results", "aidq_duplicate_pairs", "aidq_quality_results"],
    "Outcome": ["aidq_quarantine", "aidq_records_accepted", "aidq_ai_calls", "aidq_results", "aidq_billing_usage"],
}
for group, names in tables.items():
    links.append(f"<li>{group}: " + ", ".join(f'<a href="{host}/explore/data/{catalog}/{schema}/{n}">{n}</a>' for n in names) + "</li>")

no_job = "" if any("Job <b>" in link for link in links) else f"<p>No deployed job is tagged {JOB_KEY}. Deploy the bundle to run it as a job; the notebooks still run by hand.</p>"
displayHTML(no_job + "<ul>" + "".join(links) + "</ul>")
