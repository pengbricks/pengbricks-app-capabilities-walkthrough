# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Collect the audit events
# MAGIC
# MAGIC `system.access.audit` lags events by several minutes, so this notebook polls until the closing event shows up or the wait budget runs out. The job passes `started_epoch` and `final_action` from `02_share_and_read`. Run on its own, it looks back one hour and waits for `deleteRecipient`. Safe to rerun: the events table is overwritten.

# COMMAND ----------

import sys, os, time
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
from open_data.sharing import audit_event_query
from open_data.spec import load_spec

params = load_params(
    dbutils, "capability_guides_data_sharing", ["catalog", "schema", "use_case", "started_epoch", "final_action"],
    defaults={"started_epoch": str(int(time.time()) - 3600), "final_action": "deleteRecipient"},
)
catalog, schema = params["catalog"], params["schema"]
started_epoch, final_action = int(params["started_epoch"]), params["final_action"]
cfg = load_spec(bundle_root() / "use_cases" / f"{params['use_case']}.yml")["sharing"]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Poll for the closing event

# COMMAND ----------

query = audit_event_query(started_epoch, cfg["share_name"], cfg["recipient_name"])
deadline = time.time() + int(cfg["audit_wait_seconds"])
while True:
    events = spark.sql(query)
    actions = {r["action_name"] for r in events.select("action_name").distinct().collect()}
    if final_action in actions or time.time() > deadline:
        break
    print(f"{events.count()} events so far, waiting for {final_action}")
    time.sleep(30)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Save the events

# COMMAND ----------

target = f"{catalog}.{schema}.sharing_audit_events"
events.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(target)
summary = spark.sql(f"SELECT action_name, count(*) AS n FROM {target} GROUP BY action_name ORDER BY action_name")
display(summary)
