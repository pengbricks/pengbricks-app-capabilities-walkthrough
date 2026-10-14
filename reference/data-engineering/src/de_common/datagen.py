"""Deterministic sample data from a use-case spec, built with dbldatagen."""

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
        "timestamp": T.TimestampType(),
        "date": T.DateType(),
        "int": T.IntegerType(),
        "bigint": T.LongType(),
        "double": T.DoubleType(),
        "boolean": T.BooleanType(),
    }
    return simple[type_name.strip().lower()]


def column_options(column: dict[str, Any]) -> dict[str, Any]:
    """Translate a spec column into dbldatagen withColumn keyword arguments."""
    options: dict[str, Any] = {}
    if "expr" in column:
        options["expr"] = column["expr"]
        options["baseColumn"] = "id"
        return options
    options["random"] = True
    if "values" in column:
        options["values"] = list(column["values"])
        if "weights" in column:
            options["weights"] = list(column["weights"])
    if "percent_nulls" in column:
        options["percentNulls"] = float(column["percent_nulls"])
    if "min" in column:
        options["minValue"] = column["min"]
    if "max" in column:
        options["maxValue"] = column["max"]
    for key in ("begin", "end", "interval"):
        if key in column:
            options[key] = column[key]
    return options


def build_frame(spark, name: str, seed: int, rows: int, columns: list[dict[str, Any]]):
    """Build a DataFrame. `id` stays in the output so expression columns can use it."""
    import dbldatagen as dg

    generator = dg.DataGenerator(
        spark,
        name=name,
        rows=rows,
        partitions=4,
        randomSeedMethod="hash_fieldname",
        randomSeed=int(seed),
    ).withIdOutput()
    for column in columns:
        generator = generator.withColumn(column["name"], spark_type(column["type"]), **column_options(column))
    return generator.build()
