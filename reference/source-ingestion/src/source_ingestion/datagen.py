"""Deterministic sample entities from the use-case spec, generated with dbldatagen."""

from __future__ import annotations

import re
from typing import Any


def spark_type(type_name: str):
    from pyspark.sql import types as T

    decimal = re.fullmatch(r"decimal\((\d+),\s*(\d+)\)", type_name.strip().lower())
    if decimal:
        return T.DecimalType(int(decimal.group(1)), int(decimal.group(2)))
    simple = {
        "string": T.StringType(),
        "date": T.DateType(),
        "int": T.IntegerType(),
        "bigint": T.LongType(),
        "double": T.DoubleType(),
    }
    return simple[type_name.strip().lower()]


def column_options(column: dict[str, Any]) -> dict[str, Any]:
    """Translate a spec column into dbldatagen withColumn keyword arguments."""
    if "expr" in column:
        return {"expr": column["expr"], "baseColumn": "id"}
    options: dict[str, Any] = {"random": True}
    if "values" in column:
        options["values"] = list(column["values"])
        if "weights" in column:
            options["weights"] = list(column["weights"])
    for spec_key, option in (("min", "minValue"), ("max", "maxValue")):
        if spec_key in column:
            options[option] = column[spec_key]
    for key in ("begin", "end", "interval"):
        if key in column:
            options[key] = column[key]
    return options


def entity_frame(spark, spec: dict[str, Any], entity: str, rows: int | None = None, seed_offset: int = 0):
    """Return the entity as a Spark DataFrame. The same spec and seed give the same rows."""
    import dbldatagen as dg

    definition = spec["entities"][entity]
    generator = dg.DataGenerator(
        spark,
        name=f"{spec['name']}_{entity}",
        rows=int(rows if rows is not None else definition["rows"]),
        partitions=2,
        randomSeedMethod="hash_fieldname",
        randomSeed=int(spec["seed"]) + seed_offset,
    ).withIdOutput()  # keep `id`: expression columns reference it
    for column in definition["columns"]:
        generator = generator.withColumn(column["name"], spark_type(column["type"]), **column_options(column))
    return generator.build().drop("id").orderBy(definition["columns"][0]["name"])
