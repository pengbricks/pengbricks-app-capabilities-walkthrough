"""Helpers shared by the job tasks: argument parsing, naming, registry writes, tags."""

from __future__ import annotations

import argparse
import sys
from typing import Any


def parse_args(extra: list[str] | None = None, need_uc: bool = True) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    if need_uc:
        parser.add_argument("--catalog", required=True)
        parser.add_argument("--schema", required=True)
    parser.add_argument("--src-dir", required=True)
    parser.add_argument("--contracts-dir", required=True)
    parser.add_argument("--use-case-file", required=True)
    for name in extra or []:
        parser.add_argument(f"--{name}", required=True)
    args = parser.parse_args()
    if args.src_dir not in sys.path:
        sys.path.insert(0, args.src_dir)
    return args


def load_spec(path: str) -> dict[str, Any]:
    import yaml

    with open(path) as handle:
        return yaml.safe_load(handle)


def contracts_for(args: argparse.Namespace, spec: dict[str, Any]) -> dict[str, dict[str, Any]]:
    from compatibility import load_contracts

    directory = f"{args.contracts_dir}/{spec['dataset']['name']}"
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
