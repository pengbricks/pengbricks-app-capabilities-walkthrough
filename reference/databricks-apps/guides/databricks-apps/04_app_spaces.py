# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. App Spaces and Genie App Builder (Beta), read-only
# MAGIC
# MAGIC App Spaces and Genie App Builder are in **Beta**. A workspace admin must turn on **Governed agentic app-building** on the Previews page, and Beta behavior can change. Genie App Builder has no public API: you build from the Build tab on the Apps home page.
# MAGIC
# MAGIC The SDK does have a read-only call for spaces: `apps.list_spaces` (`GET /api/2.0/app-spaces`). This notebook uses it to answer two questions without creating anything:
# MAGIC
# MAGIC 1. **Is the preview on?** If the list call works, the preview is on for this workspace and your identity may read spaces. If it fails, the preview is off or this identity lacks access, and the notebook prints the UI steps.
# MAGIC 2. **Which spaces exist?** For each one it shows the scopes, usage policy, resources, and how many apps sit inside.
# MAGIC
# MAGIC **Cost.** Reading spaces costs nothing. Both features are free during Beta, and the price after Beta is not public.
# MAGIC
# MAGIC Safe to rerun: the notebook only calls list and get. It never creates, updates, or deletes a space.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_databricks_apps", ['app_name'])
app_name = params["app_name"]

# COMMAND ----------

from databricks.sdk import WorkspaceClient
import apps_lib as lib

w = WorkspaceClient()
spaces, error = [], None
try:
    spaces = [s.as_dict() for s in w.apps.list_spaces()]
except Exception as exc:  # preview off, no permission, or an SDK without the call
    error = exc
print("App Spaces preview:", lib.spaces_preview_status(error))

# COMMAND ----------

if error is not None:
    print(f"The list call failed: {type(error).__name__}: {error}\n")
    print("To turn the preview on and create a space in the UI:")
    for number, step in enumerate(lib.UI_STEPS, 1):
        print(f"  {number}. {step}")
elif not spaces:
    print("The preview is on, and this workspace has no App Spaces yet. To create one in the UI:")
    for number, step in enumerate(lib.UI_STEPS[1:], 1):
        print(f"  {number}. {step}")
else:
    rows = []
    for s in spaces:
        inside = [a.name for a in w.apps.list(space=s["name"])]
        rows.append({"space": s["name"], "state": ((s.get("status") or {}).get("state") or ""), "creator": s.get("creator", ""),
                     "user_api_scopes": ", ".join(s.get("effective_user_api_scopes") or []),
                     "usage_policy_id": s.get("effective_usage_policy_id", ""),
                     "resources": len(s.get("resources") or []), "apps_inside": len(inside)})
    display(spark.createDataFrame(rows, "space string, state string, creator string, user_api_scopes string, usage_policy_id string, resources int, apps_inside int"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Where the demo app sits
# MAGIC
# MAGIC A standard app can belong to a space, which then sets its scopes, usage policy, and permissions. The demo app is deployed on its own.

# COMMAND ----------

app = lib.require_app(w, app_name)
print(f"{app_name}: space = {app.get('space') or 'none (governed per app)'}")
