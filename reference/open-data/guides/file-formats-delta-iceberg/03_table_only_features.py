# Databricks notebook source
# MAGIC %md
# MAGIC # 3. What only the table formats do
# MAGIC
# MAGIC Plain files are bytes in a folder. This notebook tries the same operations on a Parquet folder, a Delta table and a managed Iceberg table, each built from the same 20,000 orders, and records what each does. The main tables stay untouched; every change goes to small `ff_work_*` copies that are rebuilt on each run. Safe to rerun: the step's `features` rows in `ff_results` are replaced. Working tables and folders are replaced.

# COMMAND ----------

import sys, os, time, threading, datetime as dt
from pyspark.sql import functions as F
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from open_data.checks import append_rows
from open_data.formats import first_error_line, names, result_row
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
SAMPLE = 20000
FOLDER = f"{N['base']}/work_parquet"
print("run_id", RUN_ID)


def record(fmt, metric, value, detail=""):
    results.append(result_row(RUN_ID, "features", fmt, metric, value, detail))
    print(f"[{fmt}] {metric}: {value}  {detail}")


def attempt(fmt, metric, statement):
    """Run a statement. Record 'ok' or the first line of the error."""
    try:
        spark.sql(statement)
        record(fmt, metric, "ok", statement[:120])
        return True
    except Exception as e:
        record(fmt, metric, "error", first_error_line(str(e)))
        return False

# COMMAND ----------

# MAGIC %md
# MAGIC ## Build the working copies
# MAGIC
# MAGIC The same 20,000 rows go to a Parquet folder, a Delta table and an Iceberg table.

# COMMAND ----------

sample = spark.table(N["delta"]).orderBy("order_id").limit(SAMPLE).select("order_id", "order_date", "region", "status", "quantity", "amount")
sample.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(N["work_delta"])
spark.table(N["work_delta"]).write.mode("overwrite").parquet(FOLDER)
spark.sql(f"CREATE OR REPLACE TABLE {N['work_iceberg']} USING ICEBERG AS SELECT * FROM {N['work_delta']}")
TARGETS = {"parquet": f"parquet.`{FOLDER}`", "delta": N["work_delta"], "iceberg": N["work_iceberg"]}
ids = [r["order_id"] for r in spark.table(N["work_delta"]).orderBy("order_id").limit(2).collect()]
first_id, second_id = ids
print("working copies ready; first order", first_id)

# COMMAND ----------

# MAGIC %md
# MAGIC ## UPDATE, DELETE and MERGE
# MAGIC
# MAGIC On a folder of Parquet files Unity Catalog rejects all three. Delta and Iceberg run them. Each success changes only the rows it touches.

# COMMAND ----------

statements = {
    "update": "UPDATE {t} SET status = 'CORRECTED' WHERE order_id = '%s'" % second_id,
    "delete": "DELETE FROM {t} WHERE order_id = '%s'" % first_id,
    "merge": "MERGE INTO {t} AS t USING (SELECT 'ORD-NEW' AS order_id, DATE'2025-01-01' AS order_date, 'West' AS region, 'NEW' AS status, 1 AS quantity, CAST(1.00 AS DECIMAL(12,2)) AS amount) AS s ON t.order_id = s.order_id WHEN NOT MATCHED THEN INSERT *",
}
for fmt, target in TARGETS.items():
    for name, template in statements.items():
        attempt(fmt, name, template.format(t=target))
