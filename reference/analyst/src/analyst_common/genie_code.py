"""Pure helpers for the Genie Code guide: table names, the sample spec, reconciliation, asset reports."""

from __future__ import annotations

from decimal import Decimal
from typing import Iterable

PREFIX = "gc_"
SEED = 20261022

# Statuses that count as revenue in the silver table.
REVENUE_STATUSES = ("completed", "shipped")

SAMPLE_TABLES = ("gc_customers", "gc_products", "gc_orders")
SILVER_TABLE = "gc_orders_silver"
GOLD_TABLES = ("gc_sales_by_region_month", "gc_customer_value")

# Interactive assets the prompts ask people to create. The check looks for these name prefixes.
DESIGNER_FLOW_NAME = "gc_orders_flow"
NOTEBOOK_NAME = "gc_orders_analysis"
DASHBOARD_NAME = "gc_sales_dashboard"

SAMPLE_SPEC: dict[str, dict] = {
    "gc_customers": {
        "rows": 2000,
        "columns": [
            {"name": "customer_id", "type": "string", "expr": "concat('C-', lpad(cast(id AS STRING), 5, '0'))"},
            {"name": "region", "type": "string", "values": ["North", "South", "East", "West"], "weights": [3, 2, 3, 2]},
            {"name": "segment", "type": "string", "values": ["Enterprise", "Mid-market", "Small business"], "weights": [1, 3, 6]},
            {"name": "signup_date", "type": "date", "begin": "2024-01-01", "end": "2026-06-30", "interval": "1 day"},
        ],
    },
    "gc_products": {
        "rows": 30,
        "columns": [
            {"name": "product_id", "type": "string", "expr": "concat('P-', lpad(cast(id AS STRING), 3, '0'))"},
            {"name": "category", "type": "string", "values": ["Hardware", "Software", "Services", "Support"], "weights": [3, 3, 2, 2]},
            {"name": "list_price", "type": "decimal(10,2)", "min": 5, "max": 500},
        ],
    },
    "gc_orders": {
        "rows": 60000,
        "columns": [
            {"name": "order_id", "type": "string", "expr": "concat('O-', lpad(cast(id AS STRING), 7, '0'))"},
            {"name": "customer_id", "type": "string", "expr": "concat('C-', lpad(cast(id % 2000 AS STRING), 5, '0'))"},
            {"name": "product_id", "type": "string", "expr": "concat('P-', lpad(cast(id % 30 AS STRING), 3, '0'))"},
            {"name": "order_ts", "type": "timestamp", "begin": "2025-10-01 00:00:00", "end": "2026-09-30 23:59:59", "interval": "1 minute"},
            {"name": "quantity", "type": "int", "min": 1, "max": 10},
            {"name": "unit_price", "type": "decimal(10,2)", "min": 5, "max": 500},
            {"name": "status", "type": "string", "values": ["completed", "shipped", "cancelled", "returned"], "weights": [12, 4, 1, 1]},
        ],
    },
}


def fq(catalog: str, schema: str, table: str) -> str:
    return f"{catalog}.{schema}.{table}"


def expected_tables() -> list[str]:
    """Every table the story needs, in build order."""
    return [*SAMPLE_TABLES, SILVER_TABLE, *GOLD_TABLES]


def has_prefix(name: str, prefix: str = PREFIX) -> bool:
    """True when the asset's file name starts with the prefix, ignoring case and any folder path."""
    base = name.rsplit("/", 1)[-1]
    return base.lower().startswith(prefix.lower())


def filter_assets(names: Iterable[str], prefix: str = PREFIX) -> list[str]:
    return sorted(n for n in names if has_prefix(n, prefix))


def missing_tables(existing: Iterable[str], expected: Iterable[str] | None = None) -> list[str]:
    have = {n.lower() for n in existing}
    return [t for t in (expected if expected is not None else expected_tables()) if t.lower() not in have]


def money_equal(left: object, right: object, tolerance: str = "0.005") -> bool:
    return abs(Decimal(str(left)) - Decimal(str(right))) <= Decimal(tolerance)


def reconcile(sample_total: object, silver_total: object, gold_region_total: object, gold_customer_total: object) -> list[str]:
    """Findings for revenue totals that should match across sample, silver, and both gold tables. Empty means they match."""
    findings = []
    for label, value in (
        ("silver", silver_total),
        ("gold sales by region and month", gold_region_total),
        ("gold customer value", gold_customer_total),
    ):
        if not money_equal(sample_total, value):
            findings.append(f"{label} revenue {value} differs from the sample's {sample_total}")
    return findings


def grain_duplicates(row_count: int, distinct_keys: int) -> int:
    """Rows beyond one per key. A gold table at the stated grain returns 0."""
    return max(int(row_count) - int(distinct_keys), 0)


def howto_for_missing(flow: bool | None, notebook: bool | None, dashboard: bool | None) -> list[str]:
    """What to do for each interactive step that has no asset yet. None means "could not tell" and is not listed here."""
    steps = []
    if flow is False:
        steps.append(f"Step 1: build the Lakeflow Designer flow named {DESIGNER_FLOW_NAME} (prompts.md, Step 1).")
    if notebook is False:
        steps.append(f"Step 2: ask Genie Code to build a notebook named {NOTEBOOK_NAME} (prompts.md, Step 2).")
    if dashboard is False:
        steps.append(f"Step 3: build the dashboard named {DASHBOARD_NAME} on the gold tables (prompts.md, Step 3).")
    return steps


def unverified_steps(flow: bool | None, notebook: bool | None, dashboard: bool | None) -> list[str]:
    """Steps whose asset the listing could not confirm or rule out. Confirm these by hand in the workspace UI."""
    names = {"flow": DESIGNER_FLOW_NAME, "notebook": NOTEBOOK_NAME, "dashboard": DASHBOARD_NAME}
    return [f"Could not confirm {names[k]} from the workspace listing; open the workspace and check it by hand."
            for k, v in (("flow", flow), ("notebook", notebook), ("dashboard", dashboard)) if v is None]
