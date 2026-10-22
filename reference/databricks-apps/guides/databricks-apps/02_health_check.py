# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Check the app's health and the identity each route reports
# MAGIC
# MAGIC Calls the app URL with the OAuth token of the identity this notebook runs as (the job identity in a job, you when you run it by hand). Three routes:
# MAGIC
# MAGIC | Route | What it shows |
# MAGIC |---|---|
# MAGIC | `/health` | The app answers. |
# MAGIC | `/whoami/app` | A query run as the **app service principal** (app authorization). `current_user()` returns the service principal. |
# MAGIC | `/whoami/user` | The same query run with the token in `x-forwarded-access-token` (user authorization, the `sql` scope). `current_user()` returns the caller, so Unity Catalog applies that identity's grants, row filters, and column masks. |
# MAGIC
# MAGIC The two `visible_tables` counts can differ: `system.information_schema.tables` lists only what each identity may see in the shared schema. Grant the app service principal `USE CATALOG`, `USE SCHEMA`, and `SELECT` on the schema to make its count match yours.
# MAGIC
# MAGIC **Cost.** The app bills about 0.5 DBU per hour while it is running (Medium). A call wakes the SQL warehouse, which bills while it is up.
# MAGIC
# MAGIC Safe to rerun: every call is a GET that reads and changes nothing.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_databricks_apps", ['app_name'])
app_name = params["app_name"]

# COMMAND ----------

import requests
from databricks.sdk import WorkspaceClient
import apps_lib as lib

w = WorkspaceClient()
app = lib.require_app(w, app_name)
if not lib.is_billing(app):
    raise RuntimeError(f"App {app_name!r} is {lib.app_state(app)} (compute {lib.compute_state(app)}), so it cannot answer. Run: databricks apps start {app_name}, then databricks bundle run databricks_apps_demo --target dev --var ... (or databricks apps deploy {app_name} --source-code-path <workspace path of the app folder>). Nothing was changed.")
base = app["url"].rstrip("/")
headers = w.config.authenticate()  # the Authorization header for the identity running this notebook

# COMMAND ----------

rows = []
for route in ("/health", "/whoami/app", "/whoami/user"):
    # Redirects are off: a redirect to the sign-in page means the app did not accept this token.
    r = requests.get(base + route, headers=headers, allow_redirects=False, timeout=90)
    try:
        body = r.json()
    except ValueError:
        body = {}
    note = body.get("error") or ("" if body else f"no JSON (status {r.status_code}); the app may not accept this token")
    rows.append({"route": route, "http_status": r.status_code, "acts_as": body.get("acts_as", ""),
                 "identity": body.get("identity", ""), "visible_tables": body.get("visible_tables"), "note": note})
display(spark.createDataFrame(rows, "route string, http_status int, acts_as string, identity string, visible_tables long, note string"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Verdict

# COMMAND ----------

by_route = {r["route"]: r for r in rows}
healthy = by_route["/health"]["http_status"] == 200
print("health:", "ok" if healthy else f"failed (HTTP {by_route['/health']['http_status']}). {by_route['/health']['note']}")
app_id, user_id = by_route["/whoami/app"]["identity"], by_route["/whoami/user"]["identity"]
if app_id and user_id:
    print(f"/whoami/app reports {app_id}")
    print(f"/whoami/user reports {user_id}")
    print("Two different identities answered." if app_id != user_id else "Both routes reported the same identity. Check that the sql user API scope is declared.")
else:
    print("At least one identity route returned no identity. Read the note column above.")
dbutils.notebook.exit("healthy" if healthy else "unhealthy")
