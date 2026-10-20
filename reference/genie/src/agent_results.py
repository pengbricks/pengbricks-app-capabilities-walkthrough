"""Helpers for the Genie Agents guide: one results table that each task writes its own rows to, and the system-table lookups."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Callable

from genie_lib import sql_str

RESULTS_TABLE = "genie_agents_results"
RESULTS_SCHEMA = (
    "run_id string, step string, item string, value string, detail string, conversation_id string, message_id string, recorded_at string"
)
GUIDE = "genie-agents"


def result_row(run_id: str, step: str, item: str, value: Any, detail: Any = "", conversation_id: str = "", message_id: str = "") -> tuple[str, ...]:
    """One results row. Values are stored as text."""
    now = datetime.now(timezone.utc).isoformat()
    return (run_id, step, item, str(value), str(detail), conversation_id, message_id, now)


def write_step(spark: Any, base: str, step: str, rows: list[tuple[str, ...]]) -> None:
    """Replace the rows of one step. A rerun swaps its own rows and leaves other steps alone, so the table keeps its row count."""
    spark.sql(f"CREATE TABLE IF NOT EXISTS {base}.{RESULTS_TABLE} ({RESULTS_SCHEMA})")
    spark.sql(f"DELETE FROM {base}.{RESULTS_TABLE} WHERE step = {sql_str(step)}")
    if rows:
        spark.createDataFrame(rows, RESULTS_SCHEMA).write.mode("append").saveAsTable(f"{base}.{RESULTS_TABLE}")


def read_step(spark: Any, base: str, step: str) -> list[Any]:
    return spark.sql(f"SELECT * FROM {base}.{RESULTS_TABLE} WHERE step = {sql_str(step)} ORDER BY recorded_at, item").collect()


def history_sql(space_id: str, since_iso: str) -> str:
    """Statements the Genie agent issued since the given time, with who ran them and on which warehouse."""
    return f"""
SELECT statement_id, executed_by, executed_as, compute.type AS compute_type, compute.warehouse_id AS warehouse_id,
       client_application, execution_status, total_duration_ms, CAST(start_time AS STRING) AS start_time
FROM system.query.history
WHERE query_source.genie_space_id = {sql_str(space_id)} AND start_time >= TIMESTAMP {sql_str(since_iso)}
ORDER BY start_time
""".strip()


def wait_for_rows(
    fetch: Callable[[], list[Any]],
    minimum: int,
    attempts: int,
    pause_seconds: float,
    sleep: Callable[[float], None] = time.sleep,
) -> tuple[list[Any], int]:
    """Poll `fetch` until it returns at least `minimum` rows or the attempts run out. Returns (rows, polls used)."""
    rows: list[Any] = []
    for poll in range(1, attempts + 1):
        rows = fetch()
        if len(rows) >= minimum:
            return rows, poll
        if poll < attempts:
            sleep(pause_seconds)
    return rows, attempts


def summarize_history(rows: list[dict[str, Any]]) -> dict[str, str]:
    """Who ran the statements and where: the distinct values of each identity and compute field."""

    def distinct(key: str) -> str:
        return ", ".join(sorted({str(row.get(key)) for row in rows if row.get(key) is not None})) or "none"

    return {
        "statements": str(len(rows)),
        "executed_by": distinct("executed_by"),
        "executed_as": distinct("executed_as"),
        "compute_type": distinct("compute_type"),
        "warehouse_id": distinct("warehouse_id"),
        "client_application": distinct("client_application"),
        "execution_status": distinct("execution_status"),
    }


def group_paths(paths: list[str]) -> dict[str, list[str]]:
    """Group dotted field paths by their first name: {"attachments": ["attachments[].query.query", ...], "status": ["status"]}."""
    groups: dict[str, list[str]] = {}
    for path in sorted(set(paths)):
        root = path.split(".")[0].replace("[]", "")
        groups.setdefault(root, []).append(path)
    return groups
