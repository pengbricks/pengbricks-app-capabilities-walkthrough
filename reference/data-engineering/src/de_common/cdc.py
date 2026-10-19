"""CDC guide helpers: seed orders, Debezium-style change events, and event log parsing.

Everything here is deterministic and free of Spark, so the unit tests cover it. The notebooks
turn these plain dicts into DataFrames and files.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from de_common.spec import plan_changes

STATUSES = ["new", "paid", "shipped"]
CHANNELS = ["web", "store", "app"]
BASE_TIME = datetime(2026, 1, 1, tzinfo=timezone.utc)
# Batch 1 LSNs sit below batch 2 LSNs, and the late event lands in between.
BATCH1_LSN_START = 1_000_000
BATCH2_LSN_START = 2_000_000
LATE_LSN = 1_500_000
# Default sizes: 500 orders, then 50 inserts, 120 updates and 30 deletes.
DEFAULT_CHANGES = {"rows": 500, "inserts": 50, "updates": 120, "deletes": 30}


def _stamp(offset_seconds: int) -> str:
    return (BASE_TIME + timedelta(seconds=offset_seconds)).strftime("%Y-%m-%d %H:%M:%S")


def seed_order(order_id: int) -> dict[str, Any]:
    """One deterministic order row."""
    return {
        "order_id": order_id,
        "customer_id": 1000 + (order_id * 7) % 97,
        "status": STATUSES[order_id % 2],  # new or paid
        "amount": round(20 + (order_id * 37) % 480 + (order_id % 4) * 0.25, 2),
        "channel": CHANNELS[order_id % 3],
        "updated_at": _stamp(order_id),
    }


def seed_orders(rows: int) -> list[dict[str, Any]]:
    return [seed_order(i) for i in range(rows)]


def updated_order(order: dict[str, Any], position: int) -> dict[str, Any]:
    """The order after batch 2. Every third update only changes channel, which history ignores.

    The other updates move status forward and raise the amount by 10%, so they open a new
    history version when the target tracks only status and amount.
    """
    new = dict(order)
    new["updated_at"] = _stamp(100_000 + order["order_id"])
    if position % 3 == 0:
        new["channel"] = CHANNELS[(CHANNELS.index(order["channel"]) + 1) % len(CHANNELS)]
    else:
        new["status"] = STATUSES[min(STATUSES.index(order["status"]) + 1, len(STATUSES) - 1)]
        new["amount"] = round(order["amount"] * 1.1, 2)
    return new


def new_order(order_id: int) -> dict[str, Any]:
    return seed_order(order_id) | {"updated_at": _stamp(100_000 + order_id)}


def plan_batch2(rows: int, inserts: int, updates: int, deletes: int) -> dict[str, Any]:
    """Which ids batch 2 inserts, updates and deletes, plus the updates that change history."""
    plan = plan_changes(rows, inserts, updates, deletes)
    plan["history_updates"] = len([p for p in range(updates) if p % 3 != 0])
    plan["channel_only_updates"] = updates - plan["history_updates"]
    return plan


def apply_batch2(orders: list[dict[str, Any]], plan: dict[str, Any]) -> list[dict[str, Any]]:
    """The operational table after batch 2: the new state the source table is changed to."""
    by_id = {o["order_id"]: o for o in orders}
    for position, order_id in enumerate(plan["update_ids"]):
        by_id[order_id] = updated_order(by_id[order_id], position)
    for order_id in plan["delete_ids"]:
        del by_id[order_id]
    for order_id in plan["insert_ids"]:
        by_id[order_id] = new_order(order_id)
    return sorted(by_id.values(), key=lambda o: o["order_id"])


def debezium_event(op: str, before: dict | None, after: dict | None, lsn: int, ts_ms: int) -> dict[str, Any]:
    """A Debezium-style envelope: op c/u/d, before and after images, and the source LSN and timestamp."""
    if op not in {"c", "u", "d"}:
        raise ValueError(f"op must be c, u or d, got {op!r}")
    return {
        "op": op,
        "before": before,
        "after": after,
        "ts_ms": ts_ms,
        "source": {"db": "shop", "table": "orders", "lsn": lsn, "ts_ms": ts_ms - 5},
    }


def _ts_ms(offset_seconds: int) -> int:
    return int((BASE_TIME + timedelta(seconds=offset_seconds)).timestamp() * 1000)


def batch1_events(orders: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Batch 1: every seed order as a create event, LSNs ascending."""
    return [
        debezium_event("c", None, o, BATCH1_LSN_START + n, _ts_ms(n)) for n, o in enumerate(orders)
    ]


def batch2_events(orders: list[dict[str, Any]], plan: dict[str, Any]) -> list[dict[str, Any]]:
    """Batch 2: updates, deletes and inserts with LSNs ascending, plus one late event.

    The late event is an older change to the first updated order (LSN between the two
    batches). AUTO CDC must drop it because a later LSN is already applied.
    """
    by_id = {o["order_id"]: o for o in orders}
    lsn = BATCH2_LSN_START
    events: list[dict[str, Any]] = []
    for position, order_id in enumerate(plan["update_ids"]):
        before = by_id[order_id]
        events.append(debezium_event("u", before, updated_order(before, position), lsn, _ts_ms(100_000 + lsn - BATCH2_LSN_START)))
        lsn += 1
    for order_id in plan["delete_ids"]:
        events.append(debezium_event("d", by_id[order_id], None, lsn, _ts_ms(100_000 + lsn - BATCH2_LSN_START)))
        lsn += 1
    for order_id in plan["insert_ids"]:
        events.append(debezium_event("c", None, new_order(order_id), lsn, _ts_ms(100_000 + lsn - BATCH2_LSN_START)))
        lsn += 1
    first = by_id[plan["update_ids"][0]]
    stale = first | {"status": "cancelled", "amount": 1.0}
    events.append(debezium_event("u", first, stale, LATE_LSN, _ts_ms(50_000)))
    return events


