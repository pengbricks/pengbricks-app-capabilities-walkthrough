"""Find a guide's pipeline, run an update and wait for it, and read its expectation results."""

from __future__ import annotations

import time
from typing import Any

TERMINAL_STATES = {"COMPLETED", "FAILED", "CANCELED"}


def find_pipeline_id(w, name_part: str) -> str:
    """Id of the one pipeline whose name contains name_part. Development mode adds a prefix to the name."""
    matches = [p for p in w.pipelines.list_pipelines() if name_part in (p.name or "")]
    if len(matches) != 1:
        names = [p.name for p in matches]
        raise ValueError(f"expected one pipeline with '{name_part}' in its name, found {len(matches)}: {names}")
    return matches[0].pipeline_id


def run_update(w, pipeline_id: str, full_refresh: bool = False, poll_seconds: int = 15, timeout_seconds: int = 3000) -> str:
    """Start an update, wait for it, and return its final state. Raises when the update does not complete."""
    update_id = w.pipelines.start_update(pipeline_id=pipeline_id, full_refresh=full_refresh).update_id
    deadline = time.time() + timeout_seconds
    while True:
        state = w.pipelines.get_update(pipeline_id=pipeline_id, update_id=update_id).update.state.value
        print(f"update {update_id}: {state}")
        if state in TERMINAL_STATES:
            break
        if time.time() > deadline:
            raise TimeoutError(f"update {update_id} still {state} after {timeout_seconds}s")
        time.sleep(poll_seconds)
    if state != "COMPLETED":
        raise RuntimeError(f"pipeline update {update_id} ended {state}")
    return state


def latest_expectations(spark, pipeline_id: str) -> Any:
    """Expectation results from the pipeline event log, newest update first. Empty when no flow defines expectations."""
    return spark.sql(
        f"""
        SELECT timestamp, origin.flow_name AS flow, exp.name AS expectation, exp.dataset,
               exp.passed_records, exp.failed_records
        FROM event_log('{pipeline_id}')
        LATERAL VIEW explode(from_json(details:flow_progress.data_quality.expectations,
                      'array<struct<name:string,dataset:string,passed_records:bigint,failed_records:bigint>>')) t AS exp
        WHERE event_type = 'flow_progress'
        ORDER BY timestamp DESC
        """
    )
