"""Setup task: record the workspace ID and build ops_alert_routing.

system.lakeflow.jobs has health rules but not email_notifications, so alert
routing comes from the Jobs API. SQL alert subscriptions come from the Alerts v2 API.
"""
import argparse

from databricks.sdk import WorkspaceClient
from pyspark.sql import SparkSession

p = argparse.ArgumentParser()
for a in ("catalog", "schema", "guide_tag_key", "use_case_tag_key", "alert_email"):
    p.add_argument(f"--{a}", required=True)
args = p.parse_args()

spark = SparkSession.builder.getOrCreate()
w = WorkspaceClient()
fq = f"`{args.catalog}`.`{args.schema}`"
ws_id = str(w.get_workspace_id())

spark.sql(f"CREATE OR REPLACE TABLE {fq}.ops_context AS SELECT '{ws_id}' AS workspace_id")

rows = []


def add(kind, name, ident, tags, rule, dest_type, dest, guide_job=None):
    rows.append((
        kind, str(name), str(ident),
        (tags or {}).get(args.guide_tag_key, ""),
        (tags or {}).get(args.use_case_tag_key, ""),
        (tags or {}).get(args.guide_tag_key) is not None,
        rule, dest_type, dest,
    ))


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

schema = ("source_type STRING, name STRING, resource_id STRING, capability_guide_job STRING, "
          "capability_guide_use_case STRING, is_capability_guide_job BOOLEAN, rule STRING, "
          "destination_type STRING, destination STRING")
df = spark.createDataFrame(rows, schema)
df.createOrReplaceTempView("alert_routing_src")
spark.sql(f"CREATE OR REPLACE TABLE {fq}.ops_alert_routing AS "
          "SELECT *, current_timestamp() AS captured_at FROM alert_routing_src")
print(f"workspace {ws_id}: {len(rows)} routing rows")
