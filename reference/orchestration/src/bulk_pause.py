"""Helpers for the bulk pause notebooks (guides/orchestration-patterns/08 to 11).

Phases, one notebook each:
  prepare  create a small scheduled probe job (so there is an unpaused schedule), record states ("before")
  pause    set every UNPAUSED schedule to PAUSED, record the jobs it changed, then re-read states ("after_pause")
  resume   restore only the jobs this run paused, then re-read states ("after_resume")
  cleanup  delete the probe job

Every state is written to <catalog>.<schema>.bulk_pause_log, so the before and after are queryable.
"""

from __future__ import annotations

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
    # Replace this run's rows for the phase, so rerunning a phase by hand does not duplicate them.
    spark.sql(f"DELETE FROM {table} WHERE job_run_id = '{run_id}' AND phase = '{phase}'")
    rows = [(run_id, phase, j["job_id"], j["job_name"], j["tag_value"], j["schedule_status"], now) for j in jobs]
    if rows:
        spark.createDataFrame(rows, LOG_SCHEMA).write.mode("append").saveAsTable(table)
    print(f"[{phase}] {len(jobs)} job(s): {g.count_states(jobs)}")
    for j in jobs:
        print(f"   {j['job_id']}  {j['schedule_status']:9}  {j['job_name']}")


def ensure_probe(w) -> None:
    from databricks.sdk.service.jobs import CronSchedule, PauseStatus, Task, NotebookTask

    delete_probe(w)
    # Yearly schedule that is unpaused but will not fire during the demo; the notebook path is a placeholder.
    w.jobs.create(
        name=PROBE_KEY,
        tags={TAG: PROBE_KEY},
        schedule=CronSchedule(quartz_cron_expression="0 0 3 1 1 ?", timezone_id="UTC", pause_status=PauseStatus.UNPAUSED),
        tasks=[Task(task_key="noop", notebook_task=NotebookTask(notebook_path="/Workspace/Shared/capability_guides_noop"))],
    )


def delete_probe(w) -> None:
    for job in w.jobs.list(name=PROBE_KEY):
        w.jobs.delete(job_id=job.job_id)
