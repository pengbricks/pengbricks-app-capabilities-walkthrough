"""Helpers for the metric views guide: deterministic sample data, name quoting, and the results table.

Everything here is plain Python, so the tests need no Spark. All data is synthetic.
"""

from __future__ import annotations

import datetime as dt
import random

TABLES = {
    "customers": "mv_customers",
    "products": "mv_products",
    "orders": "mv_orders",
    "sessions": "mv_sessions",
    "results": "mv_results",
}
VIEWS = {"orders": "mv_orders_metrics", "funnel": "mv_funnel_metrics"}

SEGMENTS = ["Enterprise", "Mid-Market", "Small Business", "Consumer"]
REGIONS = ["North America", "EMEA", "APAC", "LATAM"]
CATEGORIES = ["Hardware", "Software", "Services", "Accessories"]
ORDER_CHANNELS = ["Web", "Partner", "Sales"]
SESSION_CHANNELS = ["Web", "Mobile", "Partner"]
STATUSES = ["completed", "cancelled", "returned"]

START = dt.date(2025, 1, 1)
END = dt.date(2026, 9, 30)

N_CUSTOMERS = 240
N_PRODUCTS = 24
N_ORDERS = 4000


def _days() -> int:
    return (END - START).days + 1


def make_customers(seed: int = 7) -> list[tuple]:
    rng = random.Random(seed)
    rows = []
    for i in range(1, N_CUSTOMERS + 1):
        signup = START - dt.timedelta(days=rng.randint(1, 400))
        rows.append((f"C{i:04d}", f"Customer {i:04d}", rng.choices(SEGMENTS, [15, 25, 35, 25])[0], rng.choice(REGIONS), signup))
    return rows


def make_products(seed: int = 11) -> list[tuple]:
    rng = random.Random(seed)
    rows = []
    for i in range(1, N_PRODUCTS + 1):
        category = CATEGORIES[(i - 1) % len(CATEGORIES)]
        base = {"Hardware": 480, "Software": 120, "Services": 900, "Accessories": 35}[category]
        rows.append((f"P{i:03d}", f"{category} item {i:03d}", category, round(base * rng.uniform(0.6, 1.6), 2)))
    return rows


def make_orders(customers: list[tuple], products: list[tuple], seed: int = 21) -> list[tuple]:
    """One row per order: a customer buys one product. Cancelled and returned orders are kept so the metric view filter has work to do."""
    rng = random.Random(seed)
    price = {p[0]: p[3] for p in products}
    rows = []
    for i in range(1, N_ORDERS + 1):
        customer = rng.choice(customers)[0]
        product = rng.choice(products)[0]
        day = START + dt.timedelta(days=int(rng.triangular(0, _days() - 1, _days() - 1)))
        rows.append(
            (
                f"O{i:05d}",
                customer,
                product,
                day,
                rng.randint(1, 5),
                round(price[product] * rng.uniform(0.9, 1.1), 2),
                rng.choices([0.0, 0.05, 0.10, 0.15], [55, 20, 15, 10])[0],
                rng.choices(STATUSES, [86, 8, 6])[0],
                rng.choices(ORDER_CHANNELS, [55, 15, 30])[0],
            )
        )
    return rows


def make_sessions(customers: list[tuple], seed: int = 31) -> list[tuple]:
    """Sessions per day vary a lot, so the average of daily conversion rates differs from the conversion rate of all sessions."""
    rng = random.Random(seed)
    rows = []
    n = 0
    for offset in range(_days()):
        day = START + dt.timedelta(days=offset)
        volume = rng.choice([1, 2, 2, 10, 14, 17]) if day.weekday() < 5 else rng.choice([0, 1, 1, 2])
        for _ in range(volume):
            n += 1
            channel = rng.choices(SESSION_CHANNELS, [50, 35, 15])[0]
            rate = {"Web": 0.07, "Mobile": 0.04, "Partner": 0.16}[channel]
            if volume <= 2:
                rate *= 2.5  # quiet days convert better, which pulls the daily-average up
            rows.append((f"S{n:06d}", rng.choice(customers)[0], day, channel, rng.random() < rate))
    return rows


def fq(catalog: str, schema: str, name: str) -> str:
    return f"`{catalog}`.`{schema}`.`{name}`"


