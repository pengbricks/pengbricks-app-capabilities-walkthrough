"""Load the use-case spec and plan the change batch."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml


def load_use_case(path: str | Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def plan_changes(rows: int, inserts: int, updates: int, deletes: int) -> dict[str, Any]:
    """Pick which row ids each change touches.

    Ids 0..rows-1 are the initial snapshot. Updates and deletes spread across it on a
    stride so they never overlap: updates hit ids that are 0 mod stride, deletes hit
    ids that are 1 mod stride. Inserts take the next `inserts` ids after the snapshot.
    """
    if min(rows, inserts, updates, deletes) < 0:
        raise ValueError("counts must be non-negative")
    stride = max(2, rows // max(updates, deletes, 1))
    update_ids = [index * stride for index in range(updates)]
    delete_ids = [index * stride + 1 for index in range(deletes)]
    if any(i >= rows for i in update_ids + delete_ids):
        raise ValueError("rows is too small for the requested updates and deletes")
    return {
        "stride": stride,
        "update_ids": update_ids,
        "delete_ids": delete_ids,
        "insert_ids": list(range(rows, rows + inserts)),
        "final_rows": rows + inserts - deletes,
    }
