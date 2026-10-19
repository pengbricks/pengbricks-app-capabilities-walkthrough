"""Pure helpers for the file-formats guide: dataset expressions, size and type summaries, plan parsing."""

from __future__ import annotations

import re
import statistics
from typing import Any

# Files a writer leaves next to the data that are not part of the data itself.
_SIDE_FILES = re.compile(r"^(_SUCCESS|_committed_.*|_started_.*|.*\.crc|\.DS_Store)$")

# Nested columns the flat generator does not build. Each expression uses `quantity` and the order id.
NESTED_COLUMNS: list[tuple[str, str]] = [
    (
        "shipping",
        "named_struct("
        "'city', element_at(array('Austin', 'Boston', 'Denver', 'Seattle', 'Miami'), 1 + cast(pmod(xxhash64(order_id, 'city'), 5) AS INT)), "
        "'postal', lpad(cast(pmod(xxhash64(order_id, 'postal'), 99999) AS STRING), 5, '0'), "
        "'express', pmod(xxhash64(order_id, 'express'), 4) = 0)",
    ),
    (
        "items",
        "CASE WHEN pmod(xxhash64(order_id, 'lines'), 3) = 0 "
        "THEN array(named_struct('sku', concat('SKU-', cast(pmod(xxhash64(order_id, 'sku1'), 900) AS STRING)), 'qty', quantity), "
        "named_struct('sku', concat('SKU-', cast(pmod(xxhash64(order_id, 'sku2'), 900) AS STRING)), 'qty', 1)) "
        "ELSE array(named_struct('sku', concat('SKU-', cast(pmod(xxhash64(order_id, 'sku1'), 900) AS STRING)), 'qty', quantity)) END",
    ),
]


def build_orders(spark, spec: dict[str, Any], rows: int, seed: int):
    """Deterministic order rows from the spec's `file_formats` section: the same rows and seed give the same data."""
    from pyspark.sql import functions as F
    from sample_data import generate

    section = spec["file_formats"]
    df = generate(spark, section["columns"], rows, seed, section["table"], partitions=8)
    for name, expression in NESTED_COLUMNS:
        df = df.withColumn(name, F.expr(expression))
    return df


def names(catalog: str, schema: str) -> dict[str, str]:
    """Every object the guide creates. `ff_` avoids the `fmt_` tables the file-ingestion guide owns."""
    prefix = f"{catalog}.{schema}"
    return {
        "prefix": prefix,
        "base": f"/Volumes/{catalog}/{schema}/format_compare",
        "delta": f"{prefix}.ff_orders_delta",
        "iceberg": f"{prefix}.ff_orders_iceberg",
        "uniform": f"{prefix}.ff_orders_uniform",
        "results": f"{prefix}.ff_results",
        "work_delta": f"{prefix}.ff_work_delta",
        "work_iceberg": f"{prefix}.ff_work_iceberg",
    }


def csv_safe(df):
    """CSV cannot hold nested types, so struct and array columns become JSON strings."""
    from pyspark.sql import functions as F

    nested = {f.name for f in df.schema.fields if f.dataType.typeName() in {"struct", "array", "map"}}
    return df.select(*[F.to_json(F.col(c)).alias(c) if c in nested else F.col(c) for c in df.columns])


def summarize_files(entries: list[tuple[str, int]]) -> dict[str, int]:
    """Count data files and their bytes, leaving out commit markers and checksums."""
    data = [(path, size) for path, size in entries if not _SIDE_FILES.match(path.rstrip("/").rsplit("/", 1)[-1])]
    return {"files": len(data), "bytes": sum(size for _, size in data)}


def human_bytes(value: float) -> str:
    size = float(value)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} GB"


def simple_type(type_string: str) -> str:
    """Normalize a Spark `simpleString` type for comparison."""
    return type_string.strip().lower().replace(" ", "")


def type_drift(expected: dict[str, str], inferred: dict[str, str]) -> list[dict[str, Any]]:
    """Compare the types the generator wrote with the types a reader inferred, column by column."""
    out = []
    for column, want in expected.items():
        got = inferred.get(column)
        out.append({"column": column, "written": want, "inferred": got or "(missing)", "drift": got is None or simple_type(got) != simple_type(want)})
    return out


def median_seconds(values: list[float]) -> float:
    return round(statistics.median(values), 3)


def first_error_line(message: str, limit: int = 220) -> str:
    """Shorten a Spark exception to its first informative line."""
    for line in message.splitlines():
        line = line.strip()
        if line and not line.startswith(("JVM stacktrace", "at ", "Traceback", "File ")):
            return line[:limit]
    return message[:limit]


def plan_evidence(plan_text: str) -> dict[str, Any]:
    """Pull the pruning evidence out of EXPLAIN FORMATTED text: columns read and pushed filters."""
    read_schema = re.findall(r"ReadSchema:\s*struct<(.*)>", plan_text)
    pushed = re.findall(r"(?:PushedFilters|RequiredDataFilters):\s*\[(.*)\]", plan_text)
    columns: list[str] = []
    if read_schema:
        depth, current = 0, ""
        for char in read_schema[0]:
            if char in "<(":
                depth += 1
            elif char in ">)":
                depth -= 1
            if char == "," and depth == 0:
                columns.append(current)
                current = ""
            else:
                current += char
        columns.append(current)
    return {
        "columns_read": [c.split(":", 1)[0] for c in columns if c],
        "pushed_filters": pushed[0] if pushed else "",
    }


def pair_scans(scans: list[dict[str, Any]], day_rows: dict[str, int], formats: list[str]) -> dict[tuple[str, str], dict[str, Any]]:
    """Match scan records from the query history to the timed queries.

    The history redacts SQL text for job runs, so each scan is matched on the rows it produced, which
    differ by day, and on its start order, which follows `formats`. The JSON reader reports no scan
    metrics, so a day with exactly one record fewer than `formats` is read as JSON missing.
    """
    paired: dict[tuple[str, str], dict[str, Any]] = {}
    for day, expected in day_rows.items():
        rows = [scan for scan in scans if scan["read_rows"] == expected]
        if len(rows) == len(formats):
            order = formats
        elif len(rows) == len(formats) - 1 and formats[0] == "json":
            order = formats[1:]
        else:
            continue
        paired.update({(fmt, day): scan for fmt, scan in zip(order, rows)})
    return paired


def delta_log_summary(names: list[str]) -> dict[str, Any]:
    """Classify the files of a `_delta_log` folder."""
    commits = sorted(n for n in names if re.fullmatch(r"\d{20}\.json", n))
    checkpoints = sorted(n for n in names if re.fullmatch(r"\d{20}\.checkpoint(\.\d+\.\d+)?\.parquet", n) or n.endswith(".checkpoint.parquet"))
    return {
        "commits": len(commits),
        "checkpoints": len(checkpoints),
        "has_last_checkpoint": "_last_checkpoint" in names,
        "latest_commit": commits[-1] if commits else None,
    }


def result_row(run_id: str, step: str, fmt: str, metric: str, value: Any, detail: str = "") -> dict[str, Any]:
    from open_data.checks import now_iso

    return {"run_id": run_id, "step": step, "format": fmt, "metric": metric, "value": str(value), "detail": detail, "recorded_at": now_iso()}
