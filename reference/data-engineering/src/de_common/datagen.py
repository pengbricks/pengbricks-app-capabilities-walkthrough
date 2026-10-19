"""Deterministic sample data from a use-case spec, built with the sample-data generator (src/sample_data.py)."""

from __future__ import annotations

from typing import Any

from sample_data import generate, spark_type  # noqa: F401  (spark_type is re-exported for callers)


def null_fraction(column: dict[str, Any]) -> float:
    """Share of rows to blank out for a spec column. The shared generator has no null option, so it is applied here."""
    fraction = float(column.get("percent_nulls", 0))
    if not 0 <= fraction < 1:
        raise ValueError(f"percent_nulls must be in [0, 1): {fraction}")
    return fraction


def build_frame(spark, name: str, seed: int, rows: int, columns: list[dict[str, Any]]):
    """Build a DataFrame. `id` stays in the output so expression columns can use it."""
    from pyspark.sql import functions as F

    df = generate(spark, columns, rows=rows, seed=int(seed), name=name, partitions=4, keep_id=True)
    for column in columns:
        fraction = null_fraction(column)
        if fraction:
            # A fixed draw per seed, table, column and id, so the nulls are the same on every run.
            draw = F.pmod(F.xxhash64(F.lit(int(seed)), F.lit(name), F.lit(column["name"] + "_null"), F.col("id")), F.lit(10_000)) / F.lit(10_000.0)
            df = df.withColumn(column["name"], F.when(draw < F.lit(fraction), F.lit(None)).otherwise(F.col(column["name"])))
    return df
