"""Helpers shared by the guide notebooks: spec loading, naming, registry writes, tags, sample-data options."""

from __future__ import annotations

import re
from typing import Any


def load_spec(path: str) -> dict[str, Any]:
    import yaml

    with open(path) as handle:
        return yaml.safe_load(handle)


def contracts_for(contracts_dir, spec: dict[str, Any]) -> dict[str, dict[str, Any]]:
    from compatibility import load_contracts

    directory = f"{contracts_dir}/{spec['dataset']['name']}"
    return {c["version"]: c for c in load_contracts(directory)}


def fq(catalog: str, schema: str, name: str) -> str:
    return f"`{catalog}`.`{schema}`.`{name}`"


def drop_any(spark, table: str) -> None:
    """Drop a table or view if it exists, whichever it is."""
    for statement in (f"DROP VIEW IF EXISTS {table}", f"DROP TABLE IF EXISTS {table}"):
        try:
            spark.sql(statement)
        except Exception:  # wrong object type for this statement; try the other
            pass


def delta_version(spark, table: str) -> int:
    from pyspark.sql import functions as F

    return int(spark.sql(f"DESCRIBE HISTORY {table}").agg(F.max("version")).first()[0])


def ensure_registry(spark, catalog: str, schema: str) -> str:
    registry = fq(catalog, schema, "contract_registry")
    spark.sql(
        f"""CREATE TABLE IF NOT EXISTS {registry} (
          dataset STRING, version STRING, change_type STRING, object_name STRING,
          release_tag STRING, applied_at TIMESTAMP, delta_table_version BIGINT)
        COMMENT 'One row per contract version applied: what changed, which release, which Delta version'"""
    )
    return registry


def register(spark, catalog, schema, *, dataset, version, change_type, object_name, release, delta_ver) -> None:
    registry = ensure_registry(spark, catalog, schema)
    spark.sql(f"DELETE FROM {registry} WHERE dataset = '{dataset}' AND version = '{version}' AND object_name = '{object_name}'")
    ver = "NULL" if delta_ver is None else str(int(delta_ver))
    spark.sql(
        f"INSERT INTO {registry} VALUES ('{dataset}', '{version}', '{change_type}', '{object_name}', "
        f"'{release}', current_timestamp(), {ver})"
    )


def set_tags(spark, table: str, tags: dict[str, str], view: bool = False) -> None:
    pairs = ", ".join(f"'{k}' = '{v}'" for k, v in tags.items())
    spark.sql(f"ALTER {'VIEW' if view else 'TABLE'} {table} SET TAGS ({pairs})")


def spark_type(name: str):
    from pyspark.sql import types as T

    decimal = re.fullmatch(r"decimal\((\d+),\s*(\d+)\)", name.strip().lower())
    if decimal:
        return T.DecimalType(int(decimal.group(1)), int(decimal.group(2)))
    return {"string": T.StringType(), "date": T.DateType(), "int": T.IntegerType(),
            "bigint": T.LongType(), "double": T.DoubleType()}[name.strip().lower()]


def column_options(column: dict) -> dict:
    """dbldatagen options for one column of the use-case spec."""
    if "expr" in column:
        return {"expr": column["expr"], "baseColumn": "id"}
    options: dict = {"random": True}
    if "values" in column:
        options["values"] = list(column["values"])
        if "weights" in column:
            options["weights"] = list(column["weights"])
    for key, target in (("min", "minValue"), ("max", "maxValue"), ("begin", "begin"), ("end", "end"), ("interval", "interval")):
        if key in column:
            options[target] = column[key]
    return options
