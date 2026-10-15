"""Deterministic sample tables from the spec, generated with dbldatagen."""

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
    if "expr" in column:
        return {"expr": column["expr"], "baseColumn": "id"}
    options: dict[str, Any] = {"random": True}
    if "values" in column:
        options["values"] = list(column["values"])
        if "weights" in column:
            options["weights"] = list(column["weights"])
    for source, target in (("min", "minValue"), ("max", "maxValue")):
        if source in column:
            options[target] = column[source]
    for key in ("begin", "end", "interval"):
        if key in column:
            options[key] = column[key]
    return options


def table_frame(spark, spec: dict[str, Any], table: str, rows: int | None = None, seed_offset: int = 0):
    import dbldatagen as dg

    definition = spec["tables"][table]
    generator = dg.DataGenerator(
        spark,
        name=f"{spec['name']}_{table}",
        rows=int(rows or definition["rows"]),
        partitions=4,
        randomSeedMethod="hash_fieldname",
        randomSeed=int(spec["seed"]) + seed_offset,
    ).withIdOutput()
    for column in definition["columns"]:
        generator = generator.withColumn(column["name"], spark_type(column["type"]), **column_options(column))
    return generator.build().drop("id")


def write_table(spark, spec: dict[str, Any], catalog: str, schema: str, table: str, rows: int | None = None,
                target: str | None = None) -> int:
    """Write the spec table `table` to `target` (defaults to the same name)."""
    df = table_frame(spark, spec, table, rows)
    df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"`{catalog}`.`{schema}`.`{target or table}`")
    return df.count()
