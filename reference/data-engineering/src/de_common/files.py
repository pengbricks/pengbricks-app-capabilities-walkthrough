"""Helpers for the file outputs."""

from __future__ import annotations

from typing import Any, Iterable, Sequence

MIN_WIDTH = 8
MAX_WIDTH = 50
PADDING = 2


def column_widths(headers: Sequence[str], rows: Iterable[Sequence[Any]]) -> list[int]:
    """Character width per column: the longest value or header, padded and clamped."""
    widths = [len(str(header)) for header in headers]
    for row in rows:
        for index, value in enumerate(row):
            widths[index] = max(widths[index], len("" if value is None else str(value)))
    return [min(MAX_WIDTH, max(MIN_WIDTH, width + PADDING)) for width in widths]


def merge_metrics(operation_metrics: dict[str, str]) -> dict[str, int]:
    """Pick the MERGE counts out of a Delta history operationMetrics map."""
    keys = {
        "source_rows": "numSourceRows",
        "inserted": "numTargetRowsInserted",
        "updated": "numTargetRowsUpdated",
        "deleted": "numTargetRowsDeleted",
        "copied": "numTargetRowsCopied",
        "output_rows": "numOutputRows",
    }
    return {name: int(operation_metrics.get(key, 0)) for name, key in keys.items()}
