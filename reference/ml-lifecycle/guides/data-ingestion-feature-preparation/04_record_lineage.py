# Databricks notebook source
# MAGIC %md
# MAGIC # 4. Record the lineage
# MAGIC
# MAGIC Reads the table lineage Unity Catalog captured for the source table, the feature table and the training set, checks that each shows the expected upstream table, and records the result in `feature_lineage`. Lineage can take a few minutes to appear, so the notebook polls for up to five minutes. Safe to rerun: it only reads lineage. The table is a log, so each run adds three rows.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_feature_preparation", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
spec = c.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
import time
from databricks.sdk import WorkspaceClient
from pyspark.sql import functions as F

WAIT_SECONDS = 300
w = WorkspaceClient()
features = c.fq(catalog, schema, spec["features"]["table"])
def task_value(task_key, key):
    """The value an upstream job task passed on, or None when this notebook runs on its own."""
    try:
        return dbutils.jobs.taskValues.get(taskKey=task_key, key=key, default=None, debugValue=None)
    except ValueError:
        return None

training_set = task_value("snapshot_training_set", "training_set")
if not training_set:
    # Run by hand: the snapshot of the latest feature table version.
    training_set = f"{spec['features']['training_set_prefix']}{c.delta_version(spark, features)}"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read the upstream tables

# COMMAND ----------

def upstreams(w: WorkspaceClient, table: str) -> list[str]:
    resp = w.api_client.do("GET", "/api/2.0/lineage-tracking/table-lineage", query={"table_name": table, "include_entity_lineage": "false"})
    return sorted(
        f"{u['tableInfo']['catalog_name']}.{u['tableInfo']['schema_name']}.{u['tableInfo']['name']}"
        for u in resp.get("upstreams", [])
        if "tableInfo" in u
    )


plain = lambda name: f"{catalog}.{schema}.{name}"  # noqa: E731
targets = {
    plain(spec["source"]["table"]): plain(spec["source"]["transactions_table"]),
    plain(spec["features"]["table"]): plain(spec["source"]["table"]),
    plain(training_set): plain(spec["features"]["table"]),
}
deadline = time.time() + WAIT_SECONDS
found: dict[str, list[str]] = {}
while True:
    for target in targets:
        found[target] = upstreams(w, target)
    if all(expected in found[t] for t, expected in targets.items()) or time.time() > deadline:
        break
    print("Lineage not visible yet; waiting 30s")
    time.sleep(30)

# COMMAND ----------

rows = [(t, e, e in found[t], ",".join(found[t])) for t, e in targets.items()]
df = spark.createDataFrame(
    rows, "table_name string, expected_upstream string, found boolean, all_upstreams string"
).withColumn("checked_at", F.current_timestamp())
df.write.mode("append").saveAsTable(c.fq(catalog, schema, "feature_lineage"))
for r in rows:
    print(f"{r[0]} <- {r[3] or 'no upstream yet'} (expected {r[1]}: {r[2]})")
