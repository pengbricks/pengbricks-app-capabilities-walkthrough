# Databricks notebook source
# MAGIC %md
# MAGIC # SQL Server ingestion with Lakeflow Connect
# MAGIC
# MAGIC This guide ingests three SQL Server tables with Lakeflow Connect, then proves the parts customers ask about. Inserts, updates, and deletes made on the source land in bronze. A table with CDC keeps its full history. A new source column flows through with no pipeline change. A full refresh of one table leaves the others alone. Silver tables built on bronze show lineage, and a Genie space answers a question about them. Safe to rerun: results are replaced per step, the Genie space is found by title and updated, and the source setup script keeps existing objects. The source changes by design: each run touches the least recently changed rows and adds 10 orders.
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
# MAGIC ## Required setup
# MAGIC
# MAGIC Do these once, in this order, before the first run. Item 6 is the deploy. `<principal>` is the identity that deploys and runs the job.
# MAGIC
# MAGIC 1. **A reachable SQL Server.** Use a primary or an Availability Group listener, not a read replica. Port 1433 must be open to the gateway's classic compute and to the job's serverless notebooks, which also connect to run `01`, `02`, `04`, and `05`. For a private server, allow serverless compute through your network connectivity configuration (Account console, **Security**, **Network connectivity configurations**). Test the path:
# MAGIC    ```bash
# MAGIC    nc -vz <server-fqdn> 1433
# MAGIC    ```
# MAGIC 2. **Source-side change capture (a DBA).** Create the database, install the Databricks utility objects script (`utility_script.sql`) in it, and on SQL Server (not Azure SQL) start SQL Server Agent, because CDC capture jobs run there. Then run the setup script, which creates the tables, the `lakeflow_ingest` and `lakeflow_demo_app` logins, CDC on `customers`, Change Tracking on `orders` and `products`, and the grants:
# MAGIC    ```bash
# MAGIC    sqlcmd -S <server> -d LakeflowDemo -U <setup_user> -P <password> -N -i source/01_setup_source.sql \
# MAGIC      -v IngestPassword="<ingest-password>" AppPassword="<app-password>"
# MAGIC    ```
# MAGIC 3. **The Unity Catalog connection** named by the bundle variable `sqlserver_connection_name`. Creating it needs `CREATE CONNECTION` on the metastore, and the gateway needs `USE CONNECTION`:
# MAGIC    ```sql
# MAGIC    GRANT CREATE CONNECTION ON METASTORE TO `<principal>`;
# MAGIC    GRANT USE CONNECTION ON CONNECTION <uc-connection> TO `<principal>`;
# MAGIC    ```
# MAGIC    ```bash
# MAGIC    databricks connections create --json '{"name": "<uc-connection>", "connection_type": "SQLSERVER",
# MAGIC      "options": {"host": "<server-fqdn>", "port": "1433", "user": "lakeflow_ingest", "password": "<ingest-password>",
# MAGIC                  "trustServerCertificate": "false"}}'
# MAGIC    ```
# MAGIC 4. **A secret scope** with the `lakeflow_demo_app` login the job uses to change rows (bundle variable `source_secret_scope`, default `lakeflow_connect_demo`). Each `put-secret` prompts for the value:
# MAGIC    ```bash
# MAGIC    databricks secrets create-scope lakeflow_connect_demo
# MAGIC    databricks secrets put-secret lakeflow_connect_demo sqlserver_app_user
# MAGIC    databricks secrets put-secret lakeflow_connect_demo sqlserver_app_password
# MAGIC    ```
# MAGIC 5. **Classic compute for the gateway.** The gateway cannot run on serverless. The workspace must allow classic compute for pipelines, and the driver needs at least 8 cores (pin a node type or a cluster policy in `resources/sqlserver.pipelines.yml` if your workspace enforces one). In a serverless-only workspace the bundle validates, but the gateway never starts.
# MAGIC 6. **Deploy, then start the gateway.** The gateway is a continuous pipeline. Start it a few minutes before the job and leave it running:
# MAGIC    ```bash
# MAGIC    databricks bundle deploy --target dev --var catalog=<catalog> --var warehouse_id=<warehouse-id> \
# MAGIC      --var app_service_principal=<app-sp-application-id> --var sqlserver_connection_name=<uc-connection>
# MAGIC    databricks bundle run lfc_gateway --target dev --no-wait
# MAGIC    ```
# MAGIC 7. **Lineage read access, for `06_lineage_and_genie`.** A metastore admin grants:
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG system TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.access TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.access.table_lineage TO `<principal>`;
# MAGIC    ```
# MAGIC
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
