from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agent_results import group_paths, history_sql, result_row, summarize_history, wait_for_rows  # noqa: E402


def test_history_sql_filters_on_the_agent_and_start_time() -> None:
    sql = history_sql("abc'123", "2026-10-20T10:00:00+00:00")
    assert "query_source.genie_space_id = 'abc''123'" in sql
    assert "start_time >= TIMESTAMP '2026-10-20T10:00:00+00:00'" in sql
    for column in ("executed_by", "executed_as", "compute.warehouse_id", "client_application"):
        assert column in sql


def test_wait_for_rows_stops_when_enough_rows_arrive() -> None:
    calls: list[int] = []
    sleeps: list[float] = []

    def fetch() -> list[int]:
        calls.append(1)
        return [1] * len(calls)

    rows, polls = wait_for_rows(fetch, minimum=3, attempts=10, pause_seconds=30, sleep=sleeps.append)
    assert (len(rows), polls) == (3, 3) and sleeps == [30, 30]


def test_wait_for_rows_reports_what_it_has_when_rows_never_arrive() -> None:
    rows, polls = wait_for_rows(lambda: [], minimum=1, attempts=3, pause_seconds=1, sleep=lambda _: None)
    assert rows == [] and polls == 3


def test_summarize_history_lists_distinct_values() -> None:
    rows = [
        {"executed_by": "a@x.com", "executed_as": "a@x.com", "warehouse_id": "w1", "compute_type": "WAREHOUSE", "client_application": None, "execution_status": "FINISHED"},
        {"executed_by": "a@x.com", "executed_as": "a@x.com", "warehouse_id": "w1", "compute_type": "WAREHOUSE", "client_application": None, "execution_status": "FAILED"},
    ]
    summary = summarize_history(rows)
    assert summary["statements"] == "2" and summary["warehouse_id"] == "w1"
    assert summary["execution_status"] == "FAILED, FINISHED" and summary["client_application"] == "none"


def test_group_paths_and_result_row() -> None:
    groups = group_paths(["attachments[].query.query", "attachments[].text.content", "status"])
    assert groups == {"attachments": ["attachments[].query.query", "attachments[].text.content"], "status": ["status"]}
    row = result_row("1", "ask", "q", 3, {"a": 1})
    assert len(row) == 8 and row[3] == "3"
