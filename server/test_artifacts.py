from __future__ import annotations

import importlib.util
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

from server import artifacts
from server.app import app

ROOT = Path(__file__).resolve().parents[1]
client = TestClient(app)


def load_snippet_builder():
    spec = importlib.util.spec_from_file_location("build_artifact_snippets", ROOT / "scripts" / "build_artifact_snippets.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_every_artifact_path_exists() -> None:
    for slug, guide in artifacts.load_index()["guides"].items():
        paths = [
            guide["onePager"],
            *(item["path"] for item in guide["code"] + guide.get("highlights", []) + guide.get("walkthroughs", [])),
        ]
        missing = [path for path in paths if not (ROOT / path).exists()]
        assert not missing, f"{slug}: {missing}"


def test_snippets_are_current() -> None:
    builder = load_snippet_builder()
    assert builder.OUTPUT.read_text(encoding="utf-8") == builder.build()
    assert builder.SAMPLES_OUTPUT.read_text(encoding="utf-8") == builder.build_samples()


def test_artifacts_fall_back_to_static_links_without_workspace(monkeypatch) -> None:
    def unavailable():
        raise RuntimeError("no credentials")

    monkeypatch.setattr(artifacts, "workspace_client", unavailable)
    response = client.get("/api/capability-guides/artifacts/configuration-vs-code")

    assert response.status_code == 200
    body = response.json()
    assert body["live"] is False
    assert body["code"][0]["url"].startswith("https://github.com/pengbricks/")
    assert body["docs"] and body["highlights"][0]["code"]


def test_live_runs_are_found_by_tag(monkeypatch) -> None:
    job = SimpleNamespace(job_id=42, settings=SimpleNamespace(name="ingest", tags={"capability_guide_job": "capability_guides_ingestion_framework"}))
    run = SimpleNamespace(
        run_id=7,
        run_page_url="https://workspace.example.com/?o=1#job/42/run/7",
        state=SimpleNamespace(life_cycle_state=SimpleNamespace(value="TERMINATED"), result_state=SimpleNamespace(value="SUCCESS")),
        trigger=SimpleNamespace(value="ONE_TIME"),
        start_time=1_760_000_000_000,
    )
    fake = SimpleNamespace(
        config=SimpleNamespace(host="https://workspace.example.com/"),
        jobs=SimpleNamespace(list=lambda: [job], list_runs=lambda job_id, limit: [run]),
    )
    monkeypatch.setattr(artifacts, "workspace_client", lambda: fake)
    monkeypatch.setattr(artifacts, "directory", artifacts.JobDirectory())

    body = client.get("/api/capability-guides/artifacts/configuration-vs-code").json()

    assert body["live"] is True
    assert body["jobs"][0]["jobUrl"] == "https://workspace.example.com/jobs/42"
    assert body["jobs"][0]["runs"][0]["url"] == "https://workspace.example.com/jobs/42/runs/7"


def test_quick_run_rejects_jobs_outside_the_guide() -> None:
    response = client.post(
        "/api/capability-guides/artifacts/configuration-vs-code/quick-run",
        json={"jobKey": "capability_guides_rollback"},
    )
    assert response.status_code == 400


def test_unknown_guide_is_404() -> None:
    assert client.get("/api/capability-guides/artifacts/not-a-guide").status_code == 404


def test_drop_rejects_invalid_json() -> None:
    response = client.post("/api/capability-guides/artifacts/batch-real-time-ingestion/drop", json={"content": "{not json"})
    assert response.status_code == 400


def test_drop_is_only_offered_where_configured() -> None:
    assert client.get("/api/capability-guides/artifacts/monitoring/drop").status_code == 404
    samples = client.get("/api/capability-guides/artifacts/batch-real-time-ingestion/drop").json()["samples"]
    assert [sample["label"] for sample in samples] == ["Valid event", "Event that fails expectations"]


def test_drop_writes_to_the_pipeline_landing_path_and_starts_an_update(monkeypatch) -> None:
    uploads = []
    job = SimpleNamespace(job_id=9, settings=SimpleNamespace(name="brt", tags={"capability_guide_job": "capability_guides_batch_real_time"}))
    full_job = SimpleNamespace(settings=SimpleNamespace(tasks=[SimpleNamespace(pipeline_task=None), SimpleNamespace(pipeline_task=SimpleNamespace(pipeline_id="p1"))]))
    fake = SimpleNamespace(
        config=SimpleNamespace(host="https://workspace.example.com"),
        jobs=SimpleNamespace(list=lambda: [job], get=lambda job_id: full_job),
        pipelines=SimpleNamespace(
            get=lambda pipeline_id: SimpleNamespace(spec=SimpleNamespace(configuration={"landing_events_path": "/Volumes/c/s/landing/events/"})),
            start_update=lambda pipeline_id: SimpleNamespace(update_id="u1"),
        ),
        files=SimpleNamespace(upload=lambda path, stream, overwrite: uploads.append((path, stream.read().decode()))),
    )
    monkeypatch.setattr(artifacts, "workspace_client", lambda: fake)
    monkeypatch.setattr(artifacts, "directory", artifacts.JobDirectory())

    body = client.post(
        "/api/capability-guides/artifacts/batch-real-time-ingestion/drop",
        json={"content": '{"event_id": "E1", "amount": 1}'},
    ).json()

    path, written = uploads[0]
    assert path.startswith("/Volumes/c/s/landing/events/app-drops/drop-")
    assert '"event_ts"' in written
    assert body["updateUrl"] == "https://workspace.example.com/pipelines/p1/updates/u1"
