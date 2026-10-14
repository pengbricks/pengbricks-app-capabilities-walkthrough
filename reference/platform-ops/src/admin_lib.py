"""Pure helpers and the admin_actions ledger for the platform administration job."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import yaml

LEDGER_DDL = """
CREATE TABLE IF NOT EXISTS {table} (
  run_id STRING, category STRING, action STRING, target STRING,
  status STRING, detail STRING, recorded_at TIMESTAMP
) COMMENT 'Administration actions taken or checked by the capability guide admin job'
"""

# ok = read-only check passed, created/changed = the job modified an object it owns,
# unchanged = idempotent re-run found nothing to do, not_allowed = the workspace refused, flagged = needs attention
STATUSES = {"ok", "created", "changed", "unchanged", "not_allowed", "flagged", "error"}


def load_admin_spec(path: str) -> dict[str, Any]:
    with open(path) as f:
        return yaml.safe_load(f)["admin"]


def action(category: str, name: str, target: str, status: str, detail: str = "") -> dict[str, str]:
    if status not in STATUSES:
        raise ValueError(f"unknown status {status!r}")
    return {"category": category, "action": name, "target": target, "status": status, "detail": detail[:2000]}


def is_owned_name(name: str, prefix: str = "capability-guides-") -> bool:
    """Guard: the job may only change objects whose names carry the guide prefix."""
    return name.startswith(prefix)


def evaluate_warehouse(name: str, size: str, auto_stop_mins: int | None, serverless: bool, max_auto_stop: int) -> dict[str, str]:
    """Flag warehouses that never stop or stop later than the allowed idle time."""
    stop = auto_stop_mins or 0
    detail = f"size={size} auto_stop_mins={stop} serverless={serverless}"
    if stop == 0:
        return action("capacity", "warehouse_settings", name, "flagged", detail + " (auto-stop disabled)")
    if stop > max_auto_stop:
        return action("capacity", "warehouse_settings", name, "flagged", detail + f" (above {max_auto_stop} min)")
    return action("capacity", "warehouse_settings", name, "ok", detail)


def tokens_expiring(tokens: list[dict[str, Any]], now_ms: int, warn_days: int) -> list[dict[str, Any]]:
    """Tokens whose expiry falls inside the warning window. expiry_time is epoch ms; -1 means no expiry."""
    horizon = now_ms + warn_days * 86_400_000
    return [t for t in tokens if t.get("expiry_time", -1) not in (None, -1) and t["expiry_time"] <= horizon]


def ledger_merge_sql(table: str, view: str) -> str:
    """Idempotent write: a retried task updates its own rows instead of appending duplicates."""
    return f"""
MERGE INTO {table} t USING {view} s
ON t.run_id = s.run_id AND t.category = s.category AND t.action = s.action AND t.target = s.target
WHEN MATCHED THEN UPDATE SET t.status = s.status, t.detail = s.detail, t.recorded_at = s.recorded_at
WHEN NOT MATCHED THEN INSERT *
"""


def record(spark, table: str, run_id: str, rows: list[dict[str, str]]) -> None:
    if not rows:
        return
    now = datetime.now(timezone.utc)
    data = [(run_id, r["category"], r["action"], r["target"], r["status"], r["detail"], now) for r in rows]
    df = spark.createDataFrame(data, "run_id string, category string, action string, target string, status string, detail string, recorded_at timestamp")
    df.createOrReplaceTempView("_admin_rows")
    spark.sql(ledger_merge_sql(table, "_admin_rows"))


def cutoff_ms(hours: int, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    return int((now - timedelta(hours=hours)).timestamp() * 1000)
