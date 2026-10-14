"""Read the source -> silver -> gold chain back from system.access lineage tables and record it.

Lineage lands in system tables a few minutes after the writes, so this task polls.
"""

from __future__ import annotations

import argparse
import time

CHAIN = ["obs_source_orders", "obs_silver_orders", "obs_gold_daily_revenue"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--max-wait-minutes", type=int, default=25)
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    prefix = f"{args.catalog}.{args.schema}"
    names = [f"{prefix}.{t}".lower() for t in CHAIN]
    in_list = ", ".join(f"'{n}'" for n in names[1:])
    table_sql = f"""
        SELECT lower(source_table_full_name) AS source_table, lower(target_table_full_name) AS target_table,
               MAX(event_time) AS last_seen, MAX(entity_type) AS written_by
        FROM system.access.table_lineage
        WHERE lower(target_table_full_name) IN ({in_list}) AND source_table_full_name IS NOT NULL
          AND event_date >= current_date() - 1
        GROUP BY 1, 2
    """
    deadline = time.time() + args.max_wait_minutes * 60
    edges = []
    while True:
        edges = [r.asDict() for r in spark.sql(table_sql).collect()]
        found = {(e["source_table"], e["target_table"]) for e in edges}
        if (names[0], names[1]) in found and (names[1], names[2]) in found:
            break
        if time.time() > deadline:
            raise RuntimeError(f"lineage for {names} not visible in system.access.table_lineage after {args.max_wait_minutes} min")
        print("lineage not visible yet; waiting 30 s")
        time.sleep(30)

    # Walk upstream from gold: depth 1 is silver, depth 2 is the source.
    upstream = {e["target_table"]: e["source_table"] for e in edges}
    rows, current, depth = [], names[2], 0
    while current in upstream:
        depth += 1
        edge = next(e for e in edges if e["target_table"] == current)
        rows.append((args.run_id, depth, edge["source_table"], current, edge["last_seen"], edge["written_by"]))
        current = upstream[current]
    spark.createDataFrame(
        rows, "job_run_id STRING, hops_upstream_of_gold INT, source_table STRING, target_table STRING, last_seen TIMESTAMP, written_by STRING"
    ).write.mode("append").saveAsTable(f"{prefix}.obs_lineage_edges")

    # Column lineage for the same targets, when the system table has it.
    column_sql = f"""
        SELECT lower(source_table_full_name) AS source_table, source_column_name,
               lower(target_table_full_name) AS target_table, target_column_name, MAX(event_time) AS last_seen
        FROM system.access.column_lineage
        WHERE lower(target_table_full_name) IN ({in_list}) AND source_table_full_name IS NOT NULL
          AND event_date >= current_date() - 1
        GROUP BY 1, 2, 3, 4
    """
    columns = [r.asDict() for r in spark.sql(column_sql).collect()]
    col_rows = [(args.run_id, c["source_table"], c["source_column_name"], c["target_table"], c["target_column_name"], c["last_seen"]) for c in columns]
    spark.createDataFrame(
        col_rows,
        "job_run_id STRING, source_table STRING, source_column STRING, target_table STRING, target_column STRING, last_seen TIMESTAMP",
    ).write.mode("append").saveAsTable(f"{prefix}.obs_column_lineage")

    print(f"table lineage: {len(rows)} hops walked upstream from {names[2]}")
    for r in rows:
        print(f"  {r[2]} -> {r[3]}")
    print(f"column lineage: {len(col_rows)} column edges")


if __name__ == "__main__":
    main()
