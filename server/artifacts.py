"""Guide artifacts: reference code links, live run history, and quick runs.

Jobs are found by their `capability_guide_job` tag, so each workspace's own reference
deployment is discovered without configuring job IDs. Only job keys listed in
artifacts.json can be triggered.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .run_store import RunRecord, RunStore

logger = logging.getLogger(__name__)

INDEX_PATH = Path(__file__).with_name("artifacts.json")
SNIPPETS_PATH = Path(__file__).with_name("artifact_snippets.json")
JOB_TAG = "capability_guide_job"
JOB_CACHE_SECONDS = 120
RUNS_PER_JOB = 5


@lru_cache(maxsize=1)
def load_index() -> dict[str, Any]:
    return json.loads(INDEX_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_snippets() -> dict[str, list[dict[str, Any]]]:
    return json.loads(SNIPPETS_PATH.read_text(encoding="utf-8"))


def highlights(slug: str, entry: dict[str, Any]) -> list[dict[str, Any]]:
    snippets = load_snippets().get(slug, [])
    return [
        {
            "label": item["label"],
            "notes": item.get("notes", []),
            "path": snippet["path"],
            "symbol": snippet["symbol"],
            "language": snippet["language"],
            "code": snippet["code"],
            "url": f"{repo_url(snippet['path'])}#L{snippet['startLine']}-L{snippet['endLine']}",
        }
        for item, snippet in zip(entry.get("highlights", []), snippets)
    ]


def workspace_client():
    from databricks.sdk import WorkspaceClient

    return WorkspaceClient()


class JobDirectory:
    """Maps capability_guide_job tag values to deployed job IDs, cached briefly."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: dict[str, dict[str, Any]] = {}
        self._loaded_at = 0.0

    def jobs(self, w) -> dict[str, dict[str, Any]]:
        with self._lock:
            if time.time() - self._loaded_at < JOB_CACHE_SECONDS:
                return self._jobs
            found: dict[str, dict[str, Any]] = {}
            for job in w.jobs.list():
                tags = (job.settings.tags or {}) if job.settings else {}
                key = tags.get(JOB_TAG)
                if key and key not in found:
                    found[key] = {"jobId": job.job_id, "name": job.settings.name}
            self._jobs = found
            self._loaded_at = time.time()
            return found


directory = JobDirectory()
store = RunStore(workspace_client)
router = APIRouter()


def guide_entry(slug: str) -> dict[str, Any]:
    entry = load_index()["guides"].get(slug)
    if entry is None:
        raise HTTPException(status_code=404, detail="Unknown guide")
    return entry


def repo_url(path: str) -> str:
    index = load_index()
    return f"{index['repository']}/blob/{index['branch']}/{path}"


def run_summary(host: str, job_id: int, run) -> dict[str, Any]:
    state = run.state
    return {
        "runId": run.run_id,
        "url": run.run_page_url or f"{host}/jobs/{job_id}/runs/{run.run_id}",
        "lifeCycleState": state.life_cycle_state.value if state and state.life_cycle_state else None,
        "resultState": state.result_state.value if state and state.result_state else None,
        "trigger": run.trigger.value if run.trigger else None,
        "startTime": datetime.fromtimestamp(run.start_time / 1000, timezone.utc).isoformat() if run.start_time else None,
    }


def to_record(slug: str, job_key: str, job_id: int, summary: dict[str, Any], via: str) -> RunRecord:
    return RunRecord(
        guide_slug=slug,
        job_key=job_key,
        job_id=job_id,
        run_id=summary["runId"],
        run_url=summary["url"],
        life_cycle_state=summary["lifeCycleState"],
        result_state=summary["resultState"],
        trigger=summary["trigger"],
        triggered_via=via,
        started_at=datetime.fromisoformat(summary["startTime"]) if summary["startTime"] else None,
    )


