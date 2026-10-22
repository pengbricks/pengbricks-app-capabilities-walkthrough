# Databricks notebook source
# MAGIC %md
# MAGIC # Databricks Apps, App Spaces and Serverless Micro Apps
# MAGIC
# MAGIC This guide deploys one small app and then inspects it. The app is a FastAPI service with two routes. `/whoami/app` runs a query as the app service principal. `/whoami/user` runs the same query as the signed-in user, with the token the platform forwards in `x-forwarded-access-token`. The notebooks read the app through the SDK, check its health, audit every app in the workspace for cost, look at App Spaces (Beta) without changing anything, and stop the app when you ask.
# MAGIC
# MAGIC **Cost.** The app runs at the Medium compute size, about 0.5 DBU per hour while it is running (roughly 365 DBU a month if you leave it on). A stopped app does not bill. Run `05_cleanup` with `stop_app=true` when you are done.
# MAGIC
# MAGIC Safe to rerun: this notebook only reads the deployed job and links to it.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_read_app` | Reads the app with `apps.get`: URL, compute size and status, active deployment, resources, user API scopes, and service principal. Merges one row into `databricks_apps_inventory`. |
# MAGIC | `02_health_check` | Calls the app URL with the job identity's OAuth token and shows the identity each route reports. |
# MAGIC | `03_cost_check` | Lists every app in the workspace and flags apps that are running but idle. |
# MAGIC | `04_app_spaces` | Read-only look at App Spaces and Genie App Builder (Beta). Creates nothing. |
# MAGIC | `05_cleanup` | Stops the app when `stop_app` is `true`. Deleting stays a documented step. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Deploy the bundle, start the app, then run the job `capability-guides-databricks-apps` (or **Quick run** in the app):
# MAGIC
# MAGIC ```bash
# MAGIC databricks bundle deploy --target dev --var catalog=... --var warehouse_id=... --var app_service_principal=...
# MAGIC databricks bundle run databricks_apps_demo --target dev --var ...   # deploys the source and starts the app
# MAGIC databricks bundle run capability_guides_databricks_apps --target dev --var ...
# MAGIC ```
# MAGIC
# MAGIC To run by hand, open the notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog`, `schema` | Where `databricks_apps_inventory` is written. |
# MAGIC | `app_name` | The demo app. |
# MAGIC | `idle_days` | A running app with no deployment or update for this many days is flagged idle. |
# MAGIC | `stop_app` | `true` stops the app in `05_cleanup`. Anything else keeps it. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Do these before `health_check`. The first two also matter for `read_app` and `app_spaces`, which need the app to exist.
# MAGIC
# MAGIC 1. **Deploy the bundle.** This creates the app, and the app creates its own service principal:
# MAGIC    ```bash
# MAGIC    databricks bundle deploy --target dev --var catalog=<catalog> --var warehouse_id=<warehouse-id> --var app_service_principal=<app-sp-application-id>
# MAGIC    ```
# MAGIC 2. **Start and deploy the app.** A new app is stopped, and `health_check` stops with an error until it runs. Start it, then deploy the source with either command:
# MAGIC    ```bash
# MAGIC    databricks apps start <app-name>
# MAGIC    databricks bundle run databricks_apps_demo --target dev --var catalog=<catalog> --var warehouse_id=<warehouse-id> --var app_service_principal=<app-sp-application-id>
# MAGIC    # or, from the uploaded bundle files:
# MAGIC    databricks apps deploy <app-name> --source-code-path /Workspace/Users/<you>/.bundle/capability-guides-databricks-apps/dev/files/app
# MAGIC    ```
# MAGIC    `<app-name>` is the `app_name` variable (default `cg-apps-demo`).
# MAGIC 3. **Grant the app service principal read access.** `/whoami/app` counts the tables in the shared schema, and it sees only what the app service principal may read. Find its application ID with `databricks apps get <app-name>` (`service_principal_client_id`), then run:
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG <catalog> TO `<app-sp-application-id>`;
# MAGIC    GRANT USE SCHEMA, SELECT ON SCHEMA <catalog>.<schema> TO `<app-sp-application-id>`;
# MAGIC    ```
# MAGIC    The warehouse `CAN_USE` grant comes from the bundle. Users who open `/whoami/user` need the same grants on their own identity.
# MAGIC 4. **App Spaces (Beta), for `app_spaces` only.** A workspace admin turns on **Governed agentic app-building** on the workspace **Previews** page. Without it the notebook prints the UI steps and creates nothing.
# MAGIC 5. **Stop the app when you finish.** It bills about 0.5 DBU an hour while running (Medium):
# MAGIC    ```bash
# MAGIC    databricks apps stop <app-name>
# MAGIC    ```
# MAGIC

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params, JOB_TAG
JOB_KEY = "capability_guides_databricks_apps"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'app_name', 'idle_days', 'stop_app'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')
displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
