# Databricks notebook source
# MAGIC %md
# MAGIC # Row and column security
# MAGIC
# MAGIC This guide applies column masks, an attribute row filter and a dynamic row filter to generated tables, tests them as different identities, and inventories the policies.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_generate_data` | Generates the customers and orders tables from the spec. |
# MAGIC | `02_create_policies` | Creates the mapping table, mask and filter functions, and attaches them. |
# MAGIC | `03_test_policies` | Evaluates the policies for the job identity, a restricted role and the app service principal. |
# MAGIC | `04_policy_inventory` | Lists the masks and filters from `information_schema`. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-row-column-security` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for this guide's tables. |
# MAGIC | `use_case` | Spec under `use_cases/` with the tables, masked columns and filters. |
# MAGIC | `app_service_principal` | Application id of the app's service principal, used in the access mapping. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# MAGIC
# MAGIC Safe to rerun: it only reads the deployed job and links to it.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run this once, before the job. `<principal>` is the person or service principal that runs `databricks bundle run`.
# MAGIC
# MAGIC 1. **Job identity in the `admins` group.** `03_test_policies` asserts that the job identity sees every row and the real values. The policies let only members of `admins` through, so `<principal>` must be a workspace admin. Make it one in workspace settings, or add it to the group:
# MAGIC    ```bash
# MAGIC    databricks groups list --filter 'displayName eq admins'     # note the group ID
# MAGIC    databricks users list --filter 'userName eq "<email>"'      # note the user ID (service principals: databricks service-principals list --filter 'applicationId eq "<application-id>"')
# MAGIC    ```
# MAGIC    Save this as `add_member.json`:
# MAGIC    ```json
# MAGIC    {"schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
# MAGIC     "Operations": [{"op": "add", "value": {"members": [{"value": "<principal-id>"}]}}]}
# MAGIC    ```
# MAGIC    ```bash
# MAGIC    databricks groups patch <admins-group-id> --json @add_member.json
# MAGIC    ```
# MAGIC    Without it `01_generate_data` stops before it changes anything.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_row_column_security"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'app_service_principal'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
