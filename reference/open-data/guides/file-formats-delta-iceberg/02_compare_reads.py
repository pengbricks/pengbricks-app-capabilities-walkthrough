# Databricks notebook source
# MAGIC %md
# MAGIC # 2. Compare reads
# MAGIC
# MAGIC Reads each format back and measures three things: the types the reader infers, the time a selective query takes, and the evidence that Parquet-based formats read less than a full scan. The query is the same everywhere: two columns, one date filter, an aggregate.

# COMMAND ----------

import sys, os, time
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from open_data.checks import append_rows
from open_data.formats import median_seconds, names, plan_evidence, result_row, type_drift
params = load_params(dbutils, "capability_guides_format_compare", ["catalog", "schema", "rows", "seed"])
N = names(params["catalog"], params["schema"])
RESULT_COLUMNS = ["run_id", "step", "format", "metric", "value", "detail", "recorded_at"]


def current_run_id():
    try:
        value = dbutils.jobs.taskValues.get(taskKey="write_formats", key="run_id", debugValue="")
    except Exception:
        value = ""
    return value or spark.sql(f"SELECT max(run_id) FROM {N['results']} WHERE step = 'write'").first()[0] or "standalone"


RUN_ID = current_run_id()
results = []
print("run_id", RUN_ID)


def record(fmt, metric, value, detail=""):
    results.append(result_row(RUN_ID, "reads", fmt, metric, value, detail))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read each format and infer its schema
# MAGIC
# MAGIC JSON and CSV carry no types, so Spark samples the files to infer them (`inferSchema` for CSV). Parquet keeps the schema in each file footer, and Delta and Iceberg keep it in table metadata. The inference pass is timed separately because Parquet and the tables do not pay it.

# COMMAND ----------

written = {f.name: f.dataType.simpleString() for f in spark.table(N["delta"]).schema.fields}
written_csv = {name: ("string" if t.startswith(("struct", "array")) else t) for name, t in written.items()}


def read_json():
    return spark.read.json(f"{N['base']}/json")


def read_csv():
    return spark.read.option("header", True).option("inferSchema", True).csv(f"{N['base']}/csv")


def read_parquet():
    return spark.read.parquet(f"{N['base']}/parquet")


frames, infer_seconds = {}, {}
for fmt, reader in (("json", read_json), ("csv", read_csv), ("parquet", read_parquet)):
    start = time.time()
    frames[fmt] = reader()
    frames[fmt].schema  # Spark Connect reads lazily: touching the schema is what runs the inference pass
    infer_seconds[fmt] = round(time.time() - start, 2)
frames["delta"] = spark.table(N["delta"])
frames["iceberg"] = spark.table(N["iceberg"])
for fmt in ("delta", "iceberg"):
    infer_seconds[fmt] = 0.0

for fmt, frame in frames.items():
    inferred = {f.name: f.dataType.simpleString() for f in frame.schema.fields}
    drift = type_drift(written_csv if fmt == "csv" else written, inferred)
    changed = [row for row in drift if row["drift"]]
    record(fmt, "infer_seconds", infer_seconds[fmt], "time to open the data and learn its schema")
    record(fmt, "columns_with_type_drift", len(changed), ", ".join(f"{r['column']}: {r['written']} to {r['inferred']}" for r in changed) or "none")
    for row in drift:
        record(fmt, "type:" + row["column"], row["inferred"], f"written as {row['written']}" + (" (drift)" if row["drift"] else ""))
    print(f"{fmt:8} infer {infer_seconds[fmt]:>6}s  drifted columns: {[(r['column'], r['written'], r['inferred']) for r in changed]}")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Nested JSON
# MAGIC
# MAGIC JSON keeps `shipping` as a struct and `items` as an array of structs, but every number comes back as `bigint` or `double` and every date as a string. CSV carries the nested columns as JSON text.

# COMMAND ----------

