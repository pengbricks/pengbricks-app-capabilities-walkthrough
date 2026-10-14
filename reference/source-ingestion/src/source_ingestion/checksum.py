"""Row checksums that Postgres and Spark compute identically.

Both sides hash a canonical string per row (columns joined with '|', decimals at two places,
dates as yyyy-MM-dd) with md5, take the first 8 hex digits as a number, and sum them. If the
two sums and the row counts match, the landed rows match the source rows.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Column:
    name: str
    kind: str  # text | int | decimal | date


def _pg_expr(column: Column) -> str:
    if column.kind == "decimal":
        return f"to_char({column.name}, 'FM9999999990.00')"
    if column.kind == "date":
        return f"to_char({column.name}, 'YYYY-MM-DD')"
    return f"{column.name}::text"


def _spark_expr(column: Column) -> str:
    if column.kind == "decimal":
        return f"CAST(CAST({column.name} AS DECIMAL(12,2)) AS STRING)"
    if column.kind == "date":
        return f"date_format({column.name}, 'yyyy-MM-dd')"
    return f"CAST({column.name} AS STRING)"


def postgres_checksum_sql(columns: list[Column], source_sql: str) -> str:
    row = " || '|' || ".join(f"coalesce({_pg_expr(c)}, '')" for c in columns)
    return (
        "SELECT count(*) AS row_count, "
        f"coalesce(sum(('x' || substr(md5({row}), 1, 8))::bit(32)::bigint), 0) AS checksum "
        f"FROM ({source_sql}) AS q"
    )


def spark_checksum_sql(columns: list[Column], table: str) -> str:
    row = ", '|', ".join(f"coalesce({_spark_expr(c)}, '')" for c in columns)
    return (
        "SELECT count(*) AS row_count, "
        f"coalesce(sum(CAST(conv(substr(md5(concat({row})), 1, 8), 16, 10) AS BIGINT)), 0) AS checksum "
        f"FROM {table}"
    )
