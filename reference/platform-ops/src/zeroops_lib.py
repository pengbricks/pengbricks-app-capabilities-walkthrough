"""Pure helpers for the Genie ZeroOps demo: build the revenue SQL from a validated column name."""

from __future__ import annotations

import re

HEALTHY_COLUMN = "amount"
# A plain identifier only. A typo such as "amout" passes, so Spark reports an unresolved column.
# Quotes, spaces, semicolons and comments fail here, so the break never becomes SQL injection.
COLUMN_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$")
ORDER_COLUMNS = ("order_id", "order_date", "customer_id", "amount")


def validate_column(name: str) -> str:
    """Return the column name when it is a plain identifier, else raise ValueError."""
    if not isinstance(name, str) or not COLUMN_PATTERN.fullmatch(name):
        raise ValueError(f"amount_column must be a plain identifier (letters, digits, underscore), got {name!r}")
    return name


def run_mode(amount_column: str) -> str:
    """'healthy' for the real column, 'deliberate break' for any other valid identifier."""
    return "healthy" if validate_column(amount_column) == HEALTHY_COLUMN else "deliberate break"


def orders_sql(table: str, rows: int, seed: int) -> str:
    """CREATE OR REPLACE for zo_orders. Every value derives from the row id and the seed, so reruns match."""
    if rows < 1 or rows > 100_000:
        raise ValueError("rows must be between 1 and 100000")
    return f"""
CREATE OR REPLACE TABLE {table}
COMMENT 'Seeded sample orders for the Genie ZeroOps demo'
AS SELECT
  id + 1 AS order_id,
  date_add(DATE'2026-01-01', CAST(pmod(hash(id, {int(seed)}), 90) AS INT)) AS order_date,
  CAST(1000 + pmod(hash(id, {int(seed)}, 'c'), 200) AS BIGINT) AS customer_id,
  CAST(round(10 + pmod(hash(id, {int(seed)}, 'a'), 49000) / 100.0, 2) AS DECIMAL(10, 2)) AS amount
FROM range({int(rows)})
""".strip()


def daily_revenue_sql(source: str, target: str, amount_column: str) -> str:
    """CREATE OR REPLACE for zo_daily_revenue. The column name is validated before it reaches the SQL text."""
    column = validate_column(amount_column)
    return f"""
CREATE OR REPLACE TABLE {target}
COMMENT 'Daily revenue from zo_orders, built by the Genie ZeroOps demo job'
AS SELECT
  order_date,
  COUNT(*) AS orders,
  CAST(SUM({column}) AS DECIMAL(18, 2)) AS revenue
FROM {source}
GROUP BY order_date
""".strip()
