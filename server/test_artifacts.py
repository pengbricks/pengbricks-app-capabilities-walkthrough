from __future__ import annotations

import importlib.util
import io
import zipfile
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
        if guide.get("download"):
            paths.append(guide["download"]["path"])
        missing = [path for path in paths if not (ROOT / path).exists()]
        assert not missing, f"{slug}: {missing}"


def test_snippets_are_current() -> None:
    builder = load_snippet_builder()
    assert builder.OUTPUT.read_text(encoding="utf-8") == builder.build()
    assert builder.SAMPLES_OUTPUT.read_text(encoding="utf-8") == builder.build_samples()


def test_downloads_are_current() -> None:
    builder = load_snippet_builder()
    built = builder.build_downloads()
    assert built, "no guide offers a download"
    for name, data in built.items():
        assert builder.stored_path(name).read_bytes() == data, f"{name} is stale. Run: python scripts/build_artifact_snippets.py"
    # Stored as <name>.bin: workspace file import would unpack a .zip instead of uploading it.
    assert {path.name for path in builder.DOWNLOADS_DIR.iterdir()} == {builder.stored_path(name).name for name in built}


def test_download_zip_is_deterministic_and_leaves_out_local_state(tmp_path, monkeypatch) -> None:
    builder = load_snippet_builder()
    folder = tmp_path / "bundle"
    (folder / ".databricks").mkdir(parents=True)
    (folder / "__pycache__").mkdir()
    (folder / "resources").mkdir()
    for name in ["databricks.yml", ".databricks/state.json", "__pycache__/a.pyc", ".DS_Store", "resources/keep.yml", "resources/skip.yml"]:
        (folder / name).write_text("x\n")
    monkeypatch.setattr(builder, "ROOT", tmp_path)
    config = {"path": "bundle", "filename": "starter.zip", "exclude": ["resources/skip.yml"]}

    first = builder.build_download(config)
    (folder / "databricks.yml").touch()  # a new mtime must not change the bytes
    assert builder.build_download(config) == first
    names = zipfile.ZipFile(io.BytesIO(first)).namelist()
    assert names == ["starter/databricks.yml", "starter/resources/keep.yml"]


def test_download_is_only_offered_where_configured() -> None:
    assert client.get("/api/capability-guides/artifacts/monitoring/download").status_code == 404
    assert client.get("/api/capability-guides/artifacts/not-a-guide/download").status_code == 404
    assert client.get("/api/capability-guides/artifacts/monitoring").json()["download"] is None


def test_download_returns_the_starter_bundle_as_a_zip() -> None:
    response = client.get("/api/capability-guides/artifacts/dab-starter/download")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert 'filename="dab-starter.zip"' in response.headers["content-disposition"]
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    assert archive.testzip() is None
    names = archive.namelist()
    assert "dab-starter/databricks.yml" in names
    assert {"dab-starter/examples/app.app.yml", "dab-starter/examples/lakebase.postgres.yml", "dab-starter/examples/dashboard.dashboard.yml", "dab-starter/examples/genie.genie_space.yml", "dab-starter/examples/app/app.py"} <= set(names)
    assert not any(".databricks/" in name or "__pycache__" in name or name.endswith(".pyc") for name in names)
    assert "dab-starter/resources/app_access.yml" not in names

    info = client.get("/api/capability-guides/artifacts/dab-starter").json()["download"]
    assert info == {"filename": "dab-starter.zip", "sizeBytes": len(response.content)}


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


def test_recorded_folder_is_offered_without_workspace(monkeypatch) -> None:
    def unavailable():
        raise RuntimeError("no credentials")

    monkeypatch.setattr(artifacts, "workspace_client", unavailable)
    body = client.get("/api/capability-guides/artifacts/ai-functions").json()

    assert body["live"] is False
    assert body["recordedFolder"]["url"].startswith("https://fevm-rpeng-demobricks.cloud.databricks.com/browse/folders/")
    assert "/editor/notebooks/" in body["recordedFolder"]["startHereUrl"]


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
        jobs=SimpleNamespace(list=lambda **_: [job], list_runs=lambda job_id, limit: [run]),
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
        jobs=SimpleNamespace(list=lambda **_: [job], get=lambda job_id: full_job),
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


