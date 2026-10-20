"""Guide artifacts: reference code links, live run history, and quick runs.

Jobs are found by their `capability_guide_job` tag, so each workspace's own reference
deployment is discovered without configuring job IDs. Only job keys listed in
artifacts.json can be triggered.
"""

from __future__ import annotations

import json
import logging
import re
import threading
import time
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .run_store import RunRecord, RunStore

logger = logging.getLogger(__name__)

INDEX_PATH = Path(__file__).with_name("artifacts.json")
SNIPPETS_PATH = Path(__file__).with_name("artifact_snippets.json")
DOWNLOADS_DIR = Path(__file__).with_name("downloads")
# scripts/build_artifact_snippets.py stores each download as <filename>.bin; see STORED_SUFFIX there.
DOWNLOAD_STORED_SUFFIX = ".bin"
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
            # A walkthrough section id shows the excerpt inside that section of the walkthrough.
            "section": item.get("section"),
            "path": snippet["path"],
            "symbol": snippet["symbol"],
            "language": snippet["language"],
            "code": snippet["code"],
            "functions": snippet.get("functions", {}),
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
            for job in w.jobs.list(expand_tasks=True):
                settings = job.settings
                tags = (settings.tags or {}) if settings else {}
                key = tags.get(JOB_TAG)
                if key and key not in found:
                    found[key] = {
                        "jobId": job.job_id,
                        "name": settings.name,
                        "filesRoot": bundle_files_root(settings),
                        "pipelineIds": [task.pipeline_task.pipeline_id for task in getattr(settings, "tasks", None) or [] if task.pipeline_task],
                    }
            self._jobs = found
            self._loaded_at = time.time()
            return found


def bundle_files_root(settings) -> str | None:
    """The workspace folder a bundle deployed its files to, from the job's deployment metadata."""
    deployment = getattr(settings, "deployment", None)
    path = getattr(deployment, "metadata_file_path", None) if deployment else None
    if not path or not path.endswith("/state/metadata.json"):
        return None
    return path[: -len("/state/metadata.json")] + "/files"


WORKSPACE_PAGES = {"DIRECTORY": "browse/folders", "NOTEBOOK": "editor/notebooks", "FILE": "editor/files"}


def workspace_object(w, path: str):
    """The workspace object at a path, or None if it is missing or the app can't read it."""
    try:
        return w.workspace.get_status(path)
    except Exception as error:
        logger.info("Workspace lookup failed for %s: %s", path, error)
        return None


def workspace_url(w, host: str, path: str) -> str:
    """A browser link to a workspace object; falls back to the path form if the app can't read it."""
    status = workspace_object(w, path)
    kind = status.object_type.value if status and status.object_type else None
    if kind in WORKSPACE_PAGES and status.object_id:
        return f"{host}/{WORKSPACE_PAGES[kind]}/{status.object_id}"
    return f"{host}/#workspace{path}"


