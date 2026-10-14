"""Pause and resume every scheduled job tagged `capability_guide_job` in one operation.

phases:
  prepare  create a small scheduled probe job (so there is an unpaused schedule), record states ("before")
  pause    set every UNPAUSED schedule to PAUSED, record the jobs it changed, then re-read states ("after_pause")
  resume   restore only the jobs this run paused, then re-read states ("after_resume")
  cleanup  delete the probe job

Every state is written to <catalog>.<schema>.bulk_pause_log, so the before and after are queryable.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

import guide_lib as g

TAG = "capability_guide_job"
PROBE_KEY = "capability_guides_bulk_pause_probe"
LOG_SCHEMA = (
    "job_run_id STRING, phase STRING, job_id BIGINT, job_name STRING, tag_value STRING, "
    "schedule_status STRING, recorded_at TIMESTAMP"
)


def tagged_scheduled_jobs(w) -> list[dict]:
    """Every job with the guide tag and a cron schedule, with its current pause status."""
    found = []
    for job in w.jobs.list(expand_tasks=False):
        settings = job.settings
        tags = (settings.tags if settings else None) or {}
        if TAG in tags and settings.schedule is not None:
            found.append(
                {
                    "job_id": job.job_id,
                    "job_name": settings.name,
                    "tag_value": tags[TAG],
                    "schedule_status": settings.schedule.pause_status.value if settings.schedule.pause_status else "UNPAUSED",
                    "cron": settings.schedule.quartz_cron_expression,
                    "timezone": settings.schedule.timezone_id,
                }
            )
    return sorted(found, key=lambda j: j["job_id"])


def set_status(w, job: dict, status: str) -> None:
    from databricks.sdk.service.jobs import CronSchedule, JobSettings, PauseStatus

    w.jobs.update(
        job_id=job["job_id"],
        new_settings=JobSettings(
            schedule=CronSchedule(
                quartz_cron_expression=job["cron"], timezone_id=job["timezone"], pause_status=PauseStatus(status)
            )
        ),
    )


def log(spark, table: str, run_id: str, phase: str, jobs: list[dict]) -> None:
    now = datetime.now(timezone.utc)
    rows = [(run_id, phase, j["job_id"], j["job_name"], j["tag_value"], j["schedule_status"], now) for j in jobs]
    if rows:
        spark.createDataFrame(rows, LOG_SCHEMA).write.mode("append").saveAsTable(table)
    print(f"[{phase}] {len(jobs)} job(s): {g.count_states(jobs)}")
    for j in jobs:
        print(f"   {j['job_id']}  {j['schedule_status']:9}  {j['job_name']}")


def ensure_probe(w) -> None:
    from databricks.sdk.service.jobs import CronSchedule, PauseStatus, Task, NotebookTask

    for job in w.jobs.list(name=PROBE_KEY):
        w.jobs.delete(job_id=job.job_id)
    # Yearly schedule that is unpaused but will not fire during the demo; the notebook path is a placeholder.
    w.jobs.create(
        name=PROBE_KEY,
        tags={TAG: PROBE_KEY},
        schedule=CronSchedule(quartz_cron_expression="0 0 3 1 1 ?", timezone_id="UTC", pause_status=PauseStatus.UNPAUSED),
        tasks=[Task(task_key="noop", notebook_task=NotebookTask(notebook_path="/Workspace/Shared/capability_guides_noop"))],
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--phase", required=True, choices=["prepare", "pause", "resume", "cleanup"])
    args = parser.parse_args()

    from databricks.sdk import WorkspaceClient
    from databricks.sdk.runtime import spark

    w = WorkspaceClient()
    table = f"{args.catalog}.{args.schema}.bulk_pause_log"
    spark.sql(f"CREATE TABLE IF NOT EXISTS {table} ({LOG_SCHEMA})")

    if args.phase == "prepare":
        ensure_probe(w)
        log(spark, table, args.run_id, "before", tagged_scheduled_jobs(w))

    elif args.phase == "pause":
        jobs = tagged_scheduled_jobs(w)
        to_pause = g.plan_pause_change(jobs, "PAUSED")
        for job in to_pause:
            set_status(w, job, "PAUSED")
        # Remember exactly which jobs this run changed, so resume restores only those.
        log(spark, table, args.run_id, "paused_by_run", [{**j, "schedule_status": "UNPAUSED"} for j in to_pause])
        log(spark, table, args.run_id, "after_pause", tagged_scheduled_jobs(w))

    elif args.phase == "resume":
        changed = {
            row.job_id: row
            for row in spark.sql(
                f"SELECT job_id FROM {table} WHERE job_run_id = '{args.run_id}' AND phase = 'paused_by_run'"
            ).collect()
        }
        jobs = tagged_scheduled_jobs(w)
        for job in jobs:
            if job["job_id"] in changed:
                set_status(w, job, "UNPAUSED")
        log(spark, table, args.run_id, "after_resume", tagged_scheduled_jobs(w))

    else:
        for job in w.jobs.list(name=PROBE_KEY):
            w.jobs.delete(job_id=job.job_id)
        print("deleted probe job")


if __name__ == "__main__":
    main()
