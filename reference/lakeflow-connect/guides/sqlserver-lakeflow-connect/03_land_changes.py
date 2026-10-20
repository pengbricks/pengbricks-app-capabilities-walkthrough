# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Watch the changes land in bronze
# MAGIC
# MAGIC The gateway has been reading the change log since step 1. This step runs the ingestion pipeline, then checks every expected change in bronze: the new orders exist, the shipped ones show `SHIPPED`, the deleted ones are gone, and each customer who changed plan has a new current version and a closed old one. If the newest changes were not staged yet, it waits a minute and runs the pipeline again, up to `max_wait_minutes`.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_lakeflow_connect",
                     ["catalog", "schema", "ingestion_pipeline_id", "max_wait_minutes", "run_id"], defaults={"run_id": "manual", "max_wait_minutes": "20"})
catalog, schema = params["catalog"], params["schema"]

import lfc_lib as l
from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
expected = [row.asDict() for row in spark.table(l.fq(catalog, schema, "lfc_expected_changes")).collect()]
committed_at = expected[0]["committed_at"]

# COMMAND ----------

result = l.ingest_until(w, params["ingestion_pipeline_id"], lambda: all(l.landed(spark, catalog, schema, expected)),
                        max_wait_s=int(params["max_wait_minutes"]) * 60)
checks = l.landed(spark, catalog, schema, expected)
display(spark.createDataFrame([(e["kind"], e["source_table"], e["key"], e["value"], ok) for e, ok in zip(expected, checks)],
                              "kind string, source_table string, key int, value string, landed boolean"))
print(result)

# COMMAND ----------

# MAGIC %md One customer's history: every plan they have had, and when each was true.

# COMMAND ----------

customer = next(e["key"] for e in expected if e["kind"] == "update_history")
display(spark.sql(f"""
  SELECT customer_id, plan_name, status, __START_AT, __END_AT
  FROM {l.fq(catalog, schema, l.TABLES['customers'])} WHERE customer_id = {customer} ORDER BY __START_AT"""))

# COMMAND ----------

l.write_results(spark, catalog, schema, params["run_id"], "land_changes", [
    ("changes_landed", sum(checks), f"of {len(checks)}"),
    ("pipeline_updates", len(result["updates"]), ", ".join(u["update_id"] for u in result["updates"])),
    ("seconds_to_land", result["seconds"], f"from the first update; changes committed {committed_at:%H:%M:%S} UTC"),
])
assert all(checks), f"{len(checks) - sum(checks)} changes did not land within {params['max_wait_minutes']} minutes"
