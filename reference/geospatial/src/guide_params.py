"""Notebook variables that work the same inside a job and in a standalone run.

Every guide notebook starts with:

    from guide_params import load_params
    params = load_params(dbutils, "capability_guides_<job>", ["catalog", "schema", "use_case"])

Inside the job, the job's parameters fill the widgets. Run on its own, a blank widget takes the
default of the deployed job's parameter with the same name, so Run all works without editing
anything. Type a value into a widget to override it for one run.

This file is copied into each bundle's src/. reference/_shared is the source of truth, and
test_guide_params.py checks that the copies match.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

JOB_TAG = "capability_guide_job"


def bundle_root(notebook_dir: str | Path | None = None) -> Path:
    """The bundle's files folder: guide notebooks live in <root>/guides/<slug>/."""
    here = Path(notebook_dir) if notebook_dir else Path.cwd()
    for folder in (here, *here.parents):
        if (folder / "databricks.yml").exists() or (folder / "use_cases").is_dir():
            return folder
    return here.parents[1]


def deployed_job_parameters(job_key: str, client_factory: Callable[[], Any] | None = None) -> dict[str, str]:
    """Parameter defaults of the deployed job tagged capability_guide_job=<job_key>, or {} if none."""
    if client_factory is None:
        from databricks.sdk import WorkspaceClient

        client_factory = WorkspaceClient
    w = client_factory()
    for job in w.jobs.list():
        tags = (job.settings.tags or {}) if job.settings else {}
        if tags.get(JOB_TAG) == job_key:
            settings = w.jobs.get(job_id=job.job_id).settings
            return {p.name: p.default for p in settings.parameters or [] if p.default is not None}
    return {}


def load_params(
    dbutils,
    job_key: str,
    names: list[str],
    defaults: dict[str, str] | None = None,
    client_factory: Callable[[], Any] | None = None,
) -> dict[str, str]:
    """Read the notebook's widgets, filling blanks from the deployed job, then from `defaults`."""
    defaults = defaults or {}
    for name in names:
        dbutils.widgets.text(name, "")
    values = {name: dbutils.widgets.get(name).strip() for name in names}
    if any(not value for value in values.values()):
        job_defaults = deployed_job_parameters(job_key, client_factory)
        for name, value in values.items():
            if not value:
                values[name] = str(job_defaults.get(name) or defaults.get(name, ""))
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise ValueError(
            f"Set the {', '.join(missing)} widget(s): no deployed job tagged {job_key} supplies a default. "
            "Deploy the bundle first, or type the values into the widgets."
        )
    for name, value in values.items():
        print(f"{name} = {value}")
    return values
