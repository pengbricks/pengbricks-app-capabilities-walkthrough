"""Deterministic tables from the use-case spec, built by the sample-data generator (src/sample_data.py)."""

from __future__ import annotations

from typing import Any

from sample_data import generate


def build_table(spark, spec: dict[str, Any], name: str, rows: int, columns: list[dict[str, Any]], partitions: int = 8):
    """One table from its spec columns. The same spec and seed give the same rows."""
    return generate(spark, columns, rows=rows, seed=int(spec["seed"]), name=f"{spec['name']}_{name}", partitions=partitions)


def generate_tables(spark, spec: dict[str, Any], tables: list[str], catalog: str, schema: str) -> list[str]:
    """Build each named table from the spec and overwrite it in Unity Catalog, so reruns replace the data."""
    written = []
    for name in tables:
        table = spec["tables"][name]
        df = build_table(spark, spec, name, int(table["rows"]), table["columns"])
        target = f"{catalog}.{schema}.{name}"
        df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(target)
        print(f"Wrote {spark.table(target).count()} rows to {target}")
        written.append(target)
    return written
