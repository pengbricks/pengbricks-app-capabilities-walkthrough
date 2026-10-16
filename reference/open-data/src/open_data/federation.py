"""Pure helpers for the Lakehouse Federation step."""

from __future__ import annotations


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
