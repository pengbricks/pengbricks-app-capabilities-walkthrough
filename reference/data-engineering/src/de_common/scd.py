"""SCD counts: measure the type 1 and type 2 tables, and work out what the spec says they should hold."""

from __future__ import annotations

from typing import Any

# SCD type 1 has no end date, so every row is current.
TARGETS = {"scd1": ("accounts_scd1", "TRUE"), "scd2": ("accounts_scd2", "__END_AT IS NULL")}


def measure(spark, scope: str) -> dict[str, dict[str, int]]:
    """current_rows, history_rows, keys_with_multiple_rows and deleted_keys for each SCD table."""
    values: dict[str, dict[str, int]] = {}
    for label, (table, current) in TARGETS.items():
        full = f"{scope}.{table}"
        values[label] = {
            "current_rows": spark.sql(f"SELECT count(*) FROM {full} WHERE {current}").first()[0],
            "history_rows": spark.table(full).count(),
            "keys_with_multiple_rows": spark.sql(
                f"SELECT count(*) FROM (SELECT account_id FROM {full} GROUP BY account_id HAVING count(*) > 1)"
            ).first()[0],
            # A deleted key is one the feed deleted that has no current row in the target.
            "deleted_keys": spark.sql(
                f"SELECT count(*) FROM (SELECT DISTINCT account_id FROM {scope}.accounts_changes "
                f"WHERE change_type = 'DELETE') d WHERE NOT EXISTS "
                f"(SELECT 1 FROM {full} t WHERE t.account_id = d.account_id AND {current})"
            ).first()[0],
        }
    return values


def expected(spec: dict[str, Any], phase: str) -> tuple[dict[str, int], int]:
    """What both tables should hold for current_rows and deleted_keys, and the type 2 history row count."""
    accounts = spec["accounts"]
    changes = accounts["changes"]
    if phase == "before":
        return {"current_rows": accounts["rows"], "deleted_keys": 0}, accounts["rows"]
    return (
        {"current_rows": accounts["rows"] + changes["inserts"] - changes["deletes"], "deleted_keys": changes["deletes"]},
        accounts["rows"] + changes["inserts"] + changes["updates"],
    )


def problems(values: dict[str, dict[str, int]], spec: dict[str, Any], phase: str) -> list[str]:
    want, want_history = expected(spec, phase)
    found = []
    for label in ("scd1", "scd2"):
        for metric, target in want.items():
            if values[label][metric] != target:
                found.append(f"{label}.{metric}={values[label][metric]}, expected {target}")
    if values["scd2"]["history_rows"] != want_history:
        found.append(f"scd2.history_rows={values['scd2']['history_rows']}, expected {want_history}")
    return found
