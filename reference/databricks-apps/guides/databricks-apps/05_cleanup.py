# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Cleanup: stop the app so it stops billing
# MAGIC
# MAGIC The demo app bills about 0.5 DBU per hour while it is running (Medium), around 365 DBU a month if you leave it on. A stopped app costs nothing.
# MAGIC
# MAGIC **This notebook keeps the app unless `stop_app` is `true`.** The job default is `false`, so a normal run changes nothing. To stop it, run the job with `stop_app=true`, or run this notebook by hand with the widget set to `true`.
# MAGIC
# MAGIC | State of the app | `stop_app` | Result |
# MAGIC |---|---|---|
# MAGIC | any | not `true` | Keeps the app and prints the cost. |
# MAGIC | running or starting | `true` | Stops it and waits until compute is stopped. |
# MAGIC | already stopped or stopping | `true` | Does nothing. |
# MAGIC | does not exist | `true` | Does nothing. |
# MAGIC
# MAGIC **Deleting is a separate step you run yourself.** Stopping keeps the app, its URL, and its service principal, so you can start it again with `databricks apps start <app_name>`. To remove everything the bundle created, including the app:
# MAGIC
# MAGIC ```bash
# MAGIC databricks bundle destroy --target dev --var catalog=... --var warehouse_id=... --var app_service_principal=...
# MAGIC # or only the app:  databricks apps delete <app_name>
# MAGIC ```
# MAGIC
# MAGIC The `databricks_apps_inventory` row stays after cleanup. Drop the table if you want it gone.
# MAGIC
# MAGIC Safe to rerun: stopping an app that is already stopped is a no-op, so running this twice leaves the same end state.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_databricks_apps", ['app_name', 'stop_app'])
app_name, stop_app = params["app_name"], params["stop_app"]

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
import apps_lib as lib

w = WorkspaceClient()
try:
    app = w.apps.get(name=app_name).as_dict()
except NotFound:
    app = None
action = lib.cleanup_action(app, stop_app)
print(f"app = {app_name}, stop_app = {stop_app!r}, action = {action}")

if action == "keep":
    state = f"{lib.app_state(app)} / {lib.compute_state(app)}" if app else "missing"
    print(f"Keeping the app ({state}). " + ("It is billing about 0.5 DBU per hour at Medium. Run with stop_app=true to stop it." if app and lib.is_billing(app) else "It is not billing."))
elif action == "stop":
    w.apps.stop_and_wait(name=app_name)
    print("Stopped. The app no longer bills compute.")
else:
    print("Nothing to do: the app is already stopped or does not exist.")

# COMMAND ----------

if app is not None:
    after = w.apps.get(name=app_name).as_dict()
    print(f"Now: app {lib.app_state(after)}, compute {lib.compute_state(after)}")
print("To delete the app (not done here): databricks apps delete", app_name, "or databricks bundle destroy")
