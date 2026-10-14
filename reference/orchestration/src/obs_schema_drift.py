"""Change a table's schema, then detect the drift from information_schema snapshots and DESCRIBE HISTORY."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

import guide_lib as g

TABLE = "obs_silver_orders"


def snapshot(spark, catalog: str, schema: str, table: str) -> dict[str, tuple[str, int]]:
    rows = spark.sql(
        f"""
        SELECT column_name, data_type, ordinal_position
        FROM {catalog}.information_schema.columns
        WHERE table_schema = '{schema}' AND table_name = '{table}'
        """
    ).collect()
    return {r.column_name: (r.data_type.lower(), int(r.ordinal_position)) for r in rows}


def latest_version(spark, full_name: str) -> int:
    return int(spark.sql(f"DESCRIBE HISTORY {full_name}").agg({"version": "max"}).first()[0])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    prefix = f"{args.catalog}.{args.schema}"
    full = f"{prefix}.{TABLE}"
    changes = g.load_spec(args.use_case_file)["observability"]["schema_changes"]
    add, widen = changes["add_column"], changes["widen_column"]

    before = snapshot(spark, args.catalog, args.schema, TABLE)
    version_before = latest_version(spark, full)

    # The two schema changes: a new column and a widened type.
    spark.sql(f"ALTER TABLE {full} ADD COLUMNS ({add['name']} {add['type']})")
    spark.sql(f"ALTER TABLE {full} SET TBLPROPERTIES ('delta.enableTypeWidening' = 'true')")
    spark.sql(f"ALTER TABLE {full} ALTER COLUMN {widen['name']} TYPE {widen['to_type']}")

    after = snapshot(spark, args.catalog, args.schema, TABLE)
    now = datetime.now(timezone.utc)

    snap_rows = [
        (args.run_id, label, now, TABLE, name, dtype, pos, version)
        for label, snap, version in (("before", before, version_before), ("after", after, latest_version(spark, full)))
        for name, (dtype, pos) in snap.items()
    ]
    spark.createDataFrame(
        snap_rows,
        "job_run_id STRING, snapshot STRING, captured_at TIMESTAMP, table_name STRING, column_name STRING, "
        "data_type STRING, ordinal_position INT, delta_version BIGINT",
    ).write.mode("append").saveAsTable(f"{prefix}.obs_schema_snapshots")

    history = [
        r.asDict() for r in spark.sql(f"DESCRIBE HISTORY {full}").select("version", "timestamp", "operation", "operationParameters").collect()
    ]
    relevant = g.schema_changing_history(history, after_version=version_before)

    events = []
    for event in g.diff_schemas({k: v[0] for k, v in before.items()}, {k: v[0] for k, v in after.items()}):
        match = next((h for h in relevant if event["column_name"] in str(h["operationParameters"])), None)
        events.append(
            (
                args.run_id, TABLE, event["change_type"], event["column_name"], event["old_type"], event["new_type"],
                match["version"] if match else None, match["operation"] if match else None, now,
            )
        )
    spark.createDataFrame(
        events,
        "job_run_id STRING, table_name STRING, change_type STRING, column_name STRING, old_type STRING, new_type STRING, "
        "history_version BIGINT, history_operation STRING, detected_at TIMESTAMP",
    ).write.mode("append").saveAsTable(f"{prefix}.obs_schema_drift_events")

    spark.createDataFrame(
        [(args.run_id, int(h["version"]), h["timestamp"], h["operation"], str(h["operationParameters"])) for h in relevant],
        "job_run_id STRING, version BIGINT, timestamp TIMESTAMP, operation STRING, operation_parameters STRING",
    ).write.mode("append").saveAsTable(f"{prefix}.obs_schema_history")

    print(f"schema drift on {TABLE}: {len(events)} event(s)")
    for e in events:
        print(f"  {e[2]:14} {e[3]:14} {e[4]} -> {e[5]}  (history version {e[6]}, {e[7]})")
    if len(events) < 2:
        raise RuntimeError("expected an added column and a type change to be detected")


if __name__ == "__main__":
    main()
