# Databricks notebook source
# MAGIC %md
# MAGIC # Access management
# MAGIC
# MAGIC This guide grants access through a group instead of to people, segregates a dev-like and a prod-like schema, verifies the grants from `information_schema`, audits grant changes from `system.access.audit`, and lists service principals with their secret expiry.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_ensure_group` | Creates the reader group, adds the app service principal, and records which principal Unity Catalog can grant to. |
# MAGIC | `02_create_data` | Writes sample tables into the dev and prod schemas. |
# MAGIC | `03_apply_grants` | Grants different privileges per environment. |
# MAGIC | `04_verify_grants` | Reads the grants back and asserts they are group-based and differ by environment. |
# MAGIC | `05_audit_grant_changes.sql` | SQL task: writes the last 30 days of grant changes to `access_audit_grant_changes`. Runs on the SQL warehouse as part of the job. |
# MAGIC | `06_check_audit` | Reads the audit table back. |
# MAGIC | `07_list_service_principals` | Lists service principals and secret metadata. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-access` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. Run `05_audit_grant_changes.sql` in the SQL editor with `catalog` and `schema` set, or skip it: `06` reads whatever the last job run wrote.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for this guide's tables. |
# MAGIC | `use_case` | Spec under `use_cases/` with the sample data and per-environment privileges. |
# MAGIC | `reader_group` | Group that receives the grants. |
# MAGIC | `app_service_principal` | Application id of the app's service principal. |
# MAGIC | `dev_schema`, `prod_schema` | The two demo schemas the bundle creates. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_access"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'reader_group', 'app_service_principal', 'dev_schema', 'prod_schema'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
