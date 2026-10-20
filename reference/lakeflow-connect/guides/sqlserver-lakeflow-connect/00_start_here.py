# Databricks notebook source
# MAGIC %md
# MAGIC # SQL Server ingestion with Lakeflow Connect
# MAGIC
# MAGIC This guide ingests three SQL Server tables with Lakeflow Connect, then proves the parts customers ask about. Inserts, updates, and deletes made on the source land in bronze. A table with CDC keeps its full history. A new source column flows through with no pipeline change. A full refresh of one table leaves the others alone. Silver tables built on bronze show lineage, and a Genie space answers a question about them.
# MAGIC
# MAGIC > **Needs classic compute.** The ingestion gateway runs on classic compute. A workspace that allows only serverless compute, like the reference workspace for these guides, cannot start it, so this job does not run there. Deploy to a workspace that allows classic compute.
# MAGIC
# MAGIC ## What gets deployed
# MAGIC
# MAGIC | Resource | Compute | Role |
# MAGIC |---|---|---|
# MAGIC | `capability-guides-lfc-sqlserver-gateway` | Classic, always running | Reads CDC and Change Tracking from SQL Server, stages changes in a Unity Catalog volume |
# MAGIC | `capability-guides-lfc-sqlserver-ingestion` | Serverless, triggered | Applies staged changes to `lfc_customers` (SCD type 2), `lfc_orders`, and `lfc_products` (SCD type 1) |
# MAGIC | `capability-guides-lfc-silver` | Serverless, triggered | `lfc_silver_customers`, `lfc_silver_plan_history`, `lfc_silver_orders` |
# MAGIC | `capability-guides-lakeflow-connect` | Serverless job | The demo, steps 1 to 6 below |
# MAGIC | `capability-guides-lfc-sqlserver-schedule` | Serverless job, paused | Ingest then silver every 30 minutes, once the demo has run |
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_check_source` | Reads host and port from the connection, checks CDC and Change Tracking per table, starts the gateway. |
# MAGIC | *(pipeline task)* `ingest` | First load of the three tables. |
# MAGIC | `02_make_changes` | Inserts, updates, and deletes on the source; records what bronze should show. |
# MAGIC | `03_land_changes` | Runs ingestion until every change is in bronze, then shows one customer's history. |
# MAGIC | `04_schema_change` | Adds `loyalty_tier` on the source and waits for it in bronze. |
# MAGIC | *(pipeline task)* `full_refresh_orders` | Full refresh of `lfc_orders` only. |
# MAGIC | `05_check_full_refresh` | Source and bronze counts match; customer history is intact. |
# MAGIC | *(pipeline task)* `silver` | Builds the silver tables. |
# MAGIC | `06_lineage_and_genie` | Reads lineage to silver and asks a Genie space about it. |
# MAGIC
# MAGIC Every step writes what it measured to `lfc_results`, replacing its own rows. Bronze history tables grow with each run; that is the point.
# MAGIC
# MAGIC ## Before the first run
# MAGIC
# MAGIC 1. **DBA:** install the Databricks utility objects script in the source database, then run `source/01_setup_source.sql` (tables, sample rows, logins, CDC and Change Tracking, grants). On SQL Server, SQL Server Agent must be running for CDC.
# MAGIC 2. **Network:** the gateway's classic compute must reach the SQL Server port (1433 by default) over TLS.
# MAGIC 3. **Databricks admin:** create the Unity Catalog connection with the `lakeflow_ingest` login, and a secret scope with `sqlserver_app_user` and `sqlserver_app_password` for the `lakeflow_demo_app` login.
# MAGIC 4. **Data engineer:** `databricks bundle deploy` with `sqlserver_connection_name`, then run the job.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog`, `schema` | Where bronze, silver, the staging volume, and `lfc_results` live. |
# MAGIC | `sqlserver_connection` | Unity Catalog SQL Server connection (bundle variable `sqlserver_connection_name`). |
# MAGIC | `sqlserver_database`, `sqlserver_schema` | Source database and schema, case-sensitive. Defaults `LakeflowDemo` and `dbo`. |
# MAGIC | `secret_scope` | Scope holding the application login the job changes rows with. |
# MAGIC | `gateway_pipeline_id`, `ingestion_pipeline_id` | Set by the bundle. |
# MAGIC | `warehouse_id` | SQL warehouse for the Genie space. |
# MAGIC | `max_wait_minutes` | How long steps 3 and 4 keep rerunning ingestion for changes to land. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params, JOB_TAG
JOB_KEY = "capability_guides_lakeflow_connect"
params = load_params(dbutils, JOB_KEY, ["catalog", "schema", "gateway_pipeline_id", "ingestion_pipeline_id"])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = [f'<li>Gateway: <a href="{host}/pipelines/{params["gateway_pipeline_id"]}">open</a></li>',
         f'<li>Ingestion pipeline: <a href="{host}/pipelines/{params["ingestion_pipeline_id"]}">open</a></li>']
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG, "").startswith(JOB_KEY):
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')
displayHTML("<ul>" + "".join(links) + "</ul>")
