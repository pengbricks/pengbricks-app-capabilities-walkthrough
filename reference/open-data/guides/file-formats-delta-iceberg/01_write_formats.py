# Databricks notebook source
# MAGIC %md
# MAGIC # 1. Write one dataset five ways
# MAGIC
# MAGIC The same seeded orders go to JSON, CSV and Parquet folders in a volume, a managed Delta table, and a managed Iceberg table. Safe to rerun: every write overwrites, and the step's rows in `ff_results` are replaced. Rows are range-partitioned and sorted by `order_date` in every format, so the file layout is the same everywhere and only the format differs.

# COMMAND ----------

import sys, os, time, datetime as dt
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
from open_data.checks import append_rows
from open_data.formats import build_orders, csv_safe, human_bytes, names, result_row, summarize_files
from open_data.spec import load_spec
params = load_params(dbutils, "capability_guides_format_compare", ["catalog", "schema", "rows", "seed"])
N = names(params["catalog"], params["schema"])
ROWS, SEED = int(params["rows"]), int(params["seed"])
SPEC = load_spec(bundle_root() / "use_cases" / "general.yml")
RESULT_COLUMNS = ["run_id", "step", "format", "metric", "value", "detail", "recorded_at"]
RUN_ID = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
try:
    dbutils.jobs.taskValues.set(key="run_id", value=RUN_ID)
except Exception:
    pass  # standalone run: later notebooks look the id up in ff_results
results = []
print("run_id", RUN_ID)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Generate the orders
# MAGIC
# MAGIC The flat columns come from the `file_formats` section of `use_cases/general.yml`, built by the sample-data generator (`src/sample_data.py`). Each value depends only on the seed and the row id, so reruns give the same rows. `build_orders` then adds a nested struct and an array of structs. The data has a date, a timestamp, decimals and two nullable columns.

# COMMAND ----------

orders = build_orders(spark, SPEC, ROWS, SEED).repartitionByRange(8, "order_date").sortWithinPartitions("order_date")
print(orders.schema.simpleString())
display(orders.limit(5))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the three file formats
# MAGIC
# MAGIC CSV cannot hold nested types, so the writer refuses the struct and array columns. The guide writes them to CSV as JSON strings.

# COMMAND ----------

def list_files(path):
    out = []
    for entry in dbutils.fs.ls(path):
        if entry.isDir():
            out += list_files(entry.path)
        else:
            out.append((entry.path, entry.size))
    return out


def timed(fn):
    start = time.time()
    fn()
    return round(time.time() - start, 2)


try:
    orders.write.mode("overwrite").csv(f"{N['base']}/csv_nested_attempt", header=True)
    nested_csv = "accepted"
except Exception as e:
    nested_csv = str(e).splitlines()[0][:200]
results.append(result_row(RUN_ID, "write", "csv", "nested_types", nested_csv, "writing struct and array columns directly"))
print("CSV with nested columns:", nested_csv)

writers = {
    "json": lambda: orders.write.mode("overwrite").json(f"{N['base']}/json"),
    "csv": lambda: csv_safe(orders).write.mode("overwrite").option("header", True).csv(f"{N['base']}/csv"),
    "parquet": lambda: orders.write.mode("overwrite").parquet(f"{N['base']}/parquet"),
}
footprint = {}
for fmt, write in writers.items():
    seconds = timed(write)
    footprint[fmt] = summarize_files(list_files(f"{N['base']}/{fmt}"))
    results.append(result_row(RUN_ID, "write", fmt, "write_seconds", seconds))
    print(fmt, footprint[fmt], f"{seconds}s")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the two tables
# MAGIC
# MAGIC The Delta table is a plain `saveAsTable` overwrite. Managed Iceberg is created with `USING ICEBERG`; the DataFrame writer does not accept it, so the data goes in with SQL.

# COMMAND ----------

seconds = timed(lambda: orders.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(N["delta"]))
results.append(result_row(RUN_ID, "write", "delta", "write_seconds", seconds))

orders.createOrReplaceTempView("ff_orders_source")
seconds = timed(lambda: spark.sql(f"CREATE OR REPLACE TABLE {N['iceberg']} USING ICEBERG AS SELECT * FROM ff_orders_source"))
results.append(result_row(RUN_ID, "write", "iceberg", "write_seconds", seconds))

for fmt, table in (("delta", N["delta"]), ("iceberg", N["iceberg"])):
    detail = spark.sql(f"DESCRIBE DETAIL {table}").first()
    footprint[fmt] = {"files": int(detail["numFiles"]), "bytes": int(detail["sizeInBytes"])}
    codec = (detail["properties"] or {}).get("delta.parquet.compression.codec") or (detail["properties"] or {}).get("write.parquet.compression-codec")
    results.append(result_row(RUN_ID, "write", fmt, "table_format", detail["format"], f"parquet codec {codec}"))
    print(fmt, footprint[fmt], "format", detail["format"], "codec", codec)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Count the rows and record the footprint
# MAGIC
# MAGIC Every format must hold exactly the generated number of rows.

# COMMAND ----------

counts = {
    "json": spark.read.json(f"{N['base']}/json").count(),
    "csv": spark.read.option("header", True).csv(f"{N['base']}/csv").count(),
    "parquet": spark.read.parquet(f"{N['base']}/parquet").count(),
    "delta": spark.table(N["delta"]).count(),
    "iceberg": spark.table(N["iceberg"]).count(),
}
for fmt, count in counts.items():
    results.append(result_row(RUN_ID, "write", fmt, "rows", count, "expected " + str(ROWS)))
    results.append(result_row(RUN_ID, "write", fmt, "files", footprint[fmt]["files"]))
    results.append(result_row(RUN_ID, "write", fmt, "bytes", footprint[fmt]["bytes"], human_bytes(footprint[fmt]["bytes"])))
    print(f"{fmt:8} rows {count:>9,}  files {footprint[fmt]['files']:>3}  bytes {footprint[fmt]['bytes']:>12,}  ({human_bytes(footprint[fmt]['bytes'])})")
wrong = {fmt: c for fmt, c in counts.items() if c != ROWS}
if wrong:
    raise Exception(f"Row counts differ from {ROWS}: {wrong}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the measurements
# MAGIC
# MAGIC `ff_results` is a run log. Each run appends its rows and nothing is deleted.

# COMMAND ----------

append_rows(spark, N["results"], results, RESULT_COLUMNS, replace_where="step = 'write'")
display(spark.sql(f"SELECT format, metric, value, detail FROM {N['results']} WHERE run_id = '{RUN_ID}' AND step = 'write' AND metric IN ('rows', 'files', 'bytes') ORDER BY metric, format"))
