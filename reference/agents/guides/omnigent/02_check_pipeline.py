# Databricks notebook source
# MAGIC %md
# MAGIC # 2. Check the pipeline Omnigent built
# MAGIC
# MAGIC Looks for the pipeline by name prefix and for the bronze, silver, and gold tables with the prefix `omni_`, then reconciles their row counts to the raw files in the volume.
# MAGIC
# MAGIC The Omnigent steps run in a chat session, not in this job. When the pipeline or its tables are not there yet, the notebook reports `needs_manual_check` with the steps still to do and finishes without failing. It fails only when a layer exists and its counts do not match the raw files.
# MAGIC
# MAGIC | Check | Expected |
# MAGIC |---|---|
# MAGIC | Bronze orders, customers, events | Equal to the raw row counts. |
# MAGIC | Silver orders | One row per `order_id`, with `amount` present. |
# MAGIC | Gold | `order_count` sums to the silver order count and `revenue` sums to the silver amount. |
# MAGIC
# MAGIC Safe to rerun: the notebook reads the pipeline, the tables, and the raw files, and replaces its own result table `omnigent_pipeline_check`.
# MAGIC
# MAGIC Required setup: the preflight ran, and a serverless job or notebook can read the schema. See `00_start_here`.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params

params = load_params(
    dbutils,
    "capability_guides_omnigent",
    ["catalog", "schema", "volume", "table_prefix", "pipeline_prefix"],
    defaults={"volume": "omnigent_raw", "table_prefix": "omni_", "pipeline_prefix": "omnigent_"},
)

# COMMAND ----------

import json
import omnigent_lib as ol
from databricks.sdk import WorkspaceClient

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it

# COMMAND ----------

def read_raw(paths: dict) -> tuple[list, list, list]:
    with open(paths["orders"]) as handle:
        orders = ol.parse_orders_csv(handle.read())
    with open(paths["customers"]) as handle:
        customers = ol.parse_json_lines(handle.read())
    events = []
    for path in paths["events"]:
        with open(path) as handle:
            events += ol.parse_json_lines(handle.read())
    return orders, customers, events


def actual_counts(groups: dict, fq: str) -> dict:
    """Row counts and sums from the tables Omnigent's pipeline wrote."""
    out = {}
    for key, layer, hint in (
        ("bronze_orders", "bronze", "orders"),
        ("bronze_customers", "bronze", "customers"),
        ("bronze_events", "bronze", "events"),
        ("silver_orders", "silver", "orders"),
    ):
        table = ol.table_for(groups, layer, hint)
        if table:
            out[key] = spark.table(f"{fq}.`{table}`").count()
    if groups["gold"]:
        gold = spark.table(f"{fq}.`{groups['gold'][0]}`")
        if {"order_count", "revenue"} <= set(gold.columns):
            row = gold.selectExpr("sum(order_count) AS n", "sum(revenue) AS r").first()
            if row["n"] is not None:
                out["gold_order_count"] = int(row["n"])
                out["gold_revenue"] = float(row["r"])
    return out


def main() -> str:
    catalog, schema = params["catalog"], params["schema"]
    prefix = ol.check_identifier(params["table_prefix"] or "omni_", "table_prefix")
    fq = f"`{catalog}`.`{schema}`"
    w = WorkspaceClient()

    pipeline = ol.find_pipeline([p.name for p in w.pipelines.list_pipelines() if p.name], params["pipeline_prefix"])
    tables = [t.name for t in w.tables.list(catalog_name=catalog, schema_name=schema) if t.name]
    groups = ol.classify_tables(tables, prefix)
    print(f"Pipeline: {pipeline or 'not found'}")
    for layer in ol.LAYERS:
        print(f"{layer}: {groups[layer] or 'none'}")

    paths = ol.raw_paths(catalog, schema, params["volume"])
    orders, customers, events = read_raw(paths)
    expected = ol.expected_counts(orders, customers, events)
    checks = ol.reconcile(expected, actual_counts(groups, fq))
    status = ol.overall_status(pipeline, groups, checks)

    for c in checks:
        print(f"{c['status']:8} {c['check']}: expected {c['expected']}, actual {c['actual']}")
    steps = ol.manual_steps(pipeline, groups)

    result = spark.createDataFrame(
        [(c["check"], str(c["expected"]), str(c["actual"]), c["status"]) for c in checks],
        "check string, expected string, actual string, status string",
    )
    result.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{fq}.omnigent_pipeline_check")

    print(f"Status: {status}")
    if status == "needs_manual_check":
        print("The interactive Omnigent steps have not finished. This is not a failure.")
        for step in steps:
            print(f"- {step}")
    if status == "fail":
        raise AssertionError("Row counts do not match the raw files. See the table above.")
    return status


status = main()
dbutils.notebook.exit(json.dumps({"status": status}))
