"""Shared helpers for the orchestration and observability jobs.

Pure functions (spec loading, drift math, schema diffs, pause planning) have unit tests.
Functions that take a `spark` session build data with dbldatagen.
"""

from __future__ import annotations

import copy
import math
from typing import Any, Iterable


# --- spec and data generation -------------------------------------------------------------


def load_spec(path: str) -> dict[str, Any]:
    import yaml

    with open(path, encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def apply_overrides(columns: list[dict[str, Any]], overrides: dict[str, dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Return a copy of the spec columns with per-batch overrides merged in."""
    merged = copy.deepcopy(columns)
    for column in merged:
        column.update((overrides or {}).get(column["name"], {}))
    return merged


def spark_type(type_name: str):
    from pyspark.sql import types as T

    return {
        "string": T.StringType(),
        "timestamp": T.TimestampType(),
        "int": T.IntegerType(),
        "bigint": T.LongType(),
        "double": T.DoubleType(),
    }[type_name.strip().lower()]


def column_options(column: dict[str, Any]) -> dict[str, Any]:
    if "expr" in column:
        return {"expr": column["expr"], "baseColumn": "id"}
    options: dict[str, Any] = {"random": True}
    if "values" in column:
        options["values"] = list(column["values"])
        if "weights" in column:
            options["weights"] = list(column["weights"])
    for key, target in (("min", "minValue"), ("max", "maxValue"), ("begin", "begin"), ("end", "end"), ("interval", "interval")):
        if key in column:
            options[target] = column[key]
    return options


def build_orders(spark, spec: dict[str, Any], rows: int, seed_offset: int = 0, overrides: dict | None = None,
                 with_bad_rows: bool = False):
    """Deterministic orders DataFrame. The same spec, rows, and offset always give the same rows."""
    import dbldatagen as dg
    from pyspark.sql import functions as F

    generator = dg.DataGenerator(
        spark,
        name=f"{spec['name']}_{spec['entity']['name']}_{seed_offset}",
        rows=rows,
        partitions=4,
        randomSeedMethod="hash_fieldname",
        randomSeed=int(spec["seed"]) + seed_offset,
    ).withIdOutput()
    for column in apply_overrides(spec["entity"]["columns"], overrides):
        generator = generator.withColumn(column["name"], spark_type(column["type"]), **column_options(column))
    df = generator.build()
    if with_bad_rows:
        for rule in spec.get("bad_rows", []):
            df = df.withColumn(
                rule["column"],
                F.expr(f"CASE WHEN id % {rule['every']} = {rule['offset']} THEN {rule['expr']} ELSE {rule['column']} END"),
            )
    return df


# --- data drift ----------------------------------------------------------------------------


def psi(expected: Iterable[float], actual: Iterable[float], floor: float = 1e-4) -> float:
    """Population stability index between two histograms (counts or proportions, same bins)."""
    e, a = list(expected), list(actual)
    if len(e) != len(a) or not e:
        raise ValueError("histograms must have the same, non-zero number of bins")
    e_total, a_total = float(sum(e)), float(sum(a))
    if e_total <= 0 or a_total <= 0:
        raise ValueError("histograms must have a positive total")
    value = 0.0
    for e_count, a_count in zip(e, a):
        e_pct = max(e_count / e_total, floor)
        a_pct = max(a_count / a_total, floor)
        value += (a_pct - e_pct) * math.log(a_pct / e_pct)
    return value


def histogram(values: Iterable[float], edges: list[float]) -> list[int]:
    """Count values into bins; the first and last bins are open-ended."""
    counts = [0] * (len(edges) + 1)
    for value in values:
        counts[sum(1 for edge in edges if value >= edge)] += 1
    return counts


def quantile_edges(sorted_values: list[float], bins: int) -> list[float]:
    """Interior bin edges taken from the baseline's quantiles."""
    if bins < 2 or not sorted_values:
        raise ValueError("need at least two bins and one value")
    n = len(sorted_values)
    return [sorted_values[min(n - 1, (n * i) // bins)] for i in range(1, bins)]


def mean_shift_pct(baseline_mean: float, current_mean: float) -> float:
    if baseline_mean == 0:
        raise ValueError("baseline mean is zero")
    return (current_mean - baseline_mean) / abs(baseline_mean) * 100.0


def psi_label(value: float, threshold: float = 0.2) -> str:
    """Common reading: below 0.1 stable, below the threshold moderate, above it significant."""
    if value < 0.1:
        return "stable"
    return "moderate" if value < threshold else "significant"


# --- schema drift --------------------------------------------------------------------------


def diff_schemas(before: dict[str, str], after: dict[str, str]) -> list[dict[str, str | None]]:
    """Compare {column: data_type} snapshots and list column-level drift events."""
    events: list[dict[str, str | None]] = []
    for name in sorted(after.keys() - before.keys()):
        events.append({"change_type": "COLUMN_ADDED", "column_name": name, "old_type": None, "new_type": after[name]})
    for name in sorted(before.keys() - after.keys()):
        events.append({"change_type": "COLUMN_DROPPED", "column_name": name, "old_type": before[name], "new_type": None})
    for name in sorted(before.keys() & after.keys()):
        if before[name] != after[name]:
            events.append(
                {"change_type": "TYPE_CHANGED", "column_name": name, "old_type": before[name], "new_type": after[name]}
            )
    return events


def schema_changing_history(rows: Iterable[dict[str, Any]], after_version: int) -> list[dict[str, Any]]:
    """Keep DESCRIBE HISTORY rows after `after_version` whose operation changed the schema."""
    schema_ops = {"ADD COLUMNS", "CHANGE COLUMN", "REPLACE COLUMNS", "DROP COLUMNS", "TYPE WIDENING", "SET TBLPROPERTIES"}
    kept = []
    for row in rows:
        operation = str(row.get("operation", "")).upper()
        if int(row["version"]) > after_version and operation in schema_ops:
            kept.append(row)
    return sorted(kept, key=lambda r: int(r["version"]))


# --- bulk pause ----------------------------------------------------------------------------


def plan_pause_change(jobs: Iterable[dict[str, Any]], target: str) -> list[dict[str, Any]]:
    """Jobs whose schedule is not already in the target state (`PAUSED` or `UNPAUSED`)."""
    return [job for job in jobs if job.get("schedule_status") and job["schedule_status"] != target]


def count_states(jobs: Iterable[dict[str, Any]]) -> dict[str, int]:
    counts = {"PAUSED": 0, "UNPAUSED": 0}
    for job in jobs:
        status = job.get("schedule_status")
        if status in counts:
            counts[status] += 1
    return counts
