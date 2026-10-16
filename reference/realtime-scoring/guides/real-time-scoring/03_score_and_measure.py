# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Score the endpoint and measure it
# MAGIC
# MAGIC Authentication goes through the Databricks SDK: `WorkspaceClient().config.authenticate()` returns the bearer header for the identity running the notebook. Nothing is read from a secret or a PAT.
# MAGIC
# MAGIC The notebook sends a first request, 50 warm requests, a concurrent burst, and four failure scenarios. It writes `scoring_latency` and `scoring_errors`, replacing any rows for the same `run_id`, so a rerun does not duplicate them. The endpoint must exist: run `02_deploy_endpoint` first.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_realtime_scoring", ['catalog', 'schema', 'use_case', 'endpoint_name', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, endpoint_name, run_id = params["catalog"], params["schema"], params["endpoint_name"], params["run_id"]

import yaml
from scoring_helpers import build_record, dataframe_body, error_cases, summarize
with open(bundle_root() / "use_cases" / f"{params['use_case']}.yml") as handle:
    spec = yaml.safe_load(handle)
features = spec["model"]["features"]
scoring = spec["scoring"]
timeout = int(scoring["request_timeout_seconds"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Find the endpoint and build the auth header
# MAGIC
# MAGIC Route-optimized endpoints take a token scoped to the endpoint: the control-plane OAuth token is exchanged at `/oidc/v1/token` with the endpoint's `authorization_details`.

# COMMAND ----------

import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import requests
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
endpoint = w.serving_endpoints.get(endpoint_name)
route_optimized = bool(endpoint.route_optimized)
query_info = endpoint.data_plane_info.query_info if endpoint.data_plane_info else None
if route_optimized and query_info:
    url = query_info.endpoint_url
else:
    url = f"{w.config.host.rstrip('/')}/serving-endpoints/{endpoint_name}/invocations"
print(f"Scoring {url} (route_optimized={route_optimized})")

data_plane_token = {"value": None}

def auth_headers() -> dict:
    """OAuth bearer for the current identity, via the SDK."""
    control_plane = w.config.authenticate()
    if not (route_optimized and query_info):
        return control_plane
    if data_plane_token["value"] is None:
        response = requests.post(
            f"{w.config.host.rstrip('/')}/oidc/v1/token",
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "authorization_details": query_info.authorization_details,
                "assertion": control_plane["Authorization"].split(" ", 1)[1],
            },
            timeout=timeout,
        )
        if not response.ok:
            raise RuntimeError(f"Token exchange failed: {response.status_code} {response.text[:400]}")
        data_plane_token["value"] = response.json()["access_token"]
    return {"Authorization": f"Bearer {data_plane_token['value']}"}

def send(body=None, raw=None):
    headers = {**auth_headers(), "Content-Type": "application/json"}
    data = raw if raw is not None else json.dumps(body)
    started = time.perf_counter()
    response = requests.post(url, data=data, headers=headers, timeout=timeout)
    return response, (time.perf_counter() - started) * 1000

now = lambda: datetime.now(timezone.utc).replace(tzinfo=None)  # noqa: E731
latency_rows: list[dict] = []
error_rows: list[dict] = []

def record(phase: str, sequence: int, response, elapsed_ms: float, sent_at) -> None:
    prediction = None
    if response.status_code == 200:
        prediction = json.dumps(response.json().get("predictions"))
    latency_rows.append(
        {
            "run_id": run_id, "phase": phase, "sequence": sequence, "sent_at": sent_at,
            "latency_ms": round(elapsed_ms, 2), "status_code": response.status_code,
            "route_optimized": route_optimized, "prediction": prediction,
        }
    )
    if response.status_code != 200:
        error_rows.append(
            {
                "run_id": run_id, "scenario": f"{phase}_unexpected_error", "description": "Request in a latency phase failed",
                "occurred_at": sent_at, "status_code": response.status_code, "expected_status": 200,
                "error_message": response.text[:500], "handled": False, "outcome": "unexpected",
            }
        )

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. First request
# MAGIC
# MAGIC If the endpoint had scaled to zero, this includes the cold start.

# COMMAND ----------

sent_at = now()
response, elapsed = send(dataframe_body([build_record(features, 0)]))
record("first_request", 0, response, elapsed, sent_at)
print(f"First request: {response.status_code} in {elapsed:.0f} ms")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Sequential warm requests

# COMMAND ----------

warm = []
for i in range(1, int(scoring["warm_requests"]) + 1):
    sent_at = now()
    response, elapsed = send(dataframe_body([build_record(features, i) for _ in range(int(scoring["records_per_request"]))]))
    record("warm", i, response, elapsed, sent_at)
    if response.status_code == 200:
        warm.append(elapsed)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Concurrent burst

# COMMAND ----------

def burst(i: int):
    sent_at = now()
    response, elapsed = send(dataframe_body([build_record(features, 1000 + i)]))
    return i, sent_at, response, elapsed

concurrent = []
with ThreadPoolExecutor(max_workers=int(scoring["concurrency"])) as pool:
    for i, sent_at, response, elapsed in pool.map(burst, range(int(scoring["concurrent_requests"]))):
        record("concurrent", i, response, elapsed, sent_at)
        if response.status_code == 200:
            concurrent.append(elapsed)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Failure behavior
# MAGIC
# MAGIC Each case has an expected status. A mismatch fails the notebook after the tables are written.

# COMMAND ----------

mismatches = []
for case in error_cases(features):
    sent_at = now()
    response, elapsed = send(body=case.get("body"), raw=case.get("raw"))
    expected = case["expected_status"]
    handled = response.status_code == expected
    if not handled:
        mismatches.append(f"{case['scenario']}: expected {expected}, got {response.status_code}")
    outcome = "scored" if response.status_code == 200 else "rejected_with_error"
    error_rows.append(
        {
            "run_id": run_id, "scenario": case["scenario"], "description": case["description"],
            "occurred_at": sent_at, "status_code": response.status_code, "expected_status": expected,
            "error_message": None if response.status_code == 200 else response.text[:500],
            "handled": handled, "outcome": outcome if handled else "unexpected",
        }
    )
    print(f"{case['scenario']}: {response.status_code} ({elapsed:.0f} ms) {response.text[:160]}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the results

# COMMAND ----------

latency_table = f"{catalog}.{schema}.scoring_latency"
error_table = f"{catalog}.{schema}.scoring_errors"
latency_ddl = (
    "run_id STRING, phase STRING, sequence INT, sent_at TIMESTAMP, latency_ms DOUBLE, "
    "status_code INT, route_optimized BOOLEAN, prediction STRING"
)
error_ddl = (
    "run_id STRING, scenario STRING, description STRING, occurred_at TIMESTAMP, status_code INT, "
    "expected_status INT, error_message STRING, handled BOOLEAN, outcome STRING"
)
spark.sql(f"CREATE TABLE IF NOT EXISTS {latency_table} ({latency_ddl})")
spark.sql(f"CREATE TABLE IF NOT EXISTS {error_table} ({error_ddl})")
spark.sql(f"DELETE FROM {latency_table} WHERE run_id = '{run_id}'")
spark.sql(f"DELETE FROM {error_table} WHERE run_id = '{run_id}'")
spark.createDataFrame(latency_rows, schema=latency_ddl).write.mode("append").saveAsTable(latency_table)
if error_rows:
    spark.createDataFrame(error_rows, schema=error_ddl).write.mode("append").saveAsTable(error_table)

first_ms = latency_rows[0]["latency_ms"]
print("SUMMARY " + json.dumps({"first_request_ms": first_ms, "warm": summarize(warm), "concurrent": summarize(concurrent)}))
if mismatches:
    raise RuntimeError("Failure behavior did not match expectations: " + "; ".join(mismatches))
if len(warm) != int(scoring["warm_requests"]):
    raise RuntimeError(f"Only {len(warm)} of {scoring['warm_requests']} warm requests succeeded")
