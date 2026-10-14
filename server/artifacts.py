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

    try:
        store.record(records)
        response["history"] = [
            {**row, "started_at": row["started_at"].isoformat() if row["started_at"] else None}
            for row in store.history(slug)
        ]
    except Exception as error:
        logger.warning("Lakebase run tracking failed for %s: %s", slug, error)
        response["tracking"] = "jobs-api"
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
