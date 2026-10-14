"""Grant an additional app service principal access to the deployed reference jobs. Idempotent.

    python scripts/grant_reference_access.py --profile <profile> --service-principal <application-id>

Each reference bundle grants one app through its `app_service_principal` variable. When a second
app in the same workspace hosts the guides, run this once (and after redeploying a bundle) to give
it what Quick run and the Auto Loader drop need:
  - CAN_MANAGE_RUN on every job tagged capability_guide_job
  - CAN_RUN on pipelines those jobs run
  - USE CATALOG, USE SCHEMA, READ VOLUME, and WRITE VOLUME on each pipeline's landing volume
"""

from __future__ import annotations

import argparse

from databricks.sdk import WorkspaceClient
from databricks.sdk.service import catalog, iam

JOB_TAG = "capability_guide_job"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--profile", required=True)
    parser.add_argument("--service-principal", required=True, help="application ID of the app's service principal")
    args = parser.parse_args()

    w = WorkspaceClient(profile=args.profile)
    principal = args.service_principal
    pipelines: set[str] = set()

    for job in w.jobs.list(expand_tasks=True):
        tags = (job.settings.tags or {}) if job.settings else {}
        if JOB_TAG not in tags:
            continue
        w.permissions.update(
            "jobs",
            str(job.job_id),
            access_control_list=[
                iam.AccessControlRequest(
                    service_principal_name=principal, permission_level=iam.PermissionLevel.CAN_MANAGE_RUN
                )
            ],
        )
        print(f"job {job.job_id} {tags[JOB_TAG]}: CAN_MANAGE_RUN")
        pipelines.update(task.pipeline_task.pipeline_id for task in job.settings.tasks or [] if task.pipeline_task)

    for pipeline_id in sorted(pipelines):
        w.permissions.update(
            "pipelines",
            pipeline_id,
            access_control_list=[
                iam.AccessControlRequest(service_principal_name=principal, permission_level=iam.PermissionLevel.CAN_RUN)
            ],
        )
        landing = (w.pipelines.get(pipeline_id=pipeline_id).spec.configuration or {}).get("landing_events_path", "")
        parts = landing.strip("/").split("/")  # Volumes/<catalog>/<schema>/<volume>/...
        if len(parts) < 4 or parts[0] != "Volumes":
            print(f"pipeline {pipeline_id}: CAN_RUN (no landing volume)")
            continue
        cat, schema, volume = parts[1], parts[2], parts[3]
        grants = [
            (catalog.SecurableType.CATALOG, cat, [catalog.Privilege.USE_CATALOG]),
            (catalog.SecurableType.SCHEMA, f"{cat}.{schema}", [catalog.Privilege.USE_SCHEMA]),
            (catalog.SecurableType.VOLUME, f"{cat}.{schema}.{volume}", [catalog.Privilege.READ_VOLUME, catalog.Privilege.WRITE_VOLUME]),
        ]
        for securable, name, privileges in grants:
            w.grants.update(
                securable_type=securable.value,
                full_name=name,
                changes=[catalog.PermissionsChange(principal=principal, add=privileges)],
            )
        print(f"pipeline {pipeline_id}: CAN_RUN; volume {cat}.{schema}.{volume}: READ, WRITE")


if __name__ == "__main__":
    main()
