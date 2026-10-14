"""Small helpers that record one row per check in a Unity Catalog table."""

from __future__ import annotations

import datetime as dt
from typing import Any


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def check_row(guide: str, check: str, status: str, detail: str, **extra: Any) -> dict[str, Any]:
    """Build one record. status is PASS, FAIL, INFO, or BLOCKED (a step the workspace does not allow)."""
    if status not in {"PASS", "FAIL", "INFO", "BLOCKED"}:
        raise ValueError(f"status must be PASS, FAIL, INFO, or BLOCKED, got {status}")
    return {"guide": guide, "check": check, "status": status, "detail": detail, "recorded_at": now_iso(), **extra}


def scrub(text: str, secrets: list[str]) -> str:
    """Remove secret values from text before it is stored or printed."""
    for secret in secrets:
        if secret:
            text = text.replace(secret, "***")
    return text


def append_rows(spark, fq_table: str, rows: list[dict[str, Any]], columns: list[str], replace_where: str | None = None) -> None:
    """Write rows to a table, creating it on first use. Missing keys become NULL strings.

    `replace_where` is a SQL predicate. Rows matching it are deleted first, so a rerun replaces its
    earlier rows instead of piling up next to them.
    """
    from pyspark.sql import types as T

    if replace_where and spark.catalog.tableExists(fq_table):
        spark.sql(f"DELETE FROM {fq_table} WHERE {replace_where}")

    schema = T.StructType([T.StructField(name, T.StringType()) for name in columns])
    data = [tuple(None if row.get(name) is None else str(row[name]) for name in columns) for row in rows]
    spark.createDataFrame(data, schema).write.mode("append").option("mergeSchema", "true").saveAsTable(fq_table)
