"""Load the use-case spec and build deterministic sample tables from it (src/sample_data.py)."""

from __future__ import annotations

from typing import Any

import yaml


def load_spec(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def build_table(spark, spec: dict[str, Any], table: str, rows: int | None = None, seed_offset: int = 0):
    """Return a DataFrame for one table in the spec. The same spec and seed give the same rows."""
    from sample_data import generate

    definition = spec["tables"][table]
    count = rows if rows is not None else int(definition["rows"])
    return generate(spark, definition["columns"], count, int(spec["seed"]) + seed_offset, table, partitions=2)


def column_comment_sql(fq_table: str, column: dict[str, Any]) -> str:
    comment = str(column["comment"]).replace("'", "''")
    return f"COMMENT ON COLUMN {fq_table}.{column['name']} IS '{comment}'"


def write_tables(spark, spec: dict[str, Any], prefix: str, names: list[str]) -> None:
    """Write the named spec tables under `prefix` (catalog.schema), with table and column comments."""
    for table in names:
        definition = spec["tables"][table]
        fq = f"{prefix}.{table}"
        build_table(spark, spec, table).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(fq)
        comment = definition["comment"].replace("'", "''")
        spark.sql(f"COMMENT ON TABLE {fq} IS '{comment}'")
        for column in definition["columns"]:
            spark.sql(column_comment_sql(fq, column))
        print(f"{fq}: {spark.table(fq).count()} rows, {len(definition['columns'])} column comments")
