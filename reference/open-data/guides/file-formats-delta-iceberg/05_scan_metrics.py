# Databricks notebook source
# MAGIC %md
# MAGIC # 5. Scan metrics: files read, files skipped, bytes read
# MAGIC
# MAGIC The strongest evidence for column pruning and data skipping is what the scan actually read. Unity Catalog records that for each query in `system.query.history`, about ten minutes after the query finishes. This notebook runs last so the metrics are there. It pairs them with the timed queries from `02_compare_reads` and records files read, files pruned and bytes read per format.

# COMMAND ----------

import sys, os, time
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from open_data.checks import append_rows
from open_data.formats import names, pair_scans, result_row
params = load_params(dbutils, "capability_guides_format_compare", ["catalog", "schema", "rows", "seed"])
N = names(params["catalog"], params["schema"])
RESULT_COLUMNS = ["run_id", "step", "format", "metric", "value", "detail", "recorded_at"]
FORMATS = ["json", "csv", "parquet", "delta", "iceberg"]


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
    results.append(result_row(RUN_ID, "scans", fmt, metric, value, detail))
    print(f"[{fmt}] {metric}: {value}  {detail}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Find the timed queries
# MAGIC
# MAGIC `02_compare_reads` saved the time window and the number of rows each day returns. SQL text is redacted in the history for job runs, so the scans are matched on rows produced and start order instead.

# COMMAND ----------

saved = {r["metric"]: r["value"] for r in spark.sql(f"SELECT metric, value FROM {N['results']} WHERE run_id = '{RUN_ID}' AND step = 'reads' AND (metric = 'scan_window' OR metric LIKE 'scan_day_rows:%')").collect()}
window_start, window_end = saved["scan_window"].split("|")
day_rows = {metric.split(":", 1)[1]: int(value) for metric, value in saved.items() if metric.startswith("scan_day_rows:")}
print("window", window_start, "to", window_end, "days", day_rows)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Wait for the history and pair the scans
# MAGIC
# MAGIC The loop stops as soon as every day has a full set of scans, and gives up after 15 minutes. The JSON reader does not report scan metrics, so JSON rows read as "not reported".

# COMMAND ----------

def fetch_scans():
    return [
        r.asDict()
        for r in spark.sql(
            f"SELECT read_files, pruned_files, read_bytes, read_rows FROM system.query.history "
            f"WHERE executed_by = current_user() AND statement_type = 'SELECT' AND execution_status = 'FINISHED' "
            f"AND compute.type = 'SERVERLESS_COMPUTE' AND read_files > 0 "
            f"AND start_time >= TIMESTAMP'{window_start}' AND start_time <= TIMESTAMP'{window_end}' ORDER BY start_time"
        ).collect()
    ]


deadline = time.time() + 900
paired = {}
while True:
    try:
        paired = pair_scans(fetch_scans(), day_rows, FORMATS)
    except Exception as e:
        record("all", "scan_metrics", "BLOCKED", "system.query.history is not readable here: " + str(e).splitlines()[0][:150])
        break
    if len(paired) >= len(day_rows) * (len(FORMATS) - 1) or time.time() > deadline:
        break
    time.sleep(30)

for fmt in FORMATS:
    rows = [paired[(fmt, day)] for day in day_rows if (fmt, day) in paired]
    if not rows:
        record(fmt, "scan_files_read", "not reported", "the platform recorded no scan metrics for this reader")
        continue
    avg = lambda column: round(sum((r[column] or 0) for r in rows) / len(rows))
    record(fmt, "scan_files_read", avg("read_files"), f"average over {len(rows)} queries")
    record(fmt, "scan_files_pruned", avg("pruned_files"), "files skipped from min/max statistics before reading")
    record(fmt, "scan_bytes_read", avg("read_bytes"), "bytes read from storage")
    record(fmt, "scan_rows_read", avg("read_rows"), "rows the scan produced")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the results

# COMMAND ----------

append_rows(spark, N["results"], results, RESULT_COLUMNS)
display(spark.sql(f"SELECT format, metric, value, detail FROM {N['results']} WHERE run_id = '{RUN_ID}' AND step = 'scans' ORDER BY metric, format"))
