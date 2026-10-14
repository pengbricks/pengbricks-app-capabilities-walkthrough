"""Prove the Databricks SQL connector path: OAuth through the job identity (or M2M when env vars are set)."""

from __future__ import annotations

import argparse
import os
import time


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--warehouse-id", required=True)
    parser.add_argument("--run-id", default="manual")
    args = parser.parse_args()

    from databricks import sql
    from databricks.sdk.core import Config
    from databricks.sdk.runtime import spark

    # With DATABRICKS_CLIENT_ID and DATABRICKS_CLIENT_SECRET set, Config() performs OAuth M2M.
    # In a job it falls back to the job identity's runtime credentials.
    cfg = Config()
    auth_mode = "oauth-m2m" if os.environ.get("DATABRICKS_CLIENT_ID") else "job-identity"
    host = cfg.host.replace("https://", "").rstrip("/")
    http_path = f"/sql/1.0/warehouses/{args.warehouse_id}"

    start = time.perf_counter()
    with sql.connect(server_hostname=host, http_path=http_path, credentials_provider=lambda: cfg.authenticate) as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT current_user() AS who, current_catalog() AS cat")
            who, _ = cursor.fetchone()
            cursor.execute(
                f"SELECT region, COUNT(*) AS customers FROM {args.catalog}.{args.schema}.customers GROUP BY region ORDER BY region"
            )
            rows = cursor.fetchall()
    seconds = round(time.perf_counter() - start, 2)
    total = sum(int(r[1]) for r in rows)
    print(f"Connected as {who} using {auth_mode}; {len(rows)} regions, {total} customers in {seconds}s")

    spark.createDataFrame(
        [(auth_mode, who, f"{args.catalog}.{args.schema}.customers", total, len(rows), seconds, args.run_id)],
        "auth_mode STRING, connected_as STRING, table_name STRING, rows_counted BIGINT, groups_returned INT, seconds DOUBLE, run_id STRING",
    ).write.mode("append").saveAsTable(f"{args.catalog}.{args.schema}.connectivity_check")
    if total == 0:
        raise RuntimeError("The connector returned no rows")


if __name__ == "__main__":
    main()
