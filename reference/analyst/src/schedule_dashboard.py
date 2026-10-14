"""Schedule the published dashboard and subscribe an email address. The bundle cannot declare either, so this task creates them and records their IDs."""

from __future__ import annotations

import argparse


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--dashboard-id", required=True)
    parser.add_argument("--warehouse-id", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--cron", default="0 0 7 ? * MON")
    parser.add_argument("--timezone", default="America/New_York")
    parser.add_argument("--run-id", default="manual")
    args = parser.parse_args()

    from databricks.sdk import WorkspaceClient
    from databricks.sdk.runtime import spark
    from databricks.sdk.service.dashboards import CronSchedule, Schedule, Subscriber, Subscription, SubscriptionSubscriberUser
    from databricks.sdk.service.dashboards import SchedulePauseStatus

    w = WorkspaceClient()
    name = "Weekly partner orders"
    schedule = next((s for s in w.lakeview.list_schedules(args.dashboard_id) if s.display_name == name), None)
    if schedule is None:
        schedule = w.lakeview.create_schedule(
            args.dashboard_id,
            Schedule(
                display_name=name,
                cron_schedule=CronSchedule(quartz_cron_expression=args.cron, timezone_id=args.timezone),
                pause_status=SchedulePauseStatus.UNPAUSED,
                warehouse_id=args.warehouse_id,
            ),
        )
        print(f"Created schedule {schedule.schedule_id}")
    else:
        print(f"Reusing schedule {schedule.schedule_id}")

    users = list(w.users.list(filter=f'userName eq "{args.email}"'))
    if not users:
        raise RuntimeError(f"No workspace user with email {args.email}")
    user_id = int(users[0].id)
    existing = [
        s for s in w.lakeview.list_subscriptions(args.dashboard_id, schedule.schedule_id)
        if s.subscriber and s.subscriber.user_subscriber and s.subscriber.user_subscriber.user_id == user_id
    ]
    if existing:
        subscription = existing[0]
        print(f"Reusing subscription {subscription.subscription_id}")
    else:
        subscription = w.lakeview.create_subscription(
            args.dashboard_id,
            schedule.schedule_id,
            Subscription(subscriber=Subscriber(user_subscriber=SubscriptionSubscriberUser(user_id=user_id))),
        )
        print(f"Created subscription {subscription.subscription_id}")

    spark.createDataFrame(
        [(args.dashboard_id, schedule.schedule_id, subscription.subscription_id, args.cron, args.timezone, args.email, args.run_id)],
        "dashboard_id STRING, schedule_id STRING, subscription_id STRING, cron STRING, timezone STRING, subscriber STRING, run_id STRING",
    ).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{args.catalog}.{args.schema}.dashboard_subscription")


if __name__ == "__main__":
    main()
