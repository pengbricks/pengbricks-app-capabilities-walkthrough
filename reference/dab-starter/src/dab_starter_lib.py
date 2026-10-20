"""Checks for the dab-starter job: row counts across the layers, and expectation results from the event log.

Plain Python with no Spark, so the logic is testable with pytest on a laptop.
"""

from __future__ import annotations

import json
from typing import Any, Iterable


def check_layers(row_count: int, bronze: int, silver: int, gold_orders: int, silver_not_cancelled: int) -> list[str]:
    """Problems with the row counts across bronze, silver, and gold; an empty list means they agree.

    Gold counts orders per day and category without cancelled ones, so its orders must add up to the
    silver rows that are not cancelled.
    """
    problems = []
    if bronze != row_count:
        problems.append(f"bronze has {bronze} rows, expected {row_count}")
    if not 0 < silver <= bronze:
        problems.append(f"silver has {silver} rows, expected between 1 and {bronze}")
    if gold_orders != silver_not_cancelled:
        problems.append(f"gold counts {gold_orders} orders, silver has {silver_not_cancelled} that are not cancelled")
    return problems


def expectation_totals(details: Iterable[str | dict[str, Any]]) -> list[dict[str, Any]]:
    """Passed and failed rows per expectation, from the `details` column of flow_progress events.

    Each item is one event's details, as a JSON string or a dict. Events without expectation
    results are skipped. Rows come back sorted by dataset, then expectation.
    """
    totals: dict[tuple[str, str], dict[str, Any]] = {}
    for item in details:
        parsed = json.loads(item) if isinstance(item, str) else item
        progress = (parsed or {}).get("flow_progress") or {}
        for expectation in (progress.get("data_quality") or {}).get("expectations") or []:
            key = (expectation["dataset"], expectation["name"])
            row = totals.setdefault(key, {"dataset": key[0], "name": key[1], "passed": 0, "failed": 0})
            row["passed"] += int(expectation.get("passed_records") or 0)
            row["failed"] += int(expectation.get("failed_records") or 0)
    return [totals[key] for key in sorted(totals)]
