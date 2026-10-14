"""Capacity and cost helpers. Pure functions, unit tested."""

from __future__ import annotations

from typing import Iterable, Sequence


def max_concurrency(intervals: Iterable[tuple[float, float]]) -> int:
    """Peak number of overlapping (start, end) intervals, with times in any common unit."""
    events: list[tuple[float, int]] = []
    for start, end in intervals:
        if end < start:
            continue
        events.append((start, 1))
        events.append((end, -1))
    # Ends sort before starts at the same instant, so back-to-back queries do not overlap.
    events.sort(key=lambda event: (event[0], event[1]))
    current = peak = 0
    for _, delta in events:
        current += delta
        peak = max(peak, current)
    return peak


def percentile(values: Sequence[float], pct: float) -> float:
    """Nearest-rank percentile; 0 for an empty list."""
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = max(1, -(-len(ordered) * pct // 100))
    return float(ordered[int(rank) - 1])


def over_budget(spend: float, threshold: float) -> bool:
    return spend > threshold
