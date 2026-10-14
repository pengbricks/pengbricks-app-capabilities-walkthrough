"""Create or update the Model Serving endpoint: small, scale-to-zero, route optimized if available."""

from __future__ import annotations

import argparse
import time

import yaml


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--endpoint-name", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()

    from databricks.sdk import WorkspaceClient
    from databricks.sdk.errors import DatabricksError, NotFound
    from databricks.sdk.runtime import dbutils
    from databricks.sdk.service.serving import EndpointCoreConfigInput, ServedEntityInput

    with open(args.use_case_file) as handle:
        spec = yaml.safe_load(handle)
    settings = spec["endpoint"]

    model_name = dbutils.jobs.taskValues.get(taskKey="train_register", key="model_name")
    version = dbutils.jobs.taskValues.get(taskKey="train_register", key="model_version")
    w = WorkspaceClient()

    config = EndpointCoreConfigInput(
        name=args.endpoint_name,
        served_entities=[
            ServedEntityInput(
                name="scorer",
                entity_name=model_name,
                entity_version=version,
                workload_size=settings["workload_size"],
                scale_to_zero_enabled=bool(settings["scale_to_zero"]),
            )
        ]
    )

    action = "updated"
    route_optimized = False
    try:
        existing = w.serving_endpoints.get(args.endpoint_name)
        route_optimized = bool(existing.route_optimized)
        w.serving_endpoints.update_config(name=args.endpoint_name, served_entities=config.served_entities)
        print(f"Updating existing endpoint {args.endpoint_name} to version {version}")
    except NotFound:
        action = "created"
        wanted = bool(settings.get("route_optimized"))
        try:
            w.serving_endpoints.create(name=args.endpoint_name, config=config, route_optimized=wanted)
            route_optimized = wanted
        except DatabricksError as error:
            if not wanted:
                raise
            print(f"Route optimization unavailable ({error}); creating without it")
            w.serving_endpoints.create(name=args.endpoint_name, config=config)
        print(f"Creating endpoint {args.endpoint_name} (route_optimized={route_optimized})")

    deadline = time.time() + int(settings["ready_timeout_seconds"])
    started = time.time()
    while True:
        endpoint = w.serving_endpoints.get(args.endpoint_name)
        ready = str(endpoint.state.ready).split(".")[-1]
        update = str(endpoint.state.config_update).split(".")[-1]
        print(f"state ready={ready} config_update={update}")
        if ready == "READY" and update == "NOT_UPDATING":
            break
        if update in ("UPDATE_FAILED", "UPDATE_CANCELED") or time.time() > deadline:
            raise RuntimeError(f"Endpoint did not become ready: ready={ready} config_update={update}")
        time.sleep(20)

    entity = endpoint.config.served_entities[0]
    info = {
        "endpoint_name": args.endpoint_name,
        "action": action,
        "model_version": version,
        "workload_size": str(entity.workload_size),
        "scale_to_zero": bool(entity.scale_to_zero_enabled),
        "route_optimized": bool(endpoint.route_optimized),
        "endpoint_url": endpoint.endpoint_url,
        "seconds_to_ready": round(time.time() - started),
    }
    print(info)
    for key, value in info.items():
        dbutils.jobs.taskValues.set(key=key, value=value)


if __name__ == "__main__":
    main()
