"""Load the use-case spec and build deterministic sample tables from it with dbldatagen."""

from __future__ import annotations

import re
from typing import Any

import yaml


def load_spec(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def spark_type(type_name: str):
    from pyspark.sql import types as T

    decimal = re.fullmatch(r"decimal\((\d+),\s*(\d+)\)", type_name.strip().lower())
    if decimal:
        return T.DecimalType(int(decimal.group(1)), int(decimal.group(2)))
    simple = {
        "string": T.StringType(),
        "timestamp": T.TimestampType(),
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
    for source, target in (("min", "minValue"), ("max", "maxValue"), ("begin", "begin"), ("end", "end"), ("interval", "interval")):
        if source in column:
            options[target] = column[source]
    return options


def build_table(spark, spec: dict[str, Any], table: str, rows: int | None = None, seed_offset: int = 0):
    """Return a DataFrame for one table in the spec. The same spec and seed give the same rows."""
    import dbldatagen as dg

    definition = spec["tables"][table]
    count = rows if rows is not None else int(definition["rows"])
    gen = dg.DataGenerator(spark, name=table, rows=count, partitions=2, randomSeed=int(spec["seed"]) + seed_offset).withIdOutput()
    for column in definition["columns"]:
        gen = gen.withColumn(column["name"], spark_type(column["type"]), **column_options(column))
    return gen.build().drop("id")


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
