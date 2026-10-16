# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Set up context and alert routing
# MAGIC
# MAGIC Records the workspace ID and builds `ops_alert_routing`. `system.lakeflow.jobs` has health rules but not `email_notifications`, so alert routing comes from the Jobs API. SQL alert subscriptions come from the Alerts v2 API. Both tables use `CREATE OR REPLACE`, so a rerun replaces them.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_monitoring_snapshot", ['catalog', 'schema', 'lookback_days', 'audit_lookback_days', 'guide_tag_key', 'use_case_tag_key', 'alert_email'])
catalog, schema = params["catalog"], params["schema"]
fq = f"`{catalog}`.`{schema}`"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the workspace ID
# MAGIC
# MAGIC The other tasks filter system tables to this workspace.

# COMMAND ----------

from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
ws_id = str(w.get_workspace_id())
spark.sql(f"CREATE OR REPLACE TABLE {fq}.ops_context AS SELECT '{ws_id}' AS workspace_id")
rows = []

def add(kind, name, ident, tags, rule, dest_type, dest):
    rows.append((
        kind, str(name), str(ident),
        (tags or {}).get(params["guide_tag_key"], ""),
        (tags or {}).get(params["use_case_tag_key"], ""),
        (tags or {}).get(params["guide_tag_key"]) is not None,
        rule, dest_type, dest,
    ))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Job notifications and health rules
# MAGIC
# MAGIC One row per email address, webhook or health rule on every job in the workspace.

# COMMAND ----------

for j in w.jobs.list(expand_tasks=False):
    s = j.settings
    if s is None:
        continue
    tags = s.tags or {}
    en = s.email_notifications
    if en:
        for event, addrs in (("on_start", en.on_start), ("on_success", en.on_success),
                             ("on_failure", en.on_failure),
                             ("on_duration_warning_threshold_exceeded",
                              en.on_duration_warning_threshold_exceeded),
                             ("on_streaming_backlog_exceeded", en.on_streaming_backlog_exceeded)):
            for addr in addrs or []:
                add("job_email_notification", s.name, j.job_id, tags, event, "email", addr)
    wn = s.webhook_notifications
    if wn:
        for event in ("on_start", "on_success", "on_failure", "on_duration_warning_threshold_exceeded"):
            for d in getattr(wn, event, None) or []:
                add("job_webhook_notification", s.name, j.job_id, tags, event,
                    "notification_destination", d.id)
    if s.health and s.health.rules:
        dests = []
        if en:
            dests = list(en.on_duration_warning_threshold_exceeded or [])
        for r in s.health.rules:
            rule = f"{r.metric.value} {r.op.value} {r.value}"
            if dests:
                for d in dests:
                    add("job_health_rule", s.name, j.job_id, tags, rule, "email", d)
            else:
                add("job_health_rule", s.name, j.job_id, tags, rule, "none", "")

# COMMAND ----------

# MAGIC %md
# MAGIC ## SQL alert subscriptions

# COMMAND ----------

try:
    for a in w.alerts_v2.list_alerts():
        subs = (a.evaluation.notification.subscriptions
                if a.evaluation and a.evaluation.notification else None) or []
        rule = ""
        if a.evaluation:
            rule = f"{a.evaluation.source.name if a.evaluation.source else ''} {a.evaluation.comparison_operator.value if a.evaluation.comparison_operator else ''}"
        if not subs:
            add("sql_alert", a.display_name, a.id, {}, rule, "none", "")
        for sub in subs:
            if sub.user_email:
                add("sql_alert", a.display_name, a.id, {}, rule, "email", sub.user_email)
            elif sub.destination_id:
                add("sql_alert", a.display_name, a.id, {}, rule, "notification_destination", sub.destination_id)
except Exception as e:  # alerts API not available in every workspace
    print(f"Skipping SQL alerts: {e}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write `ops_alert_routing`

# COMMAND ----------

schema_ddl = ("source_type STRING, name STRING, resource_id STRING, capability_guide_job STRING, "
              "capability_guide_use_case STRING, is_capability_guide_job BOOLEAN, rule STRING, "
              "destination_type STRING, destination STRING")
df = spark.createDataFrame(rows, schema_ddl)
df.createOrReplaceTempView("alert_routing_src")
spark.sql(f"CREATE OR REPLACE TABLE {fq}.ops_alert_routing AS "
          "SELECT *, current_timestamp() AS captured_at FROM alert_routing_src")
print(f"workspace {ws_id}: {len(rows)} routing rows")
display(spark.table(f"{fq}.ops_alert_routing").limit(20))
