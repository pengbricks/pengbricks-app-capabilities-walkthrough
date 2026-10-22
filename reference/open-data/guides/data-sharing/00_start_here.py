# Databricks notebook source
# MAGIC %md
# MAGIC # Governed data sharing
# MAGIC
# MAGIC This guide shares a governed view and a table with an outside recipient. It reads them with the open-source `delta-sharing` client and only the recipient credential, revokes the grant, shows the next read fails, and records whether the recipient needed a copy. The Unity Catalog audit events for the share land in a table.
# MAGIC
# MAGIC If the job identity lacks `CREATE SHARE` and `CREATE RECIPIENT`, the share step records `BLOCKED` with the grant a metastore admin needs, and the audit step still collects the denied event.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_prepare_data` | Builds the governed sample tables and the row-limiting view `orders_west_v`. Drops the previous share first, because a shared view cannot be replaced. |
# MAGIC | `02_share_and_read` | Creates the share and a token recipient, grants, reads through Delta Sharing, checks the files sit in the source storage, revokes, confirms the read fails, drops the recipient, then shares the table `WITH HISTORY` and records the table versions a history-enabled recipient can query. Writes `sharing_audit`. |
# MAGIC | `03_collect_audit` | Polls `system.access.audit` for the share and recipient and writes `sharing_audit_events`. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-data-sharing` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. Run on its own, `03_collect_audit` looks back one hour and waits for the `deleteRecipient` event.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables and views. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the data and settings. |
# MAGIC | `started_epoch` | Set by the job on `03_collect_audit`: when `02_share_and_read` started. Blank means one hour ago. |
# MAGIC | `final_action` | Set by the job on `03_collect_audit`: the audit action that ends the wait. Blank means `deleteRecipient`. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: tables and the view are rebuilt, the share and recipient are dropped before they are created, and the audit tables are replaced.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. `<principal>` is the person or service principal behind `databricks bundle run`. A metastore admin runs items 1 to 3.
# MAGIC
# MAGIC 1. **Share and recipient privileges.** `02_share_and_read` creates a share and a recipient. Without these grants it records `BLOCKED` and stops:
# MAGIC    ```sql
# MAGIC    GRANT CREATE SHARE, CREATE RECIPIENT ON METASTORE TO `<principal>`;
# MAGIC    ```
# MAGIC 2. **Sharing outside your organization.** A token recipient is an external recipient, so the metastore must allow external Delta Sharing:
# MAGIC    ```bash
# MAGIC    databricks metastores update <metastore-id> --delta-sharing-scope INTERNAL_AND_EXTERNAL \
# MAGIC      --delta-sharing-recipient-token-lifetime-in-seconds <seconds> --delta-sharing-organization-name <org-name>
# MAGIC    ```
# MAGIC    The account console asks for a recipient token lifetime and an organization name when you turn this on, so the command passes both.
# MAGIC    Get `<metastore-id>` from `databricks metastores current`.
# MAGIC 3. **Audit trail.** `03_collect_audit` reads `system.access.audit`. Enable the schema if it is off, then grant read access:
# MAGIC    ```bash
# MAGIC    databricks system-schemas enable <metastore-id> access
# MAGIC    ```
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG system TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.access TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.access.audit TO `<principal>`;
# MAGIC    ```
# MAGIC    Without them the task stops with "system.access.audit is not readable".

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_data_sharing"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