for column in ("shipping", "items"):
    for fmt in ("json", "csv", "parquet"):
        record(fmt, "nested:" + column, frames[fmt].schema[column].dataType.simpleString())
        print(f"{fmt:8} {column}: {frames[fmt].schema[column].dataType.simpleString()}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Time the selective query
# MAGIC
# MAGIC Three runs, each for a different day so no run can reuse another's cache or result. The dates are the same in every format and every format must return the same total.

# COMMAND ----------

for fmt, frame in frames.items():
    frame.createOrReplaceTempView("ff_view_" + fmt)

DAYS = ["2025-03-04", "2025-07-19", "2025-11-02"]


def selective(fmt, day):
    marker = f"'ff-{fmt}-{day}'"
    return f"SELECT sum(amount) AS total, count(*) AS n FROM ff_view_{fmt} WHERE CAST(order_date AS DATE) = DATE'{day}' AND {marker} = {marker}"


totals, timings, order = {}, {}, []
window_start = spark.sql("SELECT current_timestamp()").first()[0]
for fmt in frames:
    seconds = []
    for day in DAYS:
        start = time.time()
        row = spark.sql(selective(fmt, day)).first()
        seconds.append(round(time.time() - start, 3))
        totals[(fmt, day)] = (str(row["total"]), row["n"])
        order.append((fmt, day))
    timings[fmt] = seconds
    record(fmt, "query_seconds_median", median_seconds(seconds), "runs: " + ", ".join(str(s) for s in seconds))
    record(fmt, "query_seconds_first", seconds[0])
    print(f"{fmt:8} runs {seconds}  median {median_seconds(seconds)}s")

window_end = spark.sql("SELECT current_timestamp()").first()[0]
for day in DAYS:
    answers = {fmt: totals[(fmt, day)] for fmt in frames}
    # CSV and Parquet-based formats keep exact decimals; JSON gives doubles. Compare the row counts exactly and the totals to the cent.
    same_rows = len({a[1] for a in answers.values()}) == 1
    same_total = len({round(float(a[0]), 2) for a in answers.values()}) == 1
    record("all", "same_answer:" + day, "PASS" if same_rows and same_total else "FAIL", str(answers))
    if not (same_rows and same_total):
        raise Exception(f"Formats disagree on {day}: {answers}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Column pruning in the plan
# MAGIC
# MAGIC `ReadSchema` lists the columns the scan reads. Parquet, Delta and Iceberg read only `order_date` and `amount` from the 12 columns because the data is columnar. JSON and CSV also list two columns, but they are row-oriented text: each file is still read and parsed from start to end, which the byte counts below show.

# COMMAND ----------

for fmt in frames:
    plan = "\n".join(r[0] for r in spark.sql("EXPLAIN FORMATTED " + selective(fmt, DAYS[0])).collect())
    found = plan_evidence(plan)
    record(fmt, "plan_columns_read", len(found["columns_read"]), ", ".join(found["columns_read"]))
    record(fmt, "plan_filters", found["pushed_filters"][:200] or "(none)", "filters the scan applies while reading")
    print(f"{fmt:8} reads {found['columns_read']} of {len(written)} columns; filters: {found['pushed_filters'][:90]}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Note the timing window
# MAGIC
# MAGIC Unity Catalog records scan metrics for every query in `system.query.history`, but only about ten minutes after the query runs. `05_scan_metrics` reads them back later. This cell saves what it needs to find the timed queries: the time window and how many rows each day returns.

# COMMAND ----------

record("all", "scan_window", f"{window_start}|{window_end}", "start and end of the timed queries, session time (UTC)")
for day in DAYS:
    record("all", "scan_day_rows:" + day, totals[("parquet", day)][1], "rows the filter returns for this day")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the results

# COMMAND ----------

append_rows(spark, N["results"], results, RESULT_COLUMNS)
display(spark.sql(f"SELECT format, metric, value, detail FROM {N['results']} WHERE run_id = '{RUN_ID}' AND step = 'reads' AND metric NOT LIKE 'type:%' AND metric NOT LIKE 'nested:%' ORDER BY metric, format"))