@router.get("/artifacts/{slug}")
def get_artifacts(slug: str) -> dict[str, Any]:
    entry = guide_entry(slug)
    response: dict[str, Any] = {
        "slug": slug,
        "onePagerUrl": repo_url(entry["onePager"]),
        "bundleUrl": repo_url(entry["bundle"]).replace("/blob/", "/tree/"),
        "code": [{"label": item["label"], "url": repo_url(item["path"])} for item in entry["code"]],
        "docs": entry.get("docs", []),
        "autoLoaderDrop": bool(entry.get("autoLoaderDrop")),
        "walkthroughs": [{"label": item["label"], "url": repo_url(item["path"])} for item in entry.get("walkthroughs", [])],
        "highlights": highlights(slug, entry),
        "recordedRuns": entry.get("recordedRuns", []),
        "jobs": [],
        "live": False,
        "tracking": "lakebase" if store.enabled else "jobs-api",
        "history": [],
    }
    if not entry["jobs"]:
        return response

    try:
        w = workspace_client()
        host = w.config.host.rstrip("/")
        deployed = directory.jobs(w)
        records: list[RunRecord] = []
        for job in entry["jobs"]:
            found = deployed.get(job["key"])
            item: dict[str, Any] = {"key": job["key"], "label": job["label"], "deployed": found is not None, "runs": []}
            if found:
                item["jobId"] = found["jobId"]
                item["jobUrl"] = f"{host}/jobs/{found['jobId']}"
                runs = [run_summary(host, found["jobId"], run) for run in w.jobs.list_runs(job_id=found["jobId"], limit=RUNS_PER_JOB)]
                item["runs"] = runs
                records.extend(to_record(slug, job["key"], found["jobId"], run, "observed") for run in runs)
            response["jobs"].append(item)
        response["live"] = True
    except Exception as error:  # Workspace access is optional for the public static view.
        logger.warning("Live artifact lookup failed for %s: %s", slug, error)
        response["liveError"] = "Run history is unavailable in this deployment."
        return response

    if not store.enabled:
        response["trackingDetail"] = "Lakebase run history is not configured for this deployment."
        return response
    try:
        store.record(records)
        response["history"] = [
            {**row, "started_at": row["started_at"].isoformat() if row["started_at"] else None}
            for row in store.history(slug)
        ]
    except Exception as error:
        logger.warning("Lakebase run tracking failed for %s: %s", slug, error)
        response["tracking"] = "jobs-api"
        response["trackingDetail"] = f"Lakebase run history is unavailable ({type(error).__name__}: {str(error)[:160]})"
    return response


class QuickRunRequest(BaseModel):
    jobKey: str


@router.post("/artifacts/{slug}/quick-run")
def quick_run(slug: str, request: QuickRunRequest) -> dict[str, Any]:
    entry = guide_entry(slug)
    if request.jobKey not in {job["key"] for job in entry["jobs"]}:
        raise HTTPException(status_code=400, detail="This job is not part of the guide")

    w = workspace_client()
    found = directory.jobs(w).get(request.jobKey)
    if not found:
        raise HTTPException(status_code=404, detail="The reference job is not deployed in this workspace")

    host = w.config.host.rstrip("/")
    try:
        started = w.jobs.run_now(job_id=found["jobId"])
    except Exception as error:
        logger.warning("Quick run failed for %s/%s: %s", slug, request.jobKey, error)
        raise HTTPException(status_code=502, detail="The job could not be started. Check the app's run permission.") from error

    run = w.jobs.get_run(run_id=started.run_id)
    summary = run_summary(host, found["jobId"], run)
    try:
        store.record([to_record(slug, request.jobKey, found["jobId"], summary, "quick-run")])
    except Exception as error:
        logger.warning("Lakebase run tracking failed for quick run %s: %s", started.run_id, error)
    return summary


# --- Auto Loader drop: write an example document into a pipeline's landing path ---

SAMPLES_PATH = Path(__file__).with_name("artifact_samples.json")
MAX_DROP_BYTES = 64 * 1024
MAX_DROP_RECORDS = 20


@lru_cache(maxsize=1)
def load_samples() -> dict[str, list[dict[str, Any]]]:
    return json.loads(SAMPLES_PATH.read_text(encoding="utf-8"))


def drop_config(slug: str) -> dict[str, Any]:
    config = guide_entry(slug).get("autoLoaderDrop")
    if not config:
        raise HTTPException(status_code=404, detail="This guide has no Auto Loader drop")
    return config


def pipeline_for(w, job_key: str) -> tuple[str, str]:
    """Find the pipeline a guide job runs, and its landing path, from the deployed job."""
    found = directory.jobs(w).get(job_key)
    if not found:
        raise HTTPException(status_code=404, detail="The reference job is not deployed in this workspace")
    job = w.jobs.get(job_id=found["jobId"])
    pipeline_id = next(
        (task.pipeline_task.pipeline_id for task in job.settings.tasks or [] if task.pipeline_task), None
    )
    if not pipeline_id:
        raise HTTPException(status_code=404, detail="The reference job has no pipeline task")
    configuration = w.pipelines.get(pipeline_id=pipeline_id).spec.configuration or {}
    landing = configuration.get("landing_events_path", "")
    if not landing.startswith("/Volumes/"):
        raise HTTPException(status_code=500, detail="The pipeline has no landing_events_path volume configured")
    return pipeline_id, landing.rstrip("/") + "/"


