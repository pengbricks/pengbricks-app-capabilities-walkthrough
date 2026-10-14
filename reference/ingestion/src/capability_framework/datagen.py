"""Deterministic sample data from a use-case spec.

dbldatagen builds the canonical entity; each feed then projects it into the provider's
own file shape through the spec's `source_columns`. The same spec and seed always
produce the same rows, so reruns are idempotent and comparable.
"""

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
    if "min" in column:
        options["minValue"] = column["min"]
    if "max" in column:
        options["maxValue"] = column["max"]
    for key in ("begin", "end", "interval"):
        if key in column:
            options[key] = column[key]
    return options


def bad_row_exprs(spec: dict[str, Any]) -> list[tuple[str, str]]:
    return [
        (rule["column"], f"CASE WHEN id % {rule['every']} = {rule['offset']} THEN {rule['expr']} ELSE {rule['column']} END")
        for rule in spec.get("bad_rows", [])
    ]


def canonical(spark, spec: dict[str, Any], rows: int, seed_offset: int = 0, id_offset: int = 0):
    import dbldatagen as dg
    from pyspark.sql import functions as F

    # A fixed seed per spec (plus an offset per feed) makes every run produce the same rows.
    generator = dg.DataGenerator(
        spark,
        name=f"{spec['name']}_{spec['entity']['name']}",
        rows=rows,
        partitions=4,
        randomSeedMethod="hash_fieldname",
        randomSeed=int(spec["seed"]) + seed_offset,
    ).withIdOutput()  # keep `id`: expression columns and bad-row rules use it
    # Each spec column becomes one dbldatagen column definition.
    for column in spec["entity"]["columns"]:
        generator = generator.withColumn(column["name"], spark_type(column["type"]), **column_options(column))
    df = generator.build()
    # Streaming batches shift ids so each batch has new keys.
    if id_offset:
        df = df.withColumn("id", F.col("id") + F.lit(id_offset))
        for column in spec["entity"]["columns"]:
            if "expr" in column:
                df = df.withColumn(column["name"], F.expr(column["expr"]))
    return df


def feed_frame(spark, spec: dict[str, Any], feed: dict[str, Any], seed_offset: int):
    from pyspark.sql import functions as F

    df = canonical(spark, spec, int(feed["rows"]), seed_offset=seed_offset)
    for column, expression in bad_row_exprs(spec):
        df = df.withColumn(column, F.expr(expression))
    return df.selectExpr(*[f"{expression} AS `{name}`" for name, expression in feed["source_columns"].items()])