def workspace_links(w, host: str, slug: str, entry: dict[str, Any], deployed: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Links to the deployed sample code and the pipelines a guide's jobs run, in this workspace.

    The guide's own folder (guides/<slug>, which opens with 00_start_here) is preferred; bundles
    without one link to the bundle's root folder.
    """
    root = next((job["filesRoot"] for job in deployed if job.get("filesRoot")), None)
    if root is None:
        return None
    guide_dir = f"{root}/guides/{slug}"
    has_guide_dir = workspace_object(w, guide_dir) is not None
    folder_path = guide_dir if has_guide_dir else root
    start_here = f"{guide_dir}/00_start_here"
    start = workspace_url(w, host, start_here) if has_guide_dir and workspace_object(w, start_here) else None
    bundle = entry["bundle"].rstrip("/") + "/"
    files = [
        {"label": item["label"], "url": workspace_url(w, host, f"{root}/{item['path'][len(bundle):]}")}
        for item in entry["code"]
        if item["path"].startswith(bundle)
    ]
    pipelines = []
    for pipeline_id in dict.fromkeys(pid for job in deployed for pid in job.get("pipelineIds", [])):
        try:
            name = w.pipelines.get(pipeline_id=pipeline_id).name
        except Exception as error:
            logger.info("Pipeline lookup failed for %s: %s", pipeline_id, error)
            name = None
        # Development-mode deployments prefix names with "[dev <user>]"; the guide shows the bundle's name.
        label = re.sub(r"^\[[^\]]*\]\s*", "", name) if name else "Pipeline"
        pipelines.append({"label": label, "url": f"{host}/pipelines/{pipeline_id}"})
    return {
        "folder": {"label": "Guide folder" if has_guide_dir else "Sample code folder", "path": folder_path, "url": workspace_url(w, host, folder_path)},
        "startHere": {"label": "00_start_here", "url": start} if start else None,
        "files": files,
        "pipelines": pipelines,
    }


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
        # Canonical run URL; run_page_url uses the legacy ?o=...#job/... form.
        "url": f"{host}/jobs/{job_id}/runs/{run.run_id}",
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


def download_path(entry: dict[str, Any]) -> Path | None:
    """The built zip for a guide's `download` entry, or None when the guide offers none or it was not built."""
    config = entry.get("download")
    if not config:
        return None
    path = DOWNLOADS_DIR / f"{Path(config['filename']).name}{DOWNLOAD_STORED_SUFFIX}"
    return path if path.is_file() else None


def download_name(path: Path) -> str:
    """The name the user downloads: the stored name without its .bin suffix."""
    return path.name.removesuffix(DOWNLOAD_STORED_SUFFIX)


def download_info(entry: dict[str, Any]) -> dict[str, Any] | None:
    path = download_path(entry)
    if path is None:
        return None
    return {"filename": download_name(path), "sizeBytes": path.stat().st_size}


@router.get("/artifacts/{slug}/download")
def download_bundle(slug: str) -> FileResponse:
    path = download_path(guide_entry(slug))
    if path is None:
        raise HTTPException(status_code=404, detail="This guide has no download")
    return FileResponse(path, media_type="application/zip", filename=download_name(path))


@router.get("/artifacts/{slug}")
def get_artifacts(slug: str) -> dict[str, Any]:
    entry = guide_entry(slug)
    response: dict[str, Any] = {
        "slug": slug,
        "onePagerUrl": repo_url(entry["onePager"]),
        "bundleUrl": repo_url(entry["bundle"]).replace("/blob/", "/tree/"),
        "code": [{"label": item["label"], "url": repo_url(item["path"])} for item in entry["code"]],
        "docs": entry.get("docs", []),
        "tools": entry.get("tools", []),
        "autoLoaderDrop": bool(entry.get("autoLoaderDrop")),
        "gatewayControl": bool(entry.get("gatewayControl")),
        "download": download_info(entry),
        "walkthroughs": [
            {"label": item["label"], "url": repo_url(item["path"]), "route": item.get("route")}
            for item in entry.get("walkthroughs", [])
        ],
        "highlights": highlights(slug, entry),
        "recordedRuns": entry.get("recordedRuns", []),
        # The notebook folder in the reference workspace, for workspaces where the guide is not deployed.
        "recordedFolder": entry.get("recordedFolder"),
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
        links = workspace_links(w, host, slug, entry, [deployed[job["key"]] for job in entry["jobs"] if job["key"] in deployed])
        if links:
            response["workspace"] = links
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
    """Rows written and expectation results per dataset for one update, from the pipeline event log.

    Uses the REST API directly: the SDK event model omits `details`, and streaming flows report
    their metrics on RUNNING progress events rather than the final COMPLETED one.
    """
    page = w.api_client.do(
        "GET",
        f"/api/2.0/pipelines/{pipeline_id}/events",
        query={"filter": f"update_id = '{update_id}'", "max_results": 250},
    )
    flows: dict[str, dict[str, Any]] = {}
    for event in page.get("events", []):
        if event.get("event_type") != "flow_progress":
            continue
        progress = (event.get("details") or {}).get("flow_progress") or {}
        metrics = progress.get("metrics") or {}
        quality = progress.get("data_quality") or {}
        if "num_output_rows" not in metrics and not quality:
            continue
        name = ((event.get("origin") or {}).get("flow_name") or "").split(".")[-1]
        flow = flows.setdefault(name, {"flow": name, "rowsWritten": 0, "droppedRecords": 0, "expectations": {}})
        flow["rowsWritten"] += int(metrics.get("num_output_rows") or 0)
        flow["droppedRecords"] += int(quality.get("dropped_records") or 0)
        for item in quality.get("expectations") or []:
            totals = flow["expectations"].setdefault(item["name"], {"name": item["name"], "passed": 0, "failed": 0})
            totals["passed"] += int(item.get("passed_records") or 0)
            totals["failed"] += int(item.get("failed_records") or 0)
    return [
        {**flow, "expectations": sorted(flow["expectations"].values(), key=lambda item: item["name"])}
        for flow in sorted(flows.values(), key=lambda flow: flow["flow"])
    ]


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


# --- Gateway control: turn a guide's classic-compute pipeline (a Lakeflow Connect gateway) on and off ---

# Pipeline states while the gateway's cluster is up or coming up, and update states before it runs.
GATEWAY_ON_STATES = {"DEPLOYING", "STARTING", "RECOVERING", "RESETTING", "RUNNING"}
GATEWAY_STARTING_UPDATES = {"CREATED", "QUEUED", "INITIALIZING", "WAITING_FOR_RESOURCES", "SETTING_UP_TABLES", "RESETTING"}


def gateway_config(slug: str) -> dict[str, Any]:
    config = guide_entry(slug).get("gatewayControl")
    if not config:
        raise HTTPException(status_code=404, detail="This guide has no gateway control")
    return config


def gateway_for(w, config: dict[str, Any]) -> str:
    """The gateway pipeline ID, from the deployed job's parameter that names it."""
    found = directory.jobs(w).get(config["jobKey"])
    if not found:
        raise HTTPException(status_code=404, detail="The reference job is not deployed in this workspace")
    parameters = w.jobs.get(job_id=found["jobId"]).settings.parameters or []
    pipeline_id = next((p.default for p in parameters if p.name == config["pipelineParameter"]), None)
    if not pipeline_id:
        raise HTTPException(status_code=404, detail=f"The job has no {config['pipelineParameter']} parameter")
    return pipeline_id


def gateway_state(w, pipeline_id: str) -> dict[str, Any]:
    pipeline = w.pipelines.get(pipeline_id=pipeline_id)
    state = pipeline.state.value if pipeline.state else "IDLE"
    latest = (pipeline.latest_updates or [None])[0]
    update_state = latest.state.value if latest and latest.state else None
    starting = state in GATEWAY_ON_STATES - {"RUNNING"} or (state != "RUNNING" and update_state in GATEWAY_STARTING_UPDATES)
    host = w.config.host.rstrip("/")
    return {
        "pipelineId": pipeline_id,
        "name": pipeline.name,
        "state": state,
        "updateState": update_state,
        "on": state in GATEWAY_ON_STATES or starting,
        "transitioning": starting or state == "STOPPING",
        "pipelineUrl": f"{host}/pipelines/{pipeline_id}",
    }


@router.get("/artifacts/{slug}/gateway")
def get_gateway(slug: str) -> dict[str, Any]:
    config = gateway_config(slug)
    w = workspace_client()
    return gateway_state(w, gateway_for(w, config))


class GatewayRequest(BaseModel):
    action: str


@router.post("/artifacts/{slug}/gateway")
def set_gateway(slug: str, request: GatewayRequest) -> dict[str, Any]:
    if request.action not in {"start", "stop"}:
        raise HTTPException(status_code=400, detail="action must be start or stop")
    config = gateway_config(slug)
    w = workspace_client()
    pipeline_id = gateway_for(w, config)
    current = gateway_state(w, pipeline_id)
    try:
        if request.action == "start" and not current["on"]:
            w.pipelines.start_update(pipeline_id=pipeline_id)
        elif request.action == "stop" and current["on"]:
            w.pipelines.stop(pipeline_id=pipeline_id)  # returns at once; the page polls until the cluster is released
    except Exception as error:
        logger.warning("Gateway %s failed for %s: %s", request.action, slug, error)
        raise HTTPException(
            status_code=502, detail=f"Could not {request.action} the gateway. Check the app's run permission on the pipeline."
        ) from error
    return gateway_state(w, pipeline_id)
