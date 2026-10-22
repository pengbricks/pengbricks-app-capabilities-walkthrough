# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Cost check: every app in the workspace
# MAGIC
# MAGIC Lists every app with its compute size, status, and resources, and flags apps that are **running but idle**. An app bills compute while it runs: Medium is 0.5 DBU per hour, Large 1, XLarge 3. Deploying and crashed apps do not bill, and a stopped app costs nothing, so stopped apps are never flagged.
# MAGIC
# MAGIC **How idle is decided.** The Apps API has no request counter. An app is flagged when it is running and has had no deployment or update for `idle_days` days. That is a prompt to look, not proof. Open the app's Insights tab (Beta) for viewers, and check `system.billing.usage` for the DBUs it billed, before you stop anything.
# MAGIC
# MAGIC **Cost.** The notebook calls `apps.list` and does not touch any app. The demo app bills about 0.5 DBU per hour while it is running.
# MAGIC
# MAGIC Safe to rerun: the notebook only reads and displays. It writes no table and changes no app.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_databricks_apps", ['idle_days'])
idle_days = int(params["idle_days"])

# COMMAND ----------

from datetime import datetime, timezone
from databricks.sdk import WorkspaceClient
import apps_lib as lib

w = WorkspaceClient()
now = datetime.now(timezone.utc)
apps = [a.as_dict() for a in w.apps.list()]
rows = [lib.cost_row(a, now, idle_days) for a in apps]
schema = ("app_name string, compute_size string, app_state string, compute_state string, resources string, "
          "days_since_change int, dbu_per_month_if_running double, flag string")
display(spark.createDataFrame(sorted(rows, key=lambda r: (r["flag"] != "running and idle", r["flag"] != "running", r["app_name"])), schema))

# COMMAND ----------

running = [r for r in rows if r["flag"] != "not billing"]
idle = [r for r in rows if r["flag"] == "running and idle"]
print(f"{len(rows)} apps in the workspace, {len(running)} running, {len(rows) - len(running)} not billing.")
print(f"Running apps would use about {sum(r['dbu_per_month_if_running'] for r in running):,.0f} DBU a month if they stay on.")
print(f"{len(idle)} running app(s) flagged idle (no deployment or update in {idle_days} days):")
for r in idle:
    print(f"  {r['app_name']}: {r['compute_size']}, {r['dbu_per_month_if_running']:,.0f} DBU a month. To stop it: databricks apps stop {r['app_name']}")
