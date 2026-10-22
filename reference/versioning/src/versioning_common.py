"""Helpers shared by the guide notebooks: spec loading, naming, registry writes, tags."""

from __future__ import annotations

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


def undo_v2(spark, v1_name: str, archive: str, v2_table: str) -> None:
    """Return to the state after v1.1.0, so publishing v2.0.0 can run again.

    On a first run this changes nothing. After a publish, `v1_name` is the compatibility view and the
    physical table sits under `archive`: drop the view, rename the table back, and drop the v2 table.
    """
    try:
        spark.sql(f"DROP VIEW IF EXISTS {v1_name}")
    except Exception:  # v1_name is the physical table, so there is no view to drop
        pass
    if spark.catalog.tableExists(archive):
        spark.sql(f"ALTER TABLE {archive} RENAME TO {v1_name}")
    spark.sql(f"DROP TABLE IF EXISTS {v2_table}")