for fmt in ("delta", "iceberg"):
    table = N["work_" + fmt]
    rows = spark.table(table).count()
    corrected = spark.table(table).filter("status = 'CORRECTED'").count()
    record(fmt, "rows_after_dml", rows, f"{SAMPLE} rows, one deleted and one merged in; rows now marked CORRECTED: {corrected}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Time travel and history
# MAGIC
# MAGIC Every commit is a version. `VERSION AS OF` reads the table before the changes.

# COMMAND ----------

for fmt in ("delta", "iceberg"):
    table = N["work_" + fmt]
    history = spark.sql(f"DESCRIBE HISTORY {table}").select("version", "operation").orderBy("version").collect()
    record(fmt, "history", len(history), ", ".join(f"{h['version']}={h['operation']}" for h in history))
    first_version = history[0]["version"]
    old = spark.sql(f"SELECT * FROM {table} VERSION AS OF {first_version}")
    deleted_row_present = old.filter(F.col("order_id") == first_id).count() == 1
    record(fmt, "time_travel_rows", old.count(), f"VERSION AS OF {first_version} returns the {SAMPLE} original rows; the row deleted later is present: {deleted_row_present}")
record("parquet", "time_travel", "not available", "a folder has no commits, so there is no earlier version to read")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Schema evolution and schema enforcement
# MAGIC
# MAGIC Adding a column is a metadata change on a table. A table also rejects an insert that does not match its schema; a folder accepts any file you put in it.

# COMMAND ----------

for fmt in ("delta", "iceberg"):
    table = N["work_" + fmt]
    attempt(fmt, "add_column", f"ALTER TABLE {table} ADD COLUMN channel STRING")
    record(fmt, "columns_after_alter", len(spark.table(table).columns), ", ".join(spark.table(table).columns))
    attempt(fmt, "insert_extra_column", f"INSERT INTO {table} SELECT 'X', DATE'2025-01-01', 'West', 'NEW', 1, CAST(1 AS DECIMAL(12,2)), 'web', 'surplus'")

# A folder accepts a file with a different schema without complaint, and then readers disagree about it.
before = spark.read.parquet(FOLDER).count()
spark.range(5).select(F.col("id").cast("string").alias("order_id"), F.lit("surplus").alias("not_in_schema")).write.mode("append").parquet(FOLDER)
columns_read = spark.read.parquet(FOLDER).columns
merged_columns = spark.read.option("mergeSchema", "true").parquet(FOLDER).columns
record("parquet", "append_mismatched_file", "accepted", f"rows {before} to {spark.read.parquet(FOLDER).count()}; default read sees {len(columns_read)} columns, mergeSchema read sees {len(merged_columns)}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## ACID: failed and concurrent writes
# MAGIC
# MAGIC A table commit is atomic. First a write fails halfway: the table count must not change. Then one thread overwrites a table while another reads it: every count must be a whole version. Last, two writers overwrite the same target at once. The table ends up with exactly one writer's data; the folder is left to the file system.

# COMMAND ----------

def failing_insert(table):
    """An insert whose last row raises, after other tasks may have written files."""
    return f"INSERT INTO {table} SELECT id, 'X' FROM (SELECT CASE WHEN id = 299999 THEN raise_error('boom') ELSE id END AS id FROM range(300000)) t"


ACID_TABLES = {"delta": f"{N['prefix']}.ff_work_acid_delta", "iceberg": f"{N['prefix']}.ff_work_acid_iceberg"}
for fmt, table in ACID_TABLES.items():
    using = "USING ICEBERG" if fmt == "iceberg" else ""
    spark.sql(f"CREATE OR REPLACE TABLE {table} {using} AS SELECT id, 'A' AS batch FROM range(300000)")
    try:
        spark.sql(failing_insert(table))
        outcome = "unexpected success"
    except Exception as e:
        outcome = first_error_line(str(e))
    after = spark.table(table).count()
    record(fmt, "failed_write_leaves_table_unchanged", "PASS" if after == 300000 else "FAIL", f"write failed with {outcome}; count stayed {after} of 300000")

# COMMAND ----------

def overwrite_while_reading(read_count, overwrite):
    """Overwrite 300k rows with 600k and back while another thread keeps counting. Returns the counts seen."""
    seen, errors = set(), []

    def writer():
        for _ in range(2):
            overwrite(600000, "B")
            overwrite(300000, "A")

    thread = threading.Thread(target=writer)
    thread.start()
    while thread.is_alive():
        try:
            seen.add(read_count())
        except Exception as e:
            errors.append(first_error_line(str(e), 100))
    thread.join()
    return sorted(seen), errors


for fmt, table in ACID_TABLES.items():
    seen, errors = overwrite_while_reading(
        lambda t=table: spark.table(t).count(),
        lambda n, b, t=table: spark.sql(f"INSERT OVERWRITE {t} SELECT id, '{b}' FROM range({n})"),
    )
    ok = set(seen) <= {300000, 600000} and not errors
    record(fmt, "readers_see_whole_versions", "PASS" if ok else "FAIL", f"counts seen while overwriting: {seen}; read errors {len(errors)}")

pq_path = f"{N['base']}/work_acid_parquet"
spark.range(300000).write.mode("overwrite").parquet(pq_path)
seen, errors = overwrite_while_reading(
    lambda: spark.read.parquet(pq_path).count(),
    lambda n, b: spark.range(n).repartition(6).write.mode("overwrite").parquet(pq_path),
)
record("parquet", "readers_during_overwrite", "INFO", f"counts seen: {seen}; read errors {len(errors)}. A single Spark job commits its files together, so one writer is safe.")

# COMMAND ----------

def two_writers(overwrite, read_count, trials=3):
    """Two threads overwrite the same target. Returns the final counts and any errors per trial."""
    outcomes = []
    for _ in range(trials):
        errors = []

        def run(n, overwrite=overwrite):
            try:
                overwrite(n)
            except Exception as e:
                errors.append(first_error_line(str(e), 90))

        threads = [threading.Thread(target=run, args=(n,)) for n in (300000, 600000)]
        [t.start() for t in threads]
        [t.join() for t in threads]
        try:
            final = read_count()
        except Exception as e:
            final = "read error: " + first_error_line(str(e), 80)
        outcomes.append((final, len(errors)))
    return outcomes


for fmt, table in ACID_TABLES.items():
    outcomes = two_writers(lambda n, t=table: spark.sql(f"INSERT OVERWRITE {t} SELECT id, 'W' FROM range({n})"), lambda t=table: spark.table(t).count())
    ok = all(final in (300000, 600000) for final, _ in outcomes)
    record(fmt, "two_writers_final_state", "PASS" if ok else "FAIL", f"final counts and failed writers per trial: {outcomes}. One writer's data wins, never a mix.")

outcomes = two_writers(lambda n: spark.range(n).repartition(6).write.mode("overwrite").parquet(pq_path), lambda: spark.read.parquet(pq_path).count())
record("parquet", "two_writers_final_state", "INFO", f"final counts and failed writers per trial: {outcomes}. Nothing arbitrates between the writers.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the results
# MAGIC
# MAGIC The main tables must be unchanged: this notebook only touched the `ff_work_*` copies and the work folders.

# COMMAND ----------

for fmt, table in (("delta", N["delta"]), ("iceberg", N["iceberg"])):
    rows = spark.table(table).count()
    expected = int(params["rows"])
    record(fmt, "main_table_rows_unchanged", "PASS" if rows == expected else "FAIL", f"{table} has {rows} rows, expected {expected}")
append_rows(spark, N["results"], results, RESULT_COLUMNS, replace_where="step = 'features'")
failed = [r["metric"] + ":" + r["format"] for r in results if r["value"] == "FAIL"]
if failed:
    raise Exception(f"Failed checks: {failed}")
display(spark.sql(f"SELECT format, metric, value, detail FROM {N['results']} WHERE run_id = '{RUN_ID}' AND step = 'features' ORDER BY metric, format"))
