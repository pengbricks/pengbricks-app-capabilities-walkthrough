"""Find a guide's deployed job or pipeline, for links and for notebooks run on their own."""

from __future__ import annotations

from guide_params import JOB_TAG


def find_job(w, job_key: str):
    """The deployed job tagged capability_guide_job=<job_key>, or None."""
    for job in w.jobs.list():
        tags = (job.settings.tags or {}) if job.settings else {}
        if tags.get(JOB_TAG) == job_key:
            return job
    return None


def find_pipeline_id(w, name: str) -> str | None:
    """Id of the pipeline whose name ends with `name` (development mode adds a prefix)."""
    for pipeline in w.pipelines.list_pipelines(filter=f"name LIKE '%{name}'"):
        if (pipeline.name or "").endswith(name):
            return pipeline.pipeline_id
    return None


def guide_links_html(w, job_keys: list[str], pipeline_names: list[str] = ()) -> str:
    """HTML list of links to the guide's jobs and pipelines in this workspace."""
    host = w.config.host.rstrip("/")
    items = []
    for key in job_keys:
        job = find_job(w, key)
        if job:
            items.append(f'<li>Job <a href="{host}/jobs/{job.job_id}" target="_blank">{job.settings.name}</a></li>')
        else:
            items.append(f"<li>Job {key}: not deployed in this workspace</li>")
    for name in pipeline_names:
        pipeline_id = find_pipeline_id(w, name)
        if pipeline_id:
            items.append(f'<li>Pipeline <a href="{host}/pipelines/{pipeline_id}" target="_blank">{name}</a></li>')
        else:
            items.append(f"<li>Pipeline {name}: not deployed in this workspace</li>")
    return "<ul>" + "".join(items) + "</ul>"