def test_workspace_links_point_at_the_deployed_code_and_pipelines(monkeypatch) -> None:
    root = "/Workspace/Users/someone/.bundle/capability-guides-ingestion/dev"
    settings = SimpleNamespace(
        name="streaming",
        tags={"capability_guide_job": "capability_guides_batch_real_time"},
        deployment=SimpleNamespace(metadata_file_path=f"{root}/state/metadata.json"),
        tasks=[SimpleNamespace(pipeline_task=SimpleNamespace(pipeline_id="p1")), SimpleNamespace(pipeline_task=None)],
    )
    guide_dir = f"{root}/files/guides/batch-real-time-ingestion"
    folders = {f"{root}/files": ("DIRECTORY", 11), guide_dir: ("DIRECTORY", 13), f"{guide_dir}/00_start_here": ("NOTEBOOK", 14)}

    def get_status(path):
        kind, object_id = folders.get(path, ("FILE", 12))
        return SimpleNamespace(object_type=SimpleNamespace(value=kind), object_id=object_id)

    fake = SimpleNamespace(
        config=SimpleNamespace(host="https://workspace.example.com"),
        jobs=SimpleNamespace(list=lambda **_: [SimpleNamespace(job_id=42, settings=settings)], list_runs=lambda job_id, limit: []),
        workspace=SimpleNamespace(get_status=get_status),
        pipelines=SimpleNamespace(get=lambda pipeline_id: SimpleNamespace(name="[dev someone] streaming pipeline")),
    )
    monkeypatch.setattr(artifacts, "workspace_client", lambda: fake)
    monkeypatch.setattr(artifacts, "directory", artifacts.JobDirectory())

    links = client.get("/api/capability-guides/artifacts/batch-real-time-ingestion").json()["workspace"]

    assert links["folder"] == {"label": "Guide folder", "path": guide_dir, "url": "https://workspace.example.com/browse/folders/13"}
    assert links["startHere"]["url"] == "https://workspace.example.com/editor/notebooks/14"
    assert links["files"] and all(item["url"] == "https://workspace.example.com/editor/files/12" for item in links["files"])
    assert links["pipelines"] == [{"label": "streaming pipeline", "url": "https://workspace.example.com/pipelines/p1"}]


def fake_gateway_workspace(state: str, update_state: str | None, calls: list[str]):
    """A workspace with the Lakeflow Connect job deployed and a gateway pipeline in the given state."""
    job = SimpleNamespace(job_id=11, settings=SimpleNamespace(name="lfc", tags={"capability_guide_job": "capability_guides_lakeflow_connect"}))
    parameters = [SimpleNamespace(name="catalog", default="main"), SimpleNamespace(name="gateway_pipeline_id", default="gw1")]
    status = {"state": state}

    def get_pipeline(pipeline_id):
        latest = [SimpleNamespace(state=SimpleNamespace(value=update_state))] if update_state else []
        return SimpleNamespace(name="lfc-gateway", state=SimpleNamespace(value=status["state"]), latest_updates=latest)

    def start_update(pipeline_id):
        calls.append(f"start {pipeline_id}")
        status["state"] = "STARTING"

    def stop(pipeline_id):
        calls.append(f"stop {pipeline_id}")
        status["state"] = "STOPPING"

    return SimpleNamespace(
        config=SimpleNamespace(host="https://workspace.example.com"),
        jobs=SimpleNamespace(list=lambda **_: [job], get=lambda job_id: SimpleNamespace(settings=SimpleNamespace(parameters=parameters))),
        pipelines=SimpleNamespace(get=get_pipeline, start_update=start_update, stop=stop),
    )


def test_gateway_control_is_only_offered_where_configured() -> None:
    assert client.get("/api/capability-guides/artifacts/monitoring/gateway").status_code == 404


def test_gateway_turns_on_and_off(monkeypatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(artifacts, "workspace_client", lambda: fake_gateway_workspace("IDLE", None, calls))
    monkeypatch.setattr(artifacts, "directory", artifacts.JobDirectory())
    url = "/api/capability-guides/artifacts/sqlserver-lakeflow-connect/gateway"

    off = client.get(url).json()
    assert off["on"] is False and off["pipelineUrl"] == "https://workspace.example.com/pipelines/gw1"

    on = client.post(url, json={"action": "start"}).json()
    assert calls == ["start gw1"] and on["on"] is True and on["transitioning"] is True


def test_gateway_stop_is_a_no_op_when_already_off(monkeypatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(artifacts, "workspace_client", lambda: fake_gateway_workspace("IDLE", "CANCELED", calls))
    monkeypatch.setattr(artifacts, "directory", artifacts.JobDirectory())
    url = "/api/capability-guides/artifacts/sqlserver-lakeflow-connect/gateway"

    assert client.post(url, json={"action": "stop"}).json()["on"] is False
    assert calls == []
    assert client.post(url, json={"action": "reboot"}).status_code == 400


def test_gateway_stop_turns_a_running_gateway_off(monkeypatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(artifacts, "workspace_client", lambda: fake_gateway_workspace("RUNNING", "RUNNING", calls))
    monkeypatch.setattr(artifacts, "directory", artifacts.JobDirectory())

    body = client.post("/api/capability-guides/artifacts/sqlserver-lakeflow-connect/gateway", json={"action": "stop"}).json()
    assert calls == ["stop gw1"] and body["state"] == "STOPPING" and body["transitioning"] is True
