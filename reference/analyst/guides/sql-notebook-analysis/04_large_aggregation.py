# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Large aggregation
# MAGIC
# MAGIC Generates a multi-million-row table and times aggregations over it on serverless compute. Timings go to `large_aggregation_timing`, which is a run log: it gains one run's rows per run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_sql_notebooks", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
fq = f"{catalog}.{schema}"
ROOT = bundle_root()
SPEC_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Helper to time a step

# COMMAND ----------

import time
from pyspark.sql import functions as F
from analyst_common.datagen import build_table
from analyst_common.spec import load_spec

spec = load_spec(SPEC_FILE)
large = spec["large_table"]
source = f"{fq}.{large['name']}"
timings: list[tuple[str, int, float]] = []

def timed(step: str, rows_fn):
    start = time.perf_counter()
    rows = rows_fn()
    seconds = round(time.perf_counter() - start, 2)
    timings.append((step, int(rows), seconds))
    print(f"{step}: {rows} rows in {seconds}s")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Generate and write the events table
# MAGIC
# MAGIC Overwritten on each run, so the row count does not grow.

# COMMAND ----------

def generate():
    df = build_table(spark, spec, large["name"], int(large["rows"]), large["columns"], partitions=32)
    df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(source)
    return spark.table(source).count()

timed("generate_and_write_events", generate)
events = spark.table(source)
timed("full_scan_count", lambda: events.count())

# COMMAND ----------

# MAGIC %md
# MAGIC ## Aggregate

# COMMAND ----------

def per_customer_month():
    out = (
        events.where(F.col("event_type") == "purchase")
        .groupBy("customer_id", F.date_trunc("month", "event_ts").alias("month"))
        .agg(F.count("*").alias("purchases"), F.sum("amount").alias("revenue"))
    )
    out.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{fq}.events_large_customer_month")
    return out.count()

timed("aggregate_customer_by_month", per_customer_month)

def percentiles():
    row = (
        events.groupBy("event_type")
        .agg(
            F.count("*").alias("events"),
            F.sum("amount").alias("amount"),
            F.percentile_approx("amount", [0.5, 0.95]).alias("p50_p95"),
        )
        .collect()
    )
    return len(row)

timed("aggregate_percentiles_by_type", percentiles)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the timings

# COMMAND ----------

schema_ddl = "step STRING, rows BIGINT, seconds DOUBLE, run_id STRING, recorded_at TIMESTAMP"
result = spark.createDataFrame(
    [(step, rows, seconds, params["run_id"]) for step, rows, seconds in timings],
    "step STRING, rows BIGINT, seconds DOUBLE, run_id STRING",
).withColumn("recorded_at", F.current_timestamp())
spark.sql(f"CREATE TABLE IF NOT EXISTS {fq}.large_aggregation_timing ({schema_ddl})")
result.write.mode("append").saveAsTable(f"{fq}.large_aggregation_timing")
display(spark.table(f"{fq}.large_aggregation_timing").orderBy(F.col("recorded_at").desc()).limit(10))
