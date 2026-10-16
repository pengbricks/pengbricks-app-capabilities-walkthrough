"""Deterministic tables from the use-case spec with dbldatagen."""

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


def build_table(spark, spec: dict[str, Any], name: str, rows: int, columns: list[dict[str, Any]], partitions: int = 8):
    import dbldatagen as dg

    generator = dg.DataGenerator(
        spark,
        name=f"{spec['name']}_{name}",
        rows=rows,
        partitions=partitions,
        randomSeedMethod="hash_fieldname",
        randomSeed=int(spec["seed"]),
    ).withIdOutput()  # expression columns read `id`
    for column in columns:
        generator = generator.withColumn(column["name"], spark_type(column["type"]), **column_options(column))
    df = generator.build()
    return df.select(*[column["name"] for column in columns])


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