def require_views(spark, catalog: str, schema: str) -> None:
    """Stop with a plain message, before anything changes, when the sample tables or metric views are missing."""
    exists = lambda name: spark.catalog.tableExists(f"`{catalog}`.`{schema}`.`{name}`")  # noqa: E731
    problems = [f"{name} is missing (run 01_generate_data)" for name in (TABLES["customers"], TABLES["products"], TABLES["orders"], TABLES["sessions"]) if not exists(name)]
    missing = [(key, name) for key, name in VIEWS.items() if not exists(name)]
    files = {"orders": "02_orders_metric_view.sql", "funnel": "03_funnel_metric_view.sql"}
    problems += [f"{name} is missing (run {files[key]})" for key, name in missing]
    if problems:
        raise RuntimeError(
            "An earlier step has not run: " + "; ".join(problems)
            + f". Run 02_orders_metric_view.sql, then 03_funnel_metric_view.sql, on a SQL warehouse with catalog={catalog} and schema={schema} in the parameter boxes"
            + " (or: databricks bundle run capability_guides_metric_views --target dev). Nothing was changed."
        )


def sql_string(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def close(a: float | None, b: float | None, rel: float = 1e-9, abs_tol: float = 1e-6) -> bool:
    """True when two measure values agree. Both missing counts as agreeing."""
    if a is None or b is None:
        return a is None and b is None
    return abs(float(a) - float(b)) <= max(abs_tol, rel * max(abs(float(a)), abs(float(b))))


def compare_groups(view_rows: list[dict], hand_rows: list[dict], keys: list[str], measure: str) -> dict:
    """Compare one measure between the metric view's rows and the hand-written rows, group by group.

    Rows are dicts. A group is missing when only one side has it, and that counts as a mismatch.
    The returned view/hand values are those of the group with the largest hand-written value.
    """
    def index(rows):
        return {tuple(r[k] for k in keys): r[measure] for r in rows}

    v, h = index(view_rows), index(hand_rows)
    groups = sorted(set(v) | set(h), key=lambda g: tuple(str(x) for x in g))
    matched = sum(1 for g in groups if g in v and g in h and close(v[g], h[g]))
    present = [g for g in groups if h.get(g) is not None]
    top = max(present, key=lambda g: abs(float(h[g]))) if present else (groups[0] if groups else None)
    return {
        "view": v.get(top) if top is not None else None,
        "hand": h.get(top) if top is not None else None,
        "matched": matched,
        "checked": len(groups),
        "passed": bool(groups) and matched == len(groups),
        "top": top,
    }


RESULTS_DDL = (
    "step string, check_name string, grain string, metric_view_value double, handwritten_value double, "
    "groups_matched int, groups_checked int, passed boolean, detail string, run_id string, recorded_at timestamp"
)
_ROW_DDL = (
    "step string, check_name string, grain string, metric_view_value double, handwritten_value double, "
    "groups_matched int, groups_checked int, passed boolean, detail string, run_id string"
)


def _num(value):
    return None if value is None else float(value)


def write_results(spark, table: str, step: str, rows: list[dict], run_id: str) -> None:
    """Replace this step's rows, so a rerun does not add a second set.

    Each row has check, grain, view (the metric view's value), hand (the hand-written value), matched,
    checked, passed, and detail. For a grouped check, view and hand are the values for the largest group.
    """
    from pyspark.sql import functions as F

    spark.sql(f"CREATE TABLE IF NOT EXISTS {table} ({RESULTS_DDL})")
    spark.sql(f"DELETE FROM {table} WHERE step = {sql_string(step)}")
    data = [
        (
            step,
            r["check"],
            r["grain"],
            _num(r.get("view")),
            _num(r.get("hand")),
            int(r.get("matched", 0)),
            int(r.get("checked", 0)),
            bool(r["passed"]),
            r.get("detail", ""),
            run_id,
        )
        for r in rows
    ]
    frame = spark.createDataFrame(data, _ROW_DDL).withColumn("recorded_at", F.current_timestamp())
    frame.write.mode("append").saveAsTable(table)
    for r in rows:
        print(f"{step} | {r['check']} | {r['grain']} | view={r.get('view')} hand={r.get('hand')} | {'ok' if r['passed'] else 'MISMATCH'} {r.get('detail', '')}".rstrip())
