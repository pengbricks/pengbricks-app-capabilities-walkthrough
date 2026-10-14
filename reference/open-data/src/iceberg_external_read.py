"""Read the managed Iceberg table from outside Spark through the Unity Catalog Iceberg REST catalog.

PyIceberg gets the catalog URI, a bearer token for the job identity (the OAuth token the
Databricks SDK uses in the job), and asks for vended credentials so it can read the data files.
"""

from __future__ import annotations

import argparse

from open_data.checks import append_rows, check_row
from open_data.spec import load_spec

COLUMNS = ["guide", "check", "status", "value", "detail", "recorded_at"]


def catalog_properties(host: str, catalog: str, irc_path: str, token: str) -> dict[str, str]:
    return {
        "type": "rest",
        "uri": host.rstrip("/") + irc_path,
        "warehouse": catalog,
        "token": token,
        "header.X-Iceberg-Access-Delegation": "vended-credentials",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()

    from databricks.sdk import WorkspaceClient
    from databricks.sdk.runtime import spark
    from pyiceberg.catalog import load_catalog
    from pyiceberg.expressions import EqualTo

    cfg = load_spec(args.use_case_file)["iceberg"]
    rows: list[dict] = []

    def record(check: str, status: str, value: str, detail: str) -> None:
        rows.append(check_row("iceberg-support", check, status, detail, value=value))
        print(f"[{status}] {check}: {detail}")

    w = WorkspaceClient()
    token = w.config.authenticate()["Authorization"].split(" ", 1)[1]
    props = catalog_properties(w.config.host, args.catalog, cfg["irc_path"], token)
    shown = {k: ("***" if k == "token" else v) for k, v in props.items()}
    record("irc_configuration", "INFO", props["uri"], f"PyIceberg properties: {shown}")

    catalog = load_catalog("unity", **props)
    identifier = f"{args.schema}.{cfg['table']}"
    table = catalog.load_table(identifier)
    fields = [f.name for f in table.schema().fields]
    added = cfg["added_column"]["name"]
    record("external_schema", "PASS" if added in fields else "FAIL", str(len(fields)), f"{identifier} through the REST catalog has {len(fields)} columns, including {added}: {added in fields}")

    arrow = table.scan().to_arrow()
    spark_count = spark.table(f"{args.catalog}.{args.schema}.{cfg['table']}").count()
    record("external_read", "PASS" if arrow.num_rows == spark_count else "FAIL", str(arrow.num_rows), f"PyIceberg read {arrow.num_rows} rows; Spark reads {spark_count}")

    west = table.scan(row_filter=EqualTo("region", "West")).to_arrow()
    record("external_filter_pushdown", "PASS" if west.num_rows > 0 else "FAIL", str(west.num_rows), f"Filter region = 'West' in PyIceberg returned {west.num_rows} rows")

    snapshots = table.snapshots()
    record("external_snapshots", "INFO", str(len(snapshots)), f"Iceberg metadata lists {len(snapshots)} snapshot(s); current snapshot {table.current_snapshot().snapshot_id}")

    append_rows(spark, f"{args.catalog}.{args.schema}.iceberg_checks", rows, COLUMNS, replace_where="`check` LIKE 'external_%' OR `check` = 'irc_configuration'")
    failed = [r["check"] for r in rows if r["status"] == "FAIL"]
    if failed:
        raise SystemExit(f"Failed checks: {failed}")


if __name__ == "__main__":
    main()
