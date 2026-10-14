"""Pattern A: a BI tool or custom app queries a SQL warehouse through the Databricks SQL Connector for Python.

Power BI, Tableau, and custom apps all reach a warehouse over the same HTTP path and OAuth identity.
This task does it the way a custom app would. In the job it authenticates as the job identity; pass
--client-id and --client-secret (an OAuth M2M service principal) to use the app pattern instead.
"""

from __future__ import annotations

import argparse
import time

from open_data.checks import append_rows, check_row

COLUMNS = ["guide", "pattern", "check", "status", "value", "detail", "recorded_at"]


def http_path(warehouse_id: str) -> str:
    return f"/sql/1.0/warehouses/{warehouse_id}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--warehouse-id", required=True)
    parser.add_argument("--client-id", default="")
    parser.add_argument("--client-secret", default="")
    args = parser.parse_args()

    from importlib.metadata import version

    from databricks import sql
    from databricks.sdk.core import Config, oauth_service_principal
    from databricks.sdk.runtime import spark

    rows: list[dict] = []

    def record(check: str, status: str, value: str, detail: str) -> None:
        rows.append(check_row("external-integrations", check, status, detail, value=value, pattern="sql-connector"))
        print(f"[{status}] {check}: {detail}")

    if args.client_id and args.client_secret:
        cfg = Config(client_id=args.client_id, client_secret=args.client_secret)
        provider = lambda: oauth_service_principal(cfg)  # noqa: E731
        identity = "OAuth M2M service principal"
    else:
        cfg = Config()
        provider = lambda: cfg.authenticate  # noqa: E731
        identity = f"job identity ({cfg.auth_type})"
    host = cfg.host.replace("https://", "").rstrip("/")
    path = http_path(args.warehouse_id)
    record("connection_settings", "INFO", path, f"databricks-sql-connector {version('databricks-sql-connector')}; host {host}; http_path {path}; identity {identity}")

    table = f"{args.catalog}.{args.schema}.orders"
    started = time.time()
    with sql.connect(server_hostname=host, http_path=path, credentials_provider=provider) as connection:
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT region, count(*) AS orders, round(sum(amount), 2) AS revenue FROM {table} GROUP BY region ORDER BY region")
            summary = {r[0]: (int(r[1]), float(r[2])) for r in cursor.fetchall()}
            cursor.execute(f"SELECT count(*) FROM {table} WHERE region = :region", {"region": "West"})
            west = int(cursor.fetchone()[0])
    elapsed = time.time() - started

    expected = {r["region"]: (int(r["orders"]), float(r["revenue"])) for r in spark.sql(f"SELECT region, count(*) AS orders, round(sum(amount), 2) AS revenue FROM {table} GROUP BY region").collect()}
    record("aggregate_matches_spark", "PASS" if summary == expected else "FAIL", str(sum(v[0] for v in summary.values())), f"Warehouse returned {len(summary)} regions, {sum(v[0] for v in summary.values())} orders; matches the Spark result: {summary == expected}")
    record("parameterized_query", "PASS" if west == expected["West"][0] else "FAIL", str(west), f"Named-parameter query (region = :region) returned {west} West orders; expected {expected['West'][0]}")
    record("round_trip", "INFO", f"{elapsed:.1f}s", f"Connect, two statements, and fetch took {elapsed:.1f}s on a serverless SQL warehouse")

    append_rows(spark, f"{args.catalog}.{args.schema}.integration_checks", rows, COLUMNS, replace_where="pattern = 'sql-connector'")
    failed = [r["check"] for r in rows if r["status"] == "FAIL"]
    if failed:
        raise SystemExit(f"Failed checks: {failed}")


if __name__ == "__main__":
    main()
