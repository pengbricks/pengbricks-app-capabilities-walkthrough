"""Pattern B: Lakehouse Federation reads an external Postgres database through a UC connection and foreign catalog.

The "external" database is the Lakebase Postgres project named in the use-case spec. The task
seeds a table over a direct Postgres connection, registers the connection, creates a foreign
catalog (or, when the workspace blocks CREATE CATALOG, uses remote_query on the same connection),
queries it in place including a join with a Unity Catalog table, and removes the connection and any
foreign catalog at the end so no credential is left behind.
"""

from __future__ import annotations

import argparse

from open_data.checks import append_rows, check_row, scrub
from open_data.spec import load_spec

COLUMNS = ["guide", "pattern", "check", "status", "value", "detail", "recorded_at"]


def seed_sql(schema: str, table: str, rows: int) -> list[str]:
    """Postgres statements that create a deterministic table (no random values)."""
    return [
        f"CREATE SCHEMA IF NOT EXISTS {schema}",
        f"DROP TABLE IF EXISTS {schema}.{table}",
        f"CREATE TABLE {schema}.{table} (order_id text PRIMARY KEY, region text, product text, amount numeric(12,2))",
        (
            f"INSERT INTO {schema}.{table} "
            f"SELECT 'EXT-' || lpad(g::text, 6, '0'), (ARRAY['West','East','North','South'])[g % 4 + 1], "
            f"(ARRAY['Standard','Plus','Premium'])[g % 3 + 1], (g * 7 % 500) + 10 "
            f"FROM generate_series(1, {rows}) AS g"
        ),
    ]


def is_missing_privilege(message: str) -> bool:
    return "PERMISSION_DENIED" in message and "CREATE CATALOG" in message


def remote_query_sql(connection: str, database: str, query: str) -> str:
    """A table expression that runs `query` in the external database through a UC connection."""
    escaped = query.replace("'", "\\'")
    return f"remote_query('{connection}', database => '{database}', query => '{escaped}')"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()

    import psycopg
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.runtime import spark
    from databricks.sdk.service.catalog import ConnectionType

    cfg = load_spec(args.use_case_file)["integrations"]["federation"]
    rows: list[dict] = []
    secrets: list[str] = []

    def record(check: str, status: str, value: str, detail: str) -> None:
        detail = scrub(detail, secrets)
        rows.append(check_row("external-integrations", check, status, detail, value=value, pattern="federation"))
        print(f"[{status}] {check}: {detail}")

    w = WorkspaceClient()
    endpoint_name = f"projects/{cfg['lakebase_project']}/branches/{cfg['lakebase_branch']}/endpoints/{cfg['lakebase_endpoint']}"
    host = w.postgres.get_endpoint(name=endpoint_name).status.hosts.host
    user = w.current_user.me().user_name
    token = w.postgres.generate_database_credential(endpoint=endpoint_name).token
    secrets.append(token)

    ext_schema, ext_table = cfg["source_schema"], cfg["source_table"]
    with psycopg.connect(host=host, dbname=cfg["database"], user=user, password=token, sslmode="require", connect_timeout=30) as pg:
        for statement in seed_sql(ext_schema, ext_table, int(cfg["source_rows"])):
            pg.execute(statement)
        pg_count, pg_sum = pg.execute(f"SELECT count(*), sum(amount) FROM {ext_schema}.{ext_table}").fetchone()
    record("seed_external_source", "PASS", str(pg_count), f"Seeded {ext_schema}.{ext_table} in Postgres database {cfg['database']} ({endpoint_name}): {pg_count} rows")

    connection, foreign = cfg["connection_name"], cfg["foreign_catalog"]
    try:
        spark.sql(f"DROP CATALOG IF EXISTS {foreign} CASCADE")
        spark.sql(f"DROP CONNECTION IF EXISTS {connection}")
        w.connections.create(
            name=connection,
            connection_type=ConnectionType.POSTGRESQL,
            options={"host": host, "port": "5432", "user": user, "password": token},
            comment="Lakehouse Federation connection to the Lakebase Postgres project (capability guide)",
        )
        record("connection", "PASS", connection, f"UC connection {connection} (POSTGRESQL, user {user}) created")

        # Foreign catalog when the workspace allows it; otherwise read through the same connection with remote_query.
        try:
            spark.sql(f"CREATE FOREIGN CATALOG {foreign} USING CONNECTION {connection} OPTIONS (database '{cfg['database']}')")
            source = f"{foreign}.{ext_schema}.{ext_table}"
            record("foreign_catalog", "PASS", foreign, f"Foreign catalog {foreign} created on connection {connection}")
        except Exception as error:
            if not is_missing_privilege(str(error)):
                raise
            source = remote_query_sql(connection, cfg["database"], f"SELECT * FROM {ext_schema}.{ext_table}")
            record("foreign_catalog", "BLOCKED", "0", f"{user} lacks CREATE CATALOG on the metastore, so no foreign catalog. A metastore admin can grant it. The reads below use remote_query on the same connection.")

        fed = spark.sql(f"SELECT count(*) AS n, sum(amount) AS total FROM {source}").first()
        ok = fed["n"] == pg_count and float(fed["total"]) == float(pg_sum)
        record("query_external_table", "PASS" if ok else "FAIL", str(fed["n"]), f"Federated query returned {fed['n']} rows, total {fed['total']}; Postgres reports {pg_count} rows, total {pg_sum}")

        joined = spark.sql(
            f"SELECT p.product, count(*) AS orders FROM {source} o JOIN {args.catalog}.{args.schema}.sharing_products p ON o.product = p.product GROUP BY p.product"
        ).collect()
        joined_total = sum(r["orders"] for r in joined)
        record("join_with_uc_table", "PASS" if joined_total == pg_count else "FAIL", str(joined_total), f"Join with {args.catalog}.{args.schema}.products returned {len(joined)} products covering {joined_total} rows")

        remote = remote_query_sql(connection, cfg["database"], f"SELECT region, count(*) AS n FROM {ext_schema}.{ext_table} GROUP BY region")
        by_region = {r["region"]: r["n"] for r in spark.sql(f"SELECT * FROM {remote}").collect()}
        record("aggregate_runs_in_postgres", "PASS" if sum(by_region.values()) == pg_count else "FAIL", str(len(by_region)), f"Postgres aggregated by region and returned {len(by_region)} rows: {dict(sorted(by_region.items()))}")
    finally:
        spark.sql(f"DROP CATALOG IF EXISTS {foreign} CASCADE")
        spark.sql(f"DROP CONNECTION IF EXISTS {connection}")
        record("cleanup", "INFO", "dropped", f"Connection {connection} and any foreign catalog dropped; the OAuth token used as the password expires within an hour")
        append_rows(spark, f"{args.catalog}.{args.schema}.integration_checks", rows, COLUMNS, replace_where="pattern = 'federation'")

    failed = [r["check"] for r in rows if r["status"] == "FAIL"]
    if failed:
        raise SystemExit(f"Failed checks: {failed}")


if __name__ == "__main__":
    main()
