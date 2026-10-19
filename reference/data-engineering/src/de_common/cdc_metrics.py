"""Read a pipeline update from the event log and record what each dataset did.

The parsing lives in de_common.cdc (pure, unit tested). This module runs the event log
queries and writes the `cdc_refresh_metrics` run log.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from de_common import cdc

METRICS_DDL = (
    "run_ts string, recorded_by string, update_id string, refresh_mode string, dataset string, "
    "rows_read bigint, rows_written bigint, rows_deleted bigint, duration_s double, maintenance_type string, "
    "source_offsets string, target_rows bigint"
)
EVENT_TYPES = ("create_update", "update_progress", "flow_progress", "stream_progress", "planning_information")


def _seconds(timestamp: datetime | str) -> float:
    """Epoch seconds of an event timestamp. Spark returns a datetime; ISO strings also work."""
    if isinstance(timestamp, str):
        timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    return timestamp.timestamp()


def read_events(spark, pipeline_id: str) -> list[dict[str, Any]]:
    """The event types this guide uses, oldest first, with `details` parsed from JSON."""
    kinds = ", ".join(f"'{k}'" for k in EVENT_TYPES)
    rows = spark.sql(
        f"""
        SELECT timestamp, event_type, origin.update_id AS update_id, origin.flow_name AS flow_name,
               message, CAST(details AS STRING) AS details
        FROM event_log('{pipeline_id}')
        WHERE event_type IN ({kinds}) ORDER BY timestamp
        """
    ).collect()
    events = []
    for row in rows:
        event = row.asDict()
        event["details"] = json.loads(event["details"]) if event["details"] else {}
        events.append(event)
    return events


def update_ids(events: list[dict[str, Any]]) -> list[str]:
    """Update ids that completed, oldest first."""
    done = {e["update_id"] for e in events if e["event_type"] == "update_progress" and "is COMPLETED" in (e["message"] or "")}
    return [e["update_id"] for e in events if e["event_type"] == "create_update" and e["update_id"] in done]


def summarize_update(events: list[dict[str, Any]], update_id: str) -> dict[str, Any]:
    """Refresh mode, duration and one entry per dataset for a single update."""
    mine = [e for e in events if e["update_id"] == update_id]
    created = next(e for e in mine if e["event_type"] == "create_update")
    create = created["details"].get("create_update", {})
    mode = cdc.update_refresh_mode(bool(create.get("full_refresh")), create.get("full_refresh_selection"))
    finished = next((e for e in mine if e["event_type"] == "update_progress" and "is COMPLETED" in (e["message"] or "")), None)
    summary: dict[str, Any] = {
        "update_id": update_id,
        "refresh_mode": mode,
        "duration_s": round(_seconds(finished["timestamp"]) - _seconds(created["timestamp"]), 1) if finished else None,
        "datasets": {},
    }
    for dataset in cdc.DATASETS:
        flow = [e for e in mine if e["event_type"] == "flow_progress" and cdc.dataset_name(e["flow_name"]) == dataset]
        statuses = [(e["details"].get("flow_progress") or {}).get("status") for e in flow]
        if "COMPLETED" not in statuses:
            continue  # excluded from this update, for example by a selective refresh
        timed = [e for e, s in zip(flow, statuses) if s in {"PLANNING", "STARTING", "RUNNING", "COMPLETED"}]
        planning = [e for e in mine if e["event_type"] == "planning_information" and cdc.dataset_name(e["flow_name"]) == dataset]
        progress = [
            e["details"]["stream_progress"]["progress_json"]
            for e in mine
            if e["event_type"] == "stream_progress" and cdc.dataset_name(e["flow_name"]) == dataset
        ]
        entry = cdc.flow_numbers([e["details"] for e in flow])
        flow_name = next(e["flow_name"] for e in flow)
        entry["rows_read"] = cdc.rows_read(progress, flow_name) if progress else None
        if dataset == "cdc_orders_bronze" and entry["rows_read"] is not None:
            # Bronze appends every row it reads. The write metric can lag the final batch, so take the larger.
            entry["rows_written"] = max(entry["rows_written"] or 0, entry["rows_read"])
        entry["duration_s"] = round(_seconds(timed[-1]["timestamp"]) - _seconds(timed[0]["timestamp"]), 1)
        entry["maintenance_type"] = cdc.maintenance_type(planning[-1]["details"]) if planning else None
        entry["source_offsets"] = cdc.describe_offsets(progress)
        summary["datasets"][dataset] = entry
    return summary


def record_update(spark, scope: str, summary: dict[str, Any], recorded_by: str):
    """Append one row per dataset to cdc_refresh_metrics, the run log. It gains rows on every run."""
    run_ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows = [
        (
            run_ts, recorded_by, summary["update_id"], summary["refresh_mode"], dataset,
            entry["rows_read"], entry["rows_written"], entry["rows_deleted"], entry["duration_s"],
            entry["maintenance_type"], entry["source_offsets"], spark.table(f"{scope}.{dataset}").count(),
        )
        for dataset, entry in summary["datasets"].items()
    ]
    df = spark.createDataFrame(rows, METRICS_DDL)
    df.write.mode("append").option("mergeSchema", "true").saveAsTable(f"{scope}.cdc_refresh_metrics")
    return df


def comparison(spark, scope: str, summaries: list[dict[str, Any]]):
    """One row per dataset, one column group per update mode: rows written and maintenance type."""
    rows = []
    for dataset in cdc.DATASETS:
        row: list[Any] = [dataset]
        for summary in summaries:
            entry = summary["datasets"].get(dataset)
            row += [None, None] if entry is None else [entry["rows_written"], entry["maintenance_type"] or ""]
        rows.append(tuple(row))
    names = ["dataset"]
    for summary in summaries:
        names += [f"{summary['refresh_mode']}_rows", f"{summary['refresh_mode']}_maintenance"]
    ddl = ", ".join(f"{n} {'string' if n == 'dataset' or n.endswith('_maintenance') else 'bigint'}" for n in names)
    return spark.createDataFrame(rows, ddl)


def latest_by_mode(events: list[dict[str, Any]]) -> dict[str, str]:
    """The newest completed update of each refresh mode."""
    latest: dict[str, str] = {}
    for update_id in update_ids(events):
        create = next(e for e in events if e["update_id"] == update_id and e["event_type"] == "create_update")
        details = create["details"].get("create_update", {})
        mode = cdc.update_refresh_mode(bool(details.get("full_refresh")), details.get("full_refresh_selection"))
        latest[mode] = update_id
    return latest


def dataset_table(spark, summary: dict[str, Any]):
    """What one update did to each dataset, as a DataFrame to display."""
    rows = [
        (d, e["rows_read"], e["rows_written"], e["rows_deleted"], e["duration_s"], e["maintenance_type"], e["source_offsets"])
        for d, e in summary["datasets"].items()
    ]
    ddl = "dataset string, rows_read bigint, rows_written bigint, rows_deleted bigint, duration_s double, maintenance_type string, source_offsets string"
    return spark.createDataFrame(rows, ddl)
