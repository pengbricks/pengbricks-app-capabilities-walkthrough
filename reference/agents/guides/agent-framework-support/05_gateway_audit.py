# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Read the gateway audit trail
# MAGIC
# MAGIC Read the audit trail for the gateway calls: inference tables, the usage system table, and a cost view.
# MAGIC
# MAGIC Inference-table rows and system.ai_gateway.usage can lag the calls, so the task polls for a few minutes
# MAGIC and records whatever arrived, including a zero. Safe to rerun: both output tables are replaced.

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
    wait_seconds=300,
)

import sys
import time
import agents_common as ac
SINCE = (
    "(SELECT min(recorded_at) - INTERVAL 5 MINUTES FROM "
    + ac.qualified(args.catalog, args.schema, "gateway_comparison")
    + ")"
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Counts

# COMMAND ----------

def counts(spec: dict) -> tuple[dict[str, int], int]:
    inference = {}
    for svc in spec["gateway"]["services"]:
        table = ac.qualified(args.catalog, args.schema, svc["name"]) + "_payload"
        try:
            inference[svc["name"]] = spark.table(table).count()
        except Exception:
            inference[svc["name"]] = 0
    usage = spark.sql(
        f"""SELECT count(*) AS n FROM system.ai_gateway.usage
            WHERE service_name IN ({",".join("'" + ac.qualified(args.catalog, args.schema, s["name"]) + "'" for s in spec["gateway"]["services"])})
              AND event_time >= {SINCE}"""
    ).first()["n"]
    return inference, usage

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it

# COMMAND ----------

def main() -> None:
    spec = ac.load_spec(args.spec)
    deadline = time.time() + args.wait_seconds
    while True:
        inference, usage = counts(spec)
        print("inference rows", inference, "usage rows", usage)
        if all(inference.values()) and usage > 0 or time.time() > deadline:
            break
        time.sleep(30)

    names = ",".join("'" + ac.qualified(args.catalog, args.schema, s["name"]) + "'" for s in spec["gateway"]["services"])
    out = ac.qualified(args.catalog, args.schema, "gateway_usage_by_service")
    spark.sql(
        f"""CREATE OR REPLACE TABLE {out} AS
            SELECT service_name, destination_model, status_code, requester,
                   count(*) AS requests, sum(input_tokens) AS input_tokens, sum(output_tokens) AS output_tokens,
                   percentile(latency_ms, 0.5) AS p50_latency_ms,
                   sum(CASE WHEN size(routing_information.attempts) > 1 THEN 1 ELSE 0 END) AS fallback_attempts
            FROM system.ai_gateway.usage
            WHERE service_name IN ({names}) AND event_time >= {SINCE}
            GROUP BY ALL"""
    )
    spark.sql(f"SELECT * FROM {out} ORDER BY service_name, status_code").show(truncate=False)
    spark.createDataFrame(
        [(k, v) for k, v in inference.items()] + [("system.ai_gateway.usage", usage)], ["source", "rows_seen"]
    ).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(ac.qualified(args.catalog, args.schema, "gateway_audit_counts"))
    dbutils.jobs.taskValues.set(key="usage_rows", value=usage)

# COMMAND ----------

ac.require_system_table(spark, "ai_gateway", "usage")
main()
