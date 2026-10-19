"""Deterministic sample entities from the use-case spec, built by the sample-data generator (src/sample_data.py)."""

from __future__ import annotations

from typing import Any

from sample_data import generate


def entity_frame(spark, spec: dict[str, Any], entity: str, rows: int | None = None, seed_offset: int = 0):
    """Return the entity as a Spark DataFrame. The same spec and seed give the same rows."""
    definition = spec["entities"][entity]
    df = generate(
        spark,
        definition["columns"],
        rows=int(rows if rows is not None else definition["rows"]),
        seed=int(spec["seed"]) + seed_offset,
        name=f"{spec['name']}_{entity}",
        partitions=2,
    )
    return df.orderBy(definition["columns"][0]["name"])
