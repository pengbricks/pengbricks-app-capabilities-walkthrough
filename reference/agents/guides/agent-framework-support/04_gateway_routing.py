# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Route one prompt through two gateway services
# MAGIC
# MAGIC Create two Unity Gateway model services, send the same prompt to both, then burst one past its limit.
# MAGIC
# MAGIC Each service has a primary model, a fallback model, rate limits, and an inference table. Reruns delete
# MAGIC and recreate the services and drop their inference tables, so the run starts from a known state.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_agent_gateway", ['catalog', 'schema', 'use_case'])

# COMMAND ----------

from types import SimpleNamespace
args = SimpleNamespace(
    catalog=params["catalog"],
    schema=params["schema"],
    src_dir=str(bundle_root() / "src"),
    spec=str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"),
)

import sys
import time
import agents_common as ac
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.service import catalog as c
from pyspark.sql import functions as F
PPT = c.ModelServiceConfigDestinationConfigDestinationType.DESTINATION_TYPE_PAY_PER_TOKEN_FOUNDATION_MODEL
MIN = c.RateLimitRateLimitRenewalPeriod.RATE_LIMIT_RENEWAL_PERIOD_MINUTE
SERVICE_KEY = c.RateLimitRateLimitKey.RATE_LIMIT_KEY_SERVICE

# COMMAND ----------

# MAGIC %md
# MAGIC ## Destination

# COMMAND ----------

def destination(name: str, model: str, pct: int | None = None) -> c.ModelServiceConfigDestinationConfig:
    return c.ModelServiceConfigDestinationConfig(
        name=name,
        destination_type=PPT,
        pay_per_token_config=c.ModelServiceConfigPayPerTokenConfig(model=f"models/system.ai.databricks-{model}"),
        traffic_percentage=pct,
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## Service config

# COMMAND ----------

def service_config(svc: dict) -> c.ModelServiceConfig:
    limits = svc["rate_limits"]
    return c.ModelServiceConfig(
        routing=c.ModelServiceConfigRoutingConfig(
            destinations=[destination("primary", svc["primary"], 100)],
            fallback=c.ModelServiceConfigFallbackConfig(destinations=[destination("fallback", svc["fallback"])]),
        ),
        rate_limits=[
            c.RateLimit(key=SERVICE_KEY, renewal_period=MIN, requests=limits["requests_per_minute"]),
            c.RateLimit(key=SERVICE_KEY, renewal_period=MIN, tokens=limits["tokens_per_minute"]),
        ],
        inference_table=c.InferenceTableConfig(parent=f"schemas/{args.catalog}.{args.schema}"),
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## Recreate

# COMMAND ----------

def recreate(w: WorkspaceClient, svc: dict) -> None:
    fq = ac.qualified(args.catalog, args.schema, svc["name"])
    try:
        w.ai_gateway.delete_model_service(name=f"model-services/{fq}")
    except NotFound:
        pass
    spark.sql(f"DROP TABLE IF EXISTS {fq}_payload")
    w.ai_gateway.create_model_service(
        parent=f"schemas/{args.catalog}.{args.schema}",
        model_service_id=svc["name"],
        model_service=c.ModelService(comment="Capability guide: two-model gateway comparison", config=service_config(svc)),
    )
    print(f"created model service {fq}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it

# COMMAND ----------

def main() -> None:
    spec = ac.load_spec(args.spec)
    gw = spec["gateway"]
    w = WorkspaceClient()
    host, headers = w.config.host, w.config.authenticate()
    for svc in gw["services"]:
        recreate(w, svc)
    print(f"waiting {gw['limit_propagation_seconds']} s for limits to propagate")
    time.sleep(gw["limit_propagation_seconds"])

    compare = []
    messages = [{"role": "user", "content": gw["prompt"]}]
    for svc in gw["services"]:
        model = ac.qualified(args.catalog, args.schema, svc["name"])
        for i in range(gw["repeats"]):
            status, body, ms = ac.chat(host, headers, model, messages, max_tokens=gw["max_tokens"])
            usage = body.get("usage", {}) if status == 200 else {}
            compare.append((svc["name"], svc["primary"], svc["fallback"], i + 1, status, round(ms, 1), body.get("model", ""),
                            usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0),
                            (ac.text_of(ac.message_of(body)) if status == 200 else "")[:300]))
            print(compare[-1][:9])
    cols = ["service", "primary", "fallback", "attempt", "status", "latency_ms", "served_model", "input_tokens", "output_tokens", "answer"]
    (spark.createDataFrame(compare, cols).withColumn("recorded_at", F.current_timestamp())
        .write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(ac.qualified(args.catalog, args.schema, "gateway_comparison")))

    burst_svc = next(s for s in gw["services"] if s["name"] == gw["burst_service"])
    model = ac.qualified(args.catalog, args.schema, burst_svc["name"])
    burst = []
    for i in range(gw["burst_requests"]):
        status, body, ms = ac.chat(host, headers, model, messages, max_tokens=10)
        burst.append((burst_svc["name"], i + 1, status, body.get("error_code", ""), round(ms, 1)))
    print(burst)
    (spark.createDataFrame(burst, ["service", "request_no", "status", "error_code", "latency_ms"])
        .withColumn("limit_per_minute", F.lit(burst_svc["rate_limits"]["requests_per_minute"]))
        .withColumn("recorded_at", F.current_timestamp())
        .write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(ac.qualified(args.catalog, args.schema, "gateway_burst")))
    counts = ac.status_counts([b[2] for b in burst])
    print("burst status counts:", counts)
    dbutils.jobs.taskValues.set(key="burst_counts", value=str(counts))
    ok = [r for r in compare if r[4] == 200]
    assert len({r[0] for r in ok}) == len(gw["services"]), "each service must answer at least once"

# COMMAND ----------

main()
