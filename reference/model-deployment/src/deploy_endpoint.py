"""Deploy @champion to a small scale-to-zero Model Serving endpoint, wait for READY, and score once."""

import argparse
import sys
import time

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
p.add_argument("--promoted", required=True)
p.add_argument("--champion-alias", default="champion")
p.add_argument("--endpoint-name", required=True)
p.add_argument("--workload-size", default="Small")
p.add_argument("--scale-to-zero", default="true")
p.add_argument("--release", default="local")
args = p.parse_args()
sys.path.insert(0, args.src_dir)

import mlflow
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.runtime import dbutils, spark
from mlflow.tracking import MlflowClient

import common

READY_TIMEOUT_S = 40 * 60


def set_outputs(status: str, endpoint: str = "", served_version: str = "", latency_ms: float = 0.0) -> None:
    for key, value in {
        "status": status,
        "endpoint": endpoint,
        "served_version": served_version,
        "latency_ms": round(latency_ms, 1),
    }.items():
        dbutils.jobs.taskValues.set(key=key, value=value)


def endpoint_state(w: WorkspaceClient, name: str) -> dict:
    return w.api_client.do("GET", f"/api/2.0/serving-endpoints/{name}")


def wait_ready(w: WorkspaceClient, name: str) -> dict:
    deadline = time.time() + READY_TIMEOUT_S
    while time.time() < deadline:
        state = endpoint_state(w, name)["state"]
        ready, update = state.get("ready"), state.get("config_update")
        print(f"endpoint {name}: ready={ready} config_update={update}")
        if update == "UPDATE_FAILED":
            raise SystemExit(f"Endpoint update failed: {state}")
        if ready == "READY" and update == "NOT_UPDATING":
            return endpoint_state(w, name)
        time.sleep(30)
    raise SystemExit(f"Endpoint {name} not READY after {READY_TIMEOUT_S}s")


def main() -> None:
    if not common.to_bool(args.promoted):
        print("Not promoted: skipping deployment.")
        set_outputs("not_promoted")
        return

    spec = common.load_spec(args.spec)
    model_name = common.full_model_name(args.catalog, args.schema, spec)
    mlflow.set_registry_uri("databricks-uc")
    version = str(MlflowClient(registry_uri="databricks-uc").get_model_version_by_alias(model_name, args.champion_alias).version)

    w = WorkspaceClient()
    entity = {
        "name": "champion",
        "entity_name": model_name,
        "entity_version": version,
        "workload_size": args.workload_size,
        "scale_to_zero_enabled": common.to_bool(args.scale_to_zero),
    }
    config = {
        "served_entities": [entity],
        "traffic_config": {"routes": [{"served_model_name": "champion", "traffic_percentage": 100}]},
    }
    try:
        current = endpoint_state(w, args.endpoint_name)
        served = {s.get("entity_version") for s in current.get("config", {}).get("served_entities", [])}
        if served == {version}:
            print(f"Endpoint already serves version {version}")
        else:
            w.api_client.do("PUT", f"/api/2.0/serving-endpoints/{args.endpoint_name}/config", body=config)
            print(f"Updating endpoint to version {version}")
    except NotFound:
        w.api_client.do(
            "POST",
            "/api/2.0/serving-endpoints",
            body={
                "name": args.endpoint_name,
                "config": config,
                "tags": [{"key": "release", "value": args.release}, {"key": "capability_guide", "value": "model-deployment-cicd"}],
            },
        )
        print(f"Creating endpoint {args.endpoint_name} with version {version}")

    wait_ready(w, args.endpoint_name)

    features = spec["features"]
    row = spark.table(common.training_table(args.catalog, args.schema, spec)).select(*features).limit(1).toPandas()
    body = {"dataframe_records": row.to_dict(orient="records")}
    latencies = []
    for attempt in range(2):  # first call may include a cold start; second is warm
        start = time.perf_counter()
        for retry in range(5):
            try:
                result = w.api_client.do("POST", f"/serving-endpoints/{args.endpoint_name}/invocations", body=body)
                break
            except Exception as exc:  # cold start can return 503 briefly
                print(f"query retry {retry}: {exc}")
                time.sleep(20)
        else:
            raise SystemExit("Scoring request failed")
        latencies.append((time.perf_counter() - start) * 1000)
        print(f"request {attempt + 1}: {latencies[-1]:.0f} ms -> {result}")

    set_outputs("deployed", args.endpoint_name, version, latencies[-1])
    print(f"Deployed version {version}. First request {latencies[0]:.0f} ms, second {latencies[1]:.0f} ms")


main()
