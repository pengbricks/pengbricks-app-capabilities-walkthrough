"""Pure helpers for the Omnigent guide: deterministic raw files, names, and the pipeline check.

Nothing here needs a workspace, so the tests run anywhere. The notebooks pass in rows read from
the volume, the pipeline names, and the table row counts.
"""

from __future__ import annotations

import csv
import io
import json
import random
import re
from datetime import date, timedelta
from typing import Any, Iterable

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_DEV_PREFIX = re.compile(r"^\[[^\]]*\]\s*")

SEGMENTS = ["consumer", "enterprise", "public_sector"]
REGIONS = ["east", "west", "north", "south"]
EVENT_TYPES = ["view", "add_to_cart", "checkout"]
LAYERS = ("bronze", "silver", "gold")

ORDER_COLUMNS = ["order_id", "customer_id", "order_date", "amount", "region"]
FIRST_ORDER_DATE = date(2026, 1, 1)


def check_identifier(value: str, what: str = "name") -> str:
    """Return `value` when it is a safe SQL identifier, else raise. Guards names built into SQL."""
    if not _IDENT.match(value or ""):
        raise ValueError(f"Not a valid {what}: {value!r}")
    return value


def raw_paths(catalog: str, schema: str, volume: str, event_files: int = 3) -> dict[str, Any]:
    """Fixed paths of the raw files, so a rerun overwrites the same files."""
    for label, value in (("catalog", catalog), ("schema", schema), ("volume", volume)):
        check_identifier(value, label)
    root = f"/Volumes/{catalog}/{schema}/{volume}"
    return {
        "root": root,
        "orders": f"{root}/orders.csv",
        "customers": f"{root}/customers.json",
        "events_dir": f"{root}/events",
        "events": [f"{root}/events/events_{i:03d}.json" for i in range(1, event_files + 1)],
    }


def generate_customers(seed: int, n: int = 40) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    return [
        {
            "customer_id": f"C{i:04d}",
            "name": f"Customer {i:04d}",
            "segment": rng.choice(SEGMENTS),
            "signup_date": (FIRST_ORDER_DATE - timedelta(days=rng.randint(30, 700))).isoformat(),
        }
        for i in range(1, n + 1)
    ]


def generate_orders(seed: int, customers: list[dict[str, Any]], n: int = 200) -> list[dict[str, Any]]:
    """Orders with two planted defects for the silver step to remove.

    Every 25th row repeats the previous order_id, and every 40th row has no amount. Amounts use
    whole cents, so the totals do not drift with float rounding.
    """
    rng = random.Random(seed + 1)
    rows: list[dict[str, Any]] = []
    for i in range(1, n + 1):
        if i % 25 == 0 and rows:
            rows.append(dict(rows[-1]))
            continue
        cents = rng.randint(500, 50000)
        rows.append(
            {
                "order_id": f"O{i:05d}",
                "customer_id": rng.choice(customers)["customer_id"],
                "order_date": (FIRST_ORDER_DATE + timedelta(days=rng.randint(0, 89))).isoformat(),
                "amount": "" if i % 40 == 0 else f"{cents // 100}.{cents % 100:02d}",
                "region": rng.choice(REGIONS),
            }
        )
    return rows


def generate_events(seed: int, orders: list[dict[str, Any]], files: int = 3, per_file: int = 15) -> list[list[dict[str, Any]]]:
    rng = random.Random(seed + 2)
    out = []
    for f in range(files):
        batch = []
        for j in range(per_file):
            order = rng.choice(orders)
            batch.append(
                {
                    "event_id": f"E{f + 1}{j + 1:03d}",
                    "order_id": order["order_id"],
                    "event_type": rng.choice(EVENT_TYPES),
                    "event_ts": f"{order['order_date']}T{rng.randint(0, 23):02d}:{rng.randint(0, 59):02d}:00",
                }
            )
        out.append(batch)
    return out


def orders_to_csv(rows: list[dict[str, Any]]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=ORDER_COLUMNS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def to_json_lines(rows: Iterable[dict[str, Any]]) -> str:
    """One JSON object per line with sorted keys, the layout Auto Loader reads by default."""
    return "".join(json.dumps(row, sort_keys=True) + "\n" for row in rows)


def parse_orders_csv(text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(text)))


