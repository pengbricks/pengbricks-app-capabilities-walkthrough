"""Pure helpers: per-user paths, match classification, delimited files, total checks."""

from __future__ import annotations

import csv
import re
from collections import Counter
from decimal import Decimal
from typing import Iterable


def user_folder(user_name: str) -> str:
    """Folder name for one user: lowercase, non-alphanumerics collapsed to underscores."""
    folder = re.sub(r"[^a-z0-9]+", "_", user_name.lower()).strip("_")
    if not folder:
        raise ValueError("user name is empty")
    return folder


def upload_path(catalog: str, schema: str, volume: str, user_name: str, file_name: str) -> str:
    return f"/Volumes/{catalog}/{schema}/{volume}/{user_folder(user_name)}/{file_name}"


def match_status(in_upload: bool, in_governed: bool) -> str:
    """Classify a key after a full outer join."""
    if in_upload and in_governed:
        return "matched"
    if in_upload:
        return "upload_only"
    if in_governed:
        return "governed_only"
    raise ValueError("key is in neither side")


def match_counts(statuses: Iterable[str]) -> dict[str, int]:
    counts = Counter(statuses)
    return {key: counts.get(key, 0) for key in ("matched", "upload_only", "governed_only")}


def write_delimited(path: str, header: list[str], rows: Iterable[Iterable[object]], delimiter: str = "|") -> int:
    """Write a delimited file with a header row. Fields that contain the delimiter are quoted."""
    count = 0
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
        writer.writerow(header)
        for row in rows:
            writer.writerow(["" if value is None else value for value in row])
            count += 1
    return count


def read_delimited(path: str, delimiter: str = "|") -> list[dict[str, str]]:
    with open(path, newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle, delimiter=delimiter))


def totals_match(left: object, right: object, tolerance: str = "0.005") -> bool:
    """Compare two money totals to within half a cent."""
    return abs(Decimal(str(left)) - Decimal(str(right))) <= Decimal(tolerance)


def running_totals(values: Iterable[object]) -> list[Decimal]:
    """Cumulative sum of values in the order given: the running total a chart plots."""
    total = Decimal("0")
    out = []
    for value in values:
        total += Decimal(str(value))
        out.append(total)
    return out


def trailing_sums(values: Iterable[object], periods: int) -> list[Decimal]:
    """Sum of each value and the periods - 1 before it; the first rows sum what exists so far."""
    if periods < 1:
        raise ValueError("periods must be at least 1")
    items = [Decimal(str(value)) for value in values]
    return [sum(items[max(0, i - periods + 1) : i + 1], Decimal("0")) for i in range(len(items))]
