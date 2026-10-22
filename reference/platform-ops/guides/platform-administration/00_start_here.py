# Databricks notebook source
# MAGIC %md
# MAGIC # Workspace and account administration
# MAGIC
# MAGIC This guide scripts routine administrator tasks with the Databricks SDK and system tables. Each task is idempotent and writes its findings to an `admin_actions` table. The job changes only objects whose names start with `capability-guides-`, and it deletes nothing.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_init_ledger` | Creates the `admin_actions` table. |
# MAGIC | `02_workspace_checks` | Records caller identity, workspace ID, metastore and workspace settings. |
# MAGIC | `03_roles` | Finds or creates the workspace group, then tries a schema grant. Falls back to `CAN_USE` on the cluster policy when Unity Catalog refuses the workspace-local group. |
# MAGIC | `04_policies` | Tries a serverless budget policy, then creates the cluster policy or edits it if its definition drifted. |
# MAGIC | `05_capacity` | Flags warehouses with auto-stop off or too long, and sums serverless DBUs. |
# MAGIC | `06_audit_access` | Groups the last days of `system.access.audit` by service and action. |
# MAGIC | `07_routine_support` | Lists failed job runs and tokens that expire soon. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-platform-admin` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. Run by hand, results are recorded under a run id of the form `manual-YYYYMMDD`.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the `admin_actions` table. |
# MAGIC | `use_case` | Spec under `use_cases/` with the group, policy, thresholds and lookback windows. |
# MAGIC | `run_id` | Task notebooks only. Set by the job to the job run id. Blank uses `manual-<date>`. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: this notebook only reads and links the deployed job.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. `<principal>` is the person or service principal behind `databricks bundle run`. Every task catches a missing right and records `not_allowed` in `admin_actions`, so the job finishes without them. These steps make the rows say `ok`, `created`, or `unchanged` instead.
# MAGIC
# MAGIC 1. **Workspace admin.** `workspace_checks`, `roles`, `policies`, and `routine_support` read workspace settings, create the group and the cluster policy, and list workspace tokens. Add `<principal>` to the workspace `admins` group (Settings, **Identity and access**, **Groups**, `admins`). The serverless budget policy in `policies` is an account-level object, so it records `not_allowed` unless the identity also has account rights. The task then applies the cluster policy.
# MAGIC 2. **Account-level group for Unity Catalog grants.** A workspace-local group is not a Unity Catalog principal, so `grant_schema_access` records `not_allowed` for it. An account admin creates the group at the account level and assigns it to the workspace, before the job runs:
# MAGIC    ```bash
# MAGIC    databricks account groups create --display-name capability-guides-analysts
# MAGIC    databricks account workspace-assignment update <workspace-id> <group-id> --json '{"permissions": ["USER"]}'
# MAGIC    ```
# MAGIC    `<group-id>` is the `id` the first command prints. `03_roles` then finds the group instead of creating a local one, and runs `GRANT USE SCHEMA, SELECT` on the guide schema to it.
# MAGIC 3. **System tables.** `05_capacity` reads `system.billing.usage` and `06_audit_access` reads `system.access.audit`. A metastore admin enables the schemas, then grants read access:
# MAGIC    ```bash
# MAGIC    databricks system-schemas enable <metastore-id> billing
# MAGIC    databricks system-schemas enable <metastore-id> access
# MAGIC    ```
# MAGIC    Get `<metastore-id>` from `databricks metastores current`.
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG system TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.billing TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.billing.usage TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.access TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.access.audit TO `<principal>`;
# MAGIC    ```

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_platform_admin"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
