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

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. `<principal>` is the person or service principal behind `databricks bundle run`.
# MAGIC
# MAGIC 1. **Foundation bundle.** Deploy `reference/foundation` first. It creates the shared schema this guide writes to.
# MAGIC 2. **Schema privileges.** The job creates tables and a volume, tags the tables, and writes comments on them:
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG <catalog> TO `<principal>`;
# MAGIC    GRANT USE SCHEMA, CREATE TABLE, CREATE VOLUME, SELECT, MODIFY, APPLY TAG ON SCHEMA <catalog>.<schema> TO `<principal>`;
# MAGIC    ```
# MAGIC 3. **Chat endpoint for `ai_query`.** `02_generate_docs` drafts descriptions with `ai_query` on the endpoint named by the `model_endpoint` variable. Check that it exists and that `<principal>` can query it. If it is missing, the run records AI failures and writes pages without drafted descriptions:
# MAGIC    ```bash
# MAGIC    databricks serving-endpoints get <model-endpoint>
# MAGIC    databricks serving-endpoints list
# MAGIC    ```
# MAGIC 4. **Lineage and query history.** The pages list upstream tables, readers and recent queries from `system.access.table_lineage` and `system.query.history`. A metastore admin enables the schemas if they are off, then grants read access:
# MAGIC    ```bash
# MAGIC    databricks system-schemas enable <metastore-id> access   # get the ID from: databricks metastores current
# MAGIC    databricks system-schemas enable <metastore-id> query
# MAGIC    ```
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG system TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.access TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.access.table_lineage TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.query TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.query.history TO `<principal>`;
# MAGIC    ```
# MAGIC    Without them the pages say that no readers or queries were found. Lineage appears a few minutes after a query, so the first run can be empty.

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
