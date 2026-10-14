"""Deploy the registered agent to a small scale-to-zero Model Serving endpoint and wait for READY."""

import argparse
import sys
import time

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
p.add_argument("--version", required=True)
p.add_argument("--endpoint-name", default="")
p.add_argument("--experiment-id", default="")
p.add_argument("--release", default="local")
args = p.parse_args()
sys.path.insert(0, args.src_dir)

import agents_common as ac
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.runtime import dbutils

READY_TIMEOUT_S = 45 * 60


def state(w: WorkspaceClient, name: str) -> dict:
    return w.api_client.do("GET", f"/api/2.0/serving-endpoints/{name}")


def main() -> None:
    spec = ac.load_spec(args.spec)
    build = spec["build"]
    name = args.endpoint_name or build["endpoint_name"]
    model_name = ac.qualified(args.catalog, args.schema, build["model_name"])
    w = WorkspaceClient()
    entity = {
        "name": "assistant",
        "entity_name": model_name,
        "entity_version": args.version,
        "workload_size": build["workload_size"],
        "scale_to_zero_enabled": ac.to_bool(build["scale_to_zero"]),
        "environment_vars": {"ENABLE_MLFLOW_TRACING": "true", **({"MLFLOW_EXPERIMENT_ID": args.experiment_id} if args.experiment_id else {})},
    }
    config = {"served_entities": [entity], "traffic_config": {"routes": [{"served_model_name": "assistant", "traffic_percentage": 100}]}}
    tags = [{"key": "capability_guide", "value": "agent-build-deployment"}, {"key": "release", "value": args.release}]
    try:
        state(w, name)
        w.api_client.do("PUT", f"/api/2.0/serving-endpoints/{name}/config", body=config)
        print(f"Updating endpoint {name} to version {args.version}")
    except NotFound:
        w.api_client.do("POST", "/api/2.0/serving-endpoints", body={"name": name, "config": config, "tags": tags})
        print(f"Creating endpoint {name} with version {args.version}")

    deadline = time.time() + READY_TIMEOUT_S
    started = time.time()
    while time.time() < deadline:
        s = state(w, name)["state"]
        print(f"endpoint {name}: ready={s.get('ready')} config_update={s.get('config_update')}")
        if s.get("config_update") == "UPDATE_FAILED":
            raise SystemExit(f"Endpoint update failed: {s}")
        if s.get("ready") == "READY" and s.get("config_update") == "NOT_UPDATING":
            break
        time.sleep(30)
    else:
        raise SystemExit(f"Endpoint {name} not READY after {READY_TIMEOUT_S}s")
    dbutils.jobs.taskValues.set(key="endpoint", value=name)
    dbutils.jobs.taskValues.set(key="ready_seconds", value=round(time.time() - started))


main()
