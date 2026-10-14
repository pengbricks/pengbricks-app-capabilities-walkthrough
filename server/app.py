from __future__ import annotations

import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parents[1]
CLIENT_DIST = ROOT / "client" / "runtime"
ASSETS_DIR = CLIENT_DIST / "assets"
APP_PREFIX = "/capability-guides"
API_PREFIX = "/api/capability-guides"

app = FastAPI(
    title="Capability Atlas API",
    description="FastAPI backend for the public Databricks capability guide walkthrough.",
    version="1.0.0",
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", response_class=RedirectResponse)
async def root() -> RedirectResponse:
    return RedirectResponse(url=f"{APP_PREFIX}/", status_code=302)


@app.get(f"{API_PREFIX}/health")
async def api_health() -> dict[str, str]:
    return {"status": "ok", "service": "capability-atlas"}


if ASSETS_DIR.exists():
    app.mount(f"{APP_PREFIX}/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get(APP_PREFIX, response_class=FileResponse)
@app.get(f"{APP_PREFIX}/{{requested_path:path}}", response_class=FileResponse)
async def serve_frontend(requested_path: str = "") -> FileResponse:
    if not CLIENT_DIST.exists():
        raise HTTPException(status_code=503, detail="Frontend build not found. Run npm run build:client.")

    candidate = (CLIENT_DIST / requested_path).resolve()
    if candidate.is_relative_to(CLIENT_DIST.resolve()) and candidate.is_file():
        return FileResponse(candidate)

    return FileResponse(CLIENT_DIST / "index.html")


def main() -> None:
    port = int(os.environ.get("DATABRICKS_APP_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