def parse_drop(content: str) -> list[dict[str, Any]]:
    if len(content.encode("utf-8")) > MAX_DROP_BYTES:
        raise HTTPException(status_code=413, detail="Documents are limited to 64 KB")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail=f"Not valid JSON: {error.msg} at line {error.lineno}") from error
    records = parsed if isinstance(parsed, list) else [parsed]
    if not records or len(records) > MAX_DROP_RECORDS or not all(isinstance(r, dict) for r in records):
        raise HTTPException(status_code=400, detail=f"Send one JSON object or a list of up to {MAX_DROP_RECORDS} objects")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    # Stamp the event time so the pipeline's latency column measures this drop.
    return [{**record, "event_ts": record.get("event_ts") or now} for record in records]


@router.get("/artifacts/{slug}/drop")
def get_drop(slug: str) -> dict[str, Any]:
    drop_config(slug)
    return {"samples": load_samples().get(slug, [])}


class DropRequest(BaseModel):
    content: str


@router.post("/artifacts/{slug}/drop")
def drop_document(slug: str, request: DropRequest) -> dict[str, Any]:
    import io
    import uuid

    config = drop_config(slug)
    records = parse_drop(request.content)
    w = workspace_client()
    host = w.config.host.rstrip("/")
    pipeline_id, landing = pipeline_for(w, config["jobKey"])

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    path = f"{landing}app-drops/drop-{stamp}-{uuid.uuid4().hex[:8]}.json"
    body = "\n".join(json.dumps(record) for record in records) + "\n"
    try:
        w.files.upload(path, io.BytesIO(body.encode("utf-8")), overwrite=False)
    except Exception as error:
        logger.warning("Auto Loader drop failed for %s: %s", slug, error)
        raise HTTPException(status_code=502, detail="Could not write to the landing volume. Check the app's volume grants.") from error

    response: dict[str, Any] = {
        "path": path,
        "records": len(records),
        "pipelineUrl": f"{host}/pipelines/{pipeline_id}",
    }
    try:
        update = w.pipelines.start_update(pipeline_id=pipeline_id)
        response["updateId"] = update.update_id
        response["updateUrl"] = f"{host}/pipelines/{pipeline_id}/updates/{update.update_id}"
    except Exception as error:  # usually an update is already running; it or the next one picks the file up
        logger.info("Pipeline update not started for %s: %s", slug, error)
        response["note"] = "An update is already running. Auto Loader picks the file up in the next update."
    return response


def flow_metrics(w, pipeline_id: str, update_id: str) -> list[dict[str, Any]]:
    """Rows written and expectation results per flow, from the pipeline event log."""
    flows: dict[str, dict[str, Any]] = {}
    events = w.pipelines.list_pipeline_events(
        pipeline_id=pipeline_id, filter=f"update_id = '{update_id}' AND event_type = 'flow_progress'", max_results=100
    )
    for event in events:
        details = (event.as_dict() if hasattr(event, "as_dict") else {}).get("details") or {}
        progress = details.get("flow_progress") or {}
        metrics = progress.get("metrics") or {}
        if progress.get("status") != "COMPLETED" or event.origin is None:
            continue
        name = (event.origin.flow_name or "").split(".")[-1]
        quality = progress.get("data_quality") or {}
        flows.setdefault(name, {
            "flow": name,
            "rowsWritten": metrics.get("num_output_rows"),
            "droppedRecords": quality.get("dropped_records"),
            "expectations": [
                {"name": item.get("name"), "passed": item.get("passed_records"), "failed": item.get("failed_records")}
                for item in quality.get("expectations") or []
            ],
        })
    return sorted(flows.values(), key=lambda flow: flow["flow"])


@router.get("/artifacts/{slug}/drop/updates/{update_id}")
def drop_status(slug: str, update_id: str) -> dict[str, Any]:
    config = drop_config(slug)
    w = workspace_client()
    pipeline_id, _ = pipeline_for(w, config["jobKey"])
    update = w.pipelines.get_update(pipeline_id=pipeline_id, update_id=update_id).update
    state = update.state.value if update and update.state else "UNKNOWN"
    response: dict[str, Any] = {"state": state, "flows": []}
    if state == "COMPLETED":
        try:
            response["flows"] = flow_metrics(w, pipeline_id, update_id)
        except Exception as error:
            logger.warning("Pipeline event lookup failed for %s: %s", update_id, error)
    return response
