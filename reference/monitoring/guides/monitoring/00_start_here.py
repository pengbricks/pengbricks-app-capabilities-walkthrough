# Databricks notebook source
# MAGIC %md
# MAGIC # Platform observability
# MAGIC
# MAGIC This guide gives one consolidated view of job runs, failures, usage and cost, compute and capacity, audit events, and alert routing for a workspace. A serverless job copies the data from system tables and the Jobs and Alerts APIs into seven Unity Catalog tables. An AI/BI dashboard reads those tables, and a SQL alert and job failure emails show how a failure reaches a person. Safe to rerun: every table uses `CREATE OR REPLACE`, so a second run replaces the snapshot.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_setup_context_and_alert_routing` | Records the workspace ID in `ops_context` and builds `ops_alert_routing` from the Jobs and Alerts APIs. |
# MAGIC | `02_ops_job_runs` | Builds `ops_job_runs`: one row per job run in the lookback window. |
# MAGIC | `03_ops_failures` | Builds `ops_failures` from `ops_job_runs`: failed, errored and timed-out runs. |
# MAGIC | `04_ops_usage_cost` | Builds `ops_usage_cost`: daily DBUs and list-price cost by SKU and product. |
# MAGIC | `05_ops_compute_capacity` | Builds `ops_compute_capacity`: serverless DBUs by workload and SQL warehouse events. |
# MAGIC | `06_ops_audit_events` | Builds `ops_audit_events`: audit events by day, service, action and user. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-monitoring-snapshot` (or **Quick run** in the app). Notebook 01 runs first, then 02 to 06 (03 after 02). To run by hand, run 01, then open any other notebook and use Run all. The dashboard and the SQL alert are bundle resources: open them from the bundle in the workspace.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the `ops_*` tables. |
# MAGIC | `schema` | Schema that holds the `ops_*` tables. |
# MAGIC | `lookback_days` | Days of job runs, usage and capacity history to materialize. |
# MAGIC | `audit_lookback_days` | Days of audit events to materialize. |
# MAGIC | `guide_tag_key` | Job tag key that marks a capability guide job. |
# MAGIC | `use_case_tag_key` | Job tag key that carries the use case label. |
# MAGIC | `alert_email` | Address that receives job failure emails and the SQL alert. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. `<principal>` is the person or service principal that runs `databricks bundle run`.
# MAGIC
# MAGIC 1. **System tables.** The job reads `system.lakeflow.jobs`, `system.lakeflow.job_run_timeline`, `system.billing.usage`, `system.billing.list_prices`, `system.compute.warehouse_events`, and `system.access.audit`. A metastore admin or account admin enables each schema that is off, then grants read access:
# MAGIC    ```bash
# MAGIC    databricks metastores current   # shows the metastore ID
# MAGIC    databricks system-schemas enable <metastore-id> lakeflow
# MAGIC    databricks system-schemas enable <metastore-id> billing
# MAGIC    databricks system-schemas enable <metastore-id> compute
# MAGIC    databricks system-schemas enable <metastore-id> access
# MAGIC    ```
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG system TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.lakeflow TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.lakeflow.jobs TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.lakeflow.job_run_timeline TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.billing TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.billing.usage TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.billing.list_prices TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.compute TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.compute.warehouse_events TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.access TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.access.audit TO `<principal>`;
# MAGIC    ```
# MAGIC    Without them `01_setup_context_and_alert_routing` stops before it changes anything.
# MAGIC 2. **An address for failure emails and the SQL alert.** The bundle variable `alert_email` has no default. Set it at deploy time:
# MAGIC    ```bash
# MAGIC    databricks bundle deploy --target dev --var alert_email=<you@example.com>
# MAGIC    ```
# MAGIC 3. **Run the job once before you open the dashboard or expect the alert to fire.** Both read the `ops_*` tables that the job creates:
# MAGIC    ```bash
# MAGIC    databricks bundle run capability_guides_monitoring_snapshot --target dev
# MAGIC    ```

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_monitoring_snapshot"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'lookback_days', 'audit_lookback_days', 'guide_tag_key', 'use_case_tag_key', 'alert_email'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