def event_files(events: list[dict[str, Any]], prefix: str, per_file: int = 100, reverse: bool = False) -> dict[str, str]:
    """Split events into fixed-name NDJSON files such as batch2_part_000.json.

    Fixed names mean a rerun rewrites the same files instead of adding new ones. `reverse`
    writes the newest events first, so the files themselves arrive out of order.
    """
    ordered = list(reversed(events)) if reverse else list(events)
    files: dict[str, str] = {}
    for index in range(0, len(ordered), per_file):
        chunk = ordered[index : index + per_file]
        files[f"{prefix}_part_{index // per_file:03d}.json"] = "\n".join(json.dumps(e, sort_keys=True) for e in chunk) + "\n"
    return files


def expected_counts(rows: int, inserts: int, updates: int, deletes: int) -> dict[str, int]:
    """What the targets should hold after batch 2, from the change plan."""
    plan = plan_batch2(rows, inserts, updates, deletes)
    final = plan["final_rows"]
    return {
        "scd1_initial": rows,
        "scd1_final": final,
        # SCD2 from the change data feed tracks status and amount only.
        "cdf_scd2_final_versions": rows + inserts + plan["history_updates"],
        "cdf_scd2_current": final,
        "snapshot_scd2_final_versions": rows + inserts + updates,
    }


MAINTENANCE_PREFIX = "MAINTENANCE_TYPE_"
DATASETS = [
    "cdc_orders_bronze",
    "cdc_orders_scd1",
    "cdc_orders_from_cdf",
    "cdc_orders_snapshot_scd2",
    "cdc_orders_daily",
]


def dataset_name(flow_name: str | None) -> str:
    """Dataset behind an event-log flow name: the last dotted part, without the `_flow` suffix."""
    return (flow_name or "").rsplit(".", 1)[-1].removesuffix("_flow")


def maintenance_type(planning_details: str | dict | None) -> str | None:
    """The chosen maintenance technique in a planning_information event's `details` JSON.

    Returns a short name such as COMPLETE_RECOMPUTE, GROUP_AGGREGATE, ROW_BASED or NO_OP,
    or None when the event has no chosen technique.
    """
    if not planning_details:
        return None
    details = json.loads(planning_details) if isinstance(planning_details, str) else planning_details
    info = details.get("planning_information", details)
    for technique in info.get("technique_information", []):
        if technique.get("is_chosen"):
            name = technique.get("maintenance_type", "")
            return name.removeprefix(MAINTENANCE_PREFIX) or None
    return None


def update_refresh_mode(full_refresh: bool, full_refresh_selection: list[str] | None) -> str:
    """Label an update from its create_update event: full_refresh, selective_full_refresh or incremental."""
    if full_refresh_selection:
        return "selective_full_refresh"
    return "full_refresh" if full_refresh else "incremental"


def flow_numbers(progress_details: list[dict]) -> dict[str, Any]:
    """Rows written and deleted from one flow's flow_progress events, in time order.

    Streaming flows report num_upserted_rows and num_deleted_rows while running; a
    materialized view reports num_output_rows when it completes. The counters only grow, so
    the highest value is the total (a later event can carry a stale partial count).
    Flows that report nothing, such as the snapshot flow, return None.
    """
    written = deleted = None
    for event in progress_details:
        metrics = (event.get("flow_progress") or {}).get("metrics") or {}
        for key in ("num_output_rows", "num_upserted_rows"):
            if metrics.get(key) is not None:
                written = max(written or 0, metrics[key])
        if metrics.get("num_deleted_rows") is not None:
            deleted = max(deleted or 0, metrics["num_deleted_rows"])
    return {"rows_written": written, "rows_deleted": deleted}


def describe_offsets(progress_jsons: list[str]) -> str | None:
    """Where a streaming flow started and stopped reading, from its stream_progress events.

    A Delta source reports table versions (`reservoirVersion`); Auto Loader reports a file
    queue position (`seqNum`) and the files in the batch. Returns None when there is no
    progress event, for example a materialized view or the snapshot flow.
    """
    if not progress_jsons:
        return None
    batches = [json.loads(p) for p in progress_jsons]
    source = batches[0]["sources"][0]
    last = batches[-1]["sources"][-1]
    first_start, last_end = source.get("startOffset"), last.get("endOffset")
    if last_end is None:
        return None
    if "reservoirVersion" in last_end:
        start = f"v{first_start['reservoirVersion']}" if first_start else "start"
        return f"Delta version {start} to v{last_end['reservoirVersion']}"
    files = sum(int(b["sources"][0].get("metrics", {}).get("batchSizeNumFiles", 0)) for b in batches)
    start = f"queue {first_start['seqNum']}" if first_start else "start"
    return f"{files} new files, {start} to queue {last_end['seqNum']}"


def rows_read(progress_jsons: list[str], flow_name: str) -> int | None:
    """Rows a streaming flow read, summed over its micro-batches in `stream_progress` events.

    Each batch carries `observedMetrics` keyed `pipelines.expectations.<flow or table>`, with a
    `total` row count. The key that ends in the flow's own name counts the rows that reached it.
    Returns None when no batch reports one, for example for a materialized view.
    """
    tail = flow_name.rsplit(".", 1)[-1]
    total, seen = 0, False
    for text in progress_jsons:
        for key, value in (json.loads(text).get("observedMetrics") or {}).items():
            if key.rsplit(".", 1)[-1] == tail and "total" in value:
                total += int(value["total"])
                seen = True
    return total if seen else None