def parse_json_lines(text: str) -> list[dict[str, Any]]:
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def expected_counts(
    orders: list[dict[str, str]], customers: list[dict[str, Any]], events: list[dict[str, Any]]
) -> dict[str, Any]:
    """What the three layers should hold if silver keeps one row per order_id and drops null amounts."""
    valid: dict[str, dict[str, str]] = {}
    for row in orders:
        if row.get("amount") not in (None, "") and row["order_id"] not in valid:
            valid[row["order_id"]] = row
    cents = sum(round(float(r["amount"]) * 100) for r in valid.values())
    return {
        "bronze_orders": len(orders),
        "bronze_customers": len(customers),
        "bronze_events": len(events),
        "silver_orders": len(valid),
        "gold_order_count": len(valid),
        "gold_revenue": cents / 100,
    }


def strip_dev_prefix(name: str) -> str:
    """Development mode puts '[dev user] ' in front of resource names."""
    return _DEV_PREFIX.sub("", name or "")


def find_pipeline(names: Iterable[str], prefix: str) -> str | None:
    """First pipeline name (sorted) that starts with `prefix` once the dev prefix is removed."""
    matches = sorted(n for n in names if strip_dev_prefix(n).lower().startswith(prefix.lower()))
    return matches[0] if matches else None


def classify_tables(table_names: Iterable[str], prefix: str) -> dict[str, list[str]]:
    """Group tables named <prefix><layer>_* into bronze, silver, and gold."""
    groups: dict[str, list[str]] = {layer: [] for layer in LAYERS}
    for name in sorted(table_names):
        for layer in LAYERS:
            if name.lower().startswith(f"{prefix.lower()}{layer}_"):
                groups[layer].append(name)
    return groups


def table_for(groups: dict[str, list[str]], layer: str, hint: str) -> str | None:
    """The table in `layer` whose name contains `hint`, else None."""
    for name in groups.get(layer, []):
        if hint in name.lower():
            return name
    return None


def reconcile(expected: dict[str, Any], actual: dict[str, Any]) -> list[dict[str, Any]]:
    """Compare expected and actual values by key. A key missing from `actual` is reported as missing."""
    checks = []
    for key, want in expected.items():
        got = actual.get(key)
        if got is None:
            status = "missing"
        elif isinstance(want, float):
            status = "pass" if abs(float(got) - want) < 0.005 else "fail"
        else:
            status = "pass" if got == want else "fail"
        checks.append({"check": key, "expected": want, "actual": got, "status": status})
    return checks


def overall_status(pipeline: str | None, groups: dict[str, list[str]], checks: list[dict[str, Any]]) -> str:
    """pass, fail, or needs_manual_check.

    The interactive Omnigent steps may not have run yet. No pipeline and no omni_ tables, or a
    missing layer, is needs_manual_check. A fail is only a layer that exists with the wrong counts.
    """
    if not any(groups.values()):
        return "needs_manual_check"
    if not all(groups[layer] for layer in LAYERS):
        return "needs_manual_check"
    if any(c["status"] == "fail" for c in checks):
        return "fail"
    if any(c["status"] == "missing" for c in checks):
        return "needs_manual_check"
    return "pass"


def manual_steps(pipeline: str | None, groups: dict[str, list[str]]) -> list[str]:
    """What is still to do, in the order of the guide."""
    steps = []
    if pipeline is None:
        steps.append("No pipeline with the expected name prefix yet. Run prompt 1 and prompt 2 in Omnigent.")
    if not groups["bronze"]:
        steps.append("No bronze tables yet. Deploy the bundle to dev and run the pipeline (prompt 2).")
    elif not groups["silver"] or not groups["gold"]:
        steps.append("The pipeline has not produced every layer. Check the last pipeline update.")
    return steps


def render_prompts(template: str, catalog: str, schema: str, volume: str = "omnigent_raw") -> str:
    """Fill the <catalog>, <schema>, and <volume> placeholders in prompts.md."""
    return template.replace("<catalog>", catalog).replace("<schema>", schema).replace("<volume>", volume)
