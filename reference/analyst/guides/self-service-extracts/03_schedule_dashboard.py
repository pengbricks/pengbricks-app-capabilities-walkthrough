# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Schedule the dashboard
# MAGIC
# MAGIC Schedules the published dashboard and subscribes an address. The bundle cannot declare either, so this notebook creates them and records their IDs. Safe to rerun: the schedule is found by name and the subscriber by user, so a rerun reuses both.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_extracts", ['catalog', 'schema', 'use_case', 'warehouse_id', 'notification_email', 'dashboard_id', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
fq = f"{catalog}.{schema}"
ROOT = bundle_root()
SPEC_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Find or create the schedule

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.dashboards import (
    CronSchedule, Schedule, SchedulePauseStatus, Subscriber, Subscription, SubscriptionSubscriberUser,
)

CRON, TIMEZONE = "0 0 7 ? * MON", "America/New_York"
w = WorkspaceClient()
dashboard_id = params["dashboard_id"]
name = "Weekly partner orders"
schedule = next((s for s in w.lakeview.list_schedules(dashboard_id) if s.display_name == name), None)
if schedule is None:
    schedule = w.lakeview.create_schedule(
        dashboard_id,
        Schedule(
            display_name=name,
            cron_schedule=CronSchedule(quartz_cron_expression=CRON, timezone_id=TIMEZONE),
            pause_status=SchedulePauseStatus.UNPAUSED,
            warehouse_id=params["warehouse_id"],
        ),
    )
    print(f"Created schedule {schedule.schedule_id}")
else:
    print(f"Reusing schedule {schedule.schedule_id}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Find or create the subscription

# COMMAND ----------

email = params["notification_email"]
users = list(w.users.list(filter=f'userName eq "{email}"'))
if not users:
    raise Exception(f"No workspace user with email {email}")
user_id = int(users[0].id)
existing = [
    s for s in w.lakeview.list_subscriptions(dashboard_id, schedule.schedule_id)
    if s.subscriber and s.subscriber.user_subscriber and s.subscriber.user_subscriber.user_id == user_id
]
if existing:
    subscription = existing[0]
    print(f"Reusing subscription {subscription.subscription_id}")
else:
    subscription = w.lakeview.create_subscription(
        dashboard_id,
        schedule.schedule_id,
        Subscription(subscriber=Subscriber(user_subscriber=SubscriptionSubscriberUser(user_id=user_id))),
    )
    print(f"Created subscription {subscription.subscription_id}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the IDs

# COMMAND ----------

spark.createDataFrame(
    [(dashboard_id, schedule.schedule_id, subscription.subscription_id, CRON, TIMEZONE, email, params["run_id"])],
    "dashboard_id STRING, schedule_id STRING, subscription_id STRING, cron STRING, timezone STRING, subscriber STRING, run_id STRING",
).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{fq}.dashboard_subscription")
display(spark.table(f"{fq}.dashboard_subscription"))
