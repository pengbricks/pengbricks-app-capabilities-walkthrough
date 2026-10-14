"""Helpers shared by the governance tasks."""

from __future__ import annotations

import argparse

from governance_lib.sqlgen import qualified


def base_args(*extra: str) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--step", required=True)
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", default="")
    for name in extra:
        parser.add_argument(f"--{name}", default="")
    return parser.parse_args()


def write_rows(spark, catalog: str, schema: str, table: str, rows: list[dict], ddl: str) -> str:
    """Overwrite a small result table from Python rows."""
    name = qualified(catalog, schema, table)
    spark.createDataFrame(rows, schema=ddl).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(name)
    print(f"wrote {len(rows)} rows to {name}")
    return name


def workspace_id() -> int:
    from databricks.sdk import WorkspaceClient

    return int(WorkspaceClient().get_workspace_id())


def run_sql_rows(spark, statement: str) -> list[dict]:
    return [row.asDict(recursive=True) for row in spark.sql(statement).collect()]
