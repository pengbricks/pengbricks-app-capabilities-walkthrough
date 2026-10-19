"""Deterministic sample data from a use-case spec.

The sample-data generator (`src/sample_data.py`) builds the canonical entity; each feed then
projects it into the provider's own file shape through the spec's `source_columns`. The same
spec and seed always produce the same rows, so reruns are idempotent and comparable.
"""

from __future__ import annotations

from typing import Any

from sample_data import generate


def bad_row_exprs(spec: dict[str, Any]) -> list[tuple[str, str]]:
    return [
        (rule["column"], f"CASE WHEN id % {rule['every']} = {rule['offset']} THEN {rule['expr']} ELSE {rule['column']} END")
        for rule in spec.get("bad_rows", [])
    ]


def canonical(spark, spec: dict[str, Any], rows: int, seed_offset: int = 0, id_offset: int = 0):
    # A fixed seed per spec (plus an offset per feed) makes every run produce the same rows.
    # Streaming batches shift ids so each batch has new keys. `id` stays: bad-row rules use it.
    return generate(
        spark,
        spec["entity"]["columns"],
        rows=rows,
        seed=int(spec["seed"]) + seed_offset,
        name=f"{spec['name']}_{spec['entity']['name']}",
        partitions=4,
        id_offset=id_offset,
        keep_id=True,
    )


def feed_frame(spark, spec: dict[str, Any], feed: dict[str, Any], seed_offset: int):
    from pyspark.sql import functions as F

    df = canonical(spark, spec, int(feed["rows"]), seed_offset=seed_offset)
    for column, expression in bad_row_exprs(spec):
        df = df.withColumn(column, F.expr(expression))
    return df.selectExpr(*[f"{expression} AS `{name}`" for name, expression in feed["source_columns"].items()])
