"""Pure helpers for triage, routing and repair, plus the support_incidents and on_call tables."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

import yaml

INCIDENTS_DDL = """
CREATE TABLE IF NOT EXISTS {table} (
  incident_id STRING, detected_at TIMESTAMP, source STRING, job_key STRING, job_id BIGINT, run_id BIGINT,
  task_key STRING, run_url STRING, error_class STRING, severity STRING, error_message STRING,
  owner_team STRING, owner_contact STRING, escalation_contact STRING, route STRING,
  status STRING, resolved_at TIMESTAMP, repair_id BIGINT, outcome STRING
) COMMENT 'Failed capability guide runs, classified and routed by on_call; updated by the repair job'
"""

ON_CALL_COLUMNS = "tag_key string, tag_value string, owner_team string, owner_contact string, escalation_contact string, escalate_after_minutes int"
FAILED_STATES = {"FAILED", "TIMEDOUT"}


def load_support_spec(path: str) -> dict[str, Any]:
    with open(path) as f:
        return yaml.safe_load(f)["support"]


def classify(error_text: str | None, rules: list[dict[str, str]], default: dict[str, str]) -> tuple[str, str]:
    """First matching rule wins. Returns (error_class, severity)."""
    text = error_text or ""
    for rule in rules:
        if re.search(rule["pattern"], text, re.IGNORECASE):
            return rule["name"], rule["severity"]
    return default["name"], default["severity"]


def match_on_call(tags: dict[str, str], rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Return the first on_call row whose tag matches the job's tags; the '*' row is the fallback."""
    fallback = None
    for row in rows:
        if row["tag_key"] == "*":
            fallback = row
        elif tags.get(row["tag_key"]) == row["tag_value"]:
            return row
    if fallback is None:
        raise LookupError("on_call has no '*' fallback row")
    return fallback


def route_for(severity: str, on_call: dict[str, Any]) -> str:
    """High severity pages the escalation contact as well as the owner."""
    if severity == "high":
        return f"page {on_call['owner_contact']} and {on_call['escalation_contact']}"
    return f"notify {on_call['owner_contact']}; escalate to {on_call['escalation_contact']} after {on_call['escalate_after_minutes']} min"


def incident_id(run_id: int, task_key: str, source: str) -> str:
    return f"{run_id}:{task_key}:{source}"


def latest_attempts(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The Jobs API lists every retry as its own entry. Keep the highest attempt per task_key."""
    best: dict[str, dict[str, Any]] = {}
    for t in tasks:
        cur = best.get(t["task_key"])
        if cur is None or t.get("attempt_number", 0) >= cur.get("attempt_number", 0):
            best[t["task_key"]] = t
    return list(best.values())


def failed_tasks(run: dict[str, Any]) -> list[dict[str, Any]]:
    """Tasks whose latest attempt failed or timed out. A task that failed and then passed on retry is not an incident."""
    return [t for t in latest_attempts(run.get("tasks", [])) if t.get("result_state") in FAILED_STATES]


def pick_repair_target(runs: list[dict[str, Any]], task_key: str) -> dict[str, Any] | None:
    """Newest finished run whose given task failed and that has not already been repaired."""
    for run in sorted(runs, key=lambda r: r["start_time"], reverse=True):
        if not run.get("finished") or run.get("repair_count", 0) > 0:
            continue
        if any(t["task_key"] == task_key for t in failed_tasks(run)):
            return run
    return None


def run_url(host: str, job_id: int, run_id: int) -> str:
    return f"{host.rstrip('/')}/jobs/{job_id}/runs/{run_id}"


def now() -> datetime:
    return datetime.now(timezone.utc)
