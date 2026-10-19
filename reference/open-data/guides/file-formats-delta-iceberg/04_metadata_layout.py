# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Where the metadata lives
# MAGIC
# MAGIC Delta and Iceberg both store rows as Parquet. What differs is the metadata around the files. Delta keeps a `_delta_log` folder of JSON commits and Parquet checkpoints next to the data. Iceberg keeps a `metadata.json` that points to a manifest list, which points to manifests, which list the data files. This notebook lists those files, then shows a UniForm table that carries both sets of metadata over one set of Parquet files.

# COMMAND ----------

import sys, os, json, gzip, time, datetime as dt
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from open_data.checks import append_rows
from open_data.formats import delta_log_summary, human_bytes, names, result_row
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
    results.append(result_row(RUN_ID, "metadata", fmt, metric, value, detail))
    print(f"[{fmt}] {metric}: {value}  {detail}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Delta: the `_delta_log` folder
# MAGIC
# MAGIC Managed table storage cannot be listed from a notebook, so this builds a small Delta table at a volume path. Twelve commits with a checkpoint interval of 3 show both file types.

# COMMAND ----------

from pyspark.sql import functions as F

try:
    dbutils.fs.ls(spark.sql(f"DESCRIBE DETAIL {N['delta']}").first()["location"] + "/_delta_log")
    record("delta", "managed_log_listable", "yes")
except Exception as e:
    record("delta", "managed_log_listable", "no", str(e).splitlines()[0][:160])

DELTA_PATH = f"{N['base']}/delta_layout"
dbutils.fs.rm(DELTA_PATH, True)
small = spark.range(1000).withColumn("order_date", F.expr("date_add(DATE'2025-01-01', cast(id % 30 AS INT))")).withColumn("amount", F.expr("cast(id / 7 AS DECIMAL(12,2))"))
small.write.format("delta").mode("overwrite").save(DELTA_PATH)
spark.sql(f"ALTER TABLE delta.`{DELTA_PATH}` SET TBLPROPERTIES ('delta.checkpointInterval' = '3')")
for _ in range(11):
    small.write.format("delta").mode("append").save(DELTA_PATH)

log = [(e.name, e.size) for e in dbutils.fs.ls(DELTA_PATH + "/_delta_log")]
for name, size in sorted(log):
    print(f"{size:>8}  _delta_log/{name}")
summary = delta_log_summary([name.rstrip("/") for name, _ in log])
record("delta", "log_files", len(log), f"{summary['commits']} JSON commits, {summary['checkpoints']} checkpoint files, _last_checkpoint present: {summary['has_last_checkpoint']}")
data_files = [(e.name, e.size) for e in dbutils.fs.ls(DELTA_PATH) if e.name.endswith(".parquet")]
record("delta", "data_files_beside_log", len(data_files), f"{human_bytes(sum(s for _, s in data_files))} of Parquet in the table folder")

# COMMAND ----------

# MAGIC %md
# MAGIC ### What a commit and a checkpoint contain
# MAGIC
# MAGIC A commit is one JSON line per action: `commitInfo`, `add`, `remove`, `metaData`, `protocol`. Each `add` carries the file path and its column statistics, which is where data skipping gets min and max. A checkpoint is the table's state up to that version in one Parquet file, so a reader does not replay every commit.

# COMMAND ----------

commit_names = sorted(n for n, _ in log if n.endswith(".json") and n[:20].isdigit() and "compacted" not in n)
for commit_name in commit_names[1:]:  # commit 0 creates the table; a later one has data files
    with open(f"{DELTA_PATH}/_delta_log/{commit_name}") as handle:
        actions = [json.loads(line) for line in handle if line.strip()]
    if any("add" in action for action in actions):
        break
kinds = [next(iter(action)) for action in actions]
add = next(a["add"] for a in actions if "add" in a)
record("delta", "commit_actions", ", ".join(sorted(set(kinds))), f"{commit_name}: {len(actions)} actions")
record("delta", "add_action_fields", ", ".join(add.keys()), "path, size, partitionValues, modificationTime, dataChange, stats")
print("stats of one data file:", add.get("stats"))
record("delta", "add_stats_example", str(add.get("stats"))[:220], "per-file row count and column min/max/null counts")

checkpoints = sorted(n for n, _ in log if n.endswith(".checkpoint.parquet"))
if checkpoints:
    checkpoint = spark.read.parquet(f"{DELTA_PATH}/_delta_log/{checkpoints[-1]}")
    n_add = checkpoint.filter("add IS NOT NULL").count()
    record("delta", "checkpoint_contents", f"{n_add} add actions", f"{checkpoints[-1]} columns: {', '.join(checkpoint.columns)}")
else:
    record("delta", "checkpoint_contents", "no checkpoint written", "")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Iceberg: metadata.json, manifest list, manifests
# MAGIC
# MAGIC Managed Iceberg storage cannot be listed either, so this reads the layers through the Unity Catalog Iceberg REST catalog with PyIceberg, the same way an outside engine would. Each layer is an object with a path.

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from pyiceberg.catalog import load_catalog
from open_data.iceberg import catalog_properties

w = WorkspaceClient()
token = w.config.authenticate()["Authorization"].split(" ", 1)[1]
iceberg_catalog = load_catalog("unity", **catalog_properties(w.config.host, params["catalog"], "/api/2.1/unity-catalog/iceberg-rest", token))


def iceberg_layers(table_name):
    """Return the metadata layers of one table as seen through the REST catalog."""
    table = iceberg_catalog.load_table(f"{params['schema']}.{table_name}")
    snapshot = table.current_snapshot()
    raw = table.io.new_input(table.metadata_location).open().read()
    try:
        raw = gzip.decompress(raw)
    except OSError:
        pass
    document = json.loads(raw)
    files = table.inspect.files().to_pylist()
    return {
        "table": table,
        "metadata_location": table.metadata_location,
        "format_version": document["format-version"],
        "snapshots": len(document["snapshots"]),
        "manifest_list": snapshot.manifest_list,
        "manifests": [m.manifest_path for m in snapshot.manifests(table.io)],
        "files": files,
    }


def short(path):
    """Drop the storage host and the table id, keeping the part that shows the layout."""
    return path.split("/tables/", 1)[-1].split("/", 1)[-1]


layers = iceberg_layers(N["iceberg"].split(".")[-1])
print("metadata.json   ", short(layers["metadata_location"]))
print("manifest list   ", short(layers["manifest_list"]))
for manifest in layers["manifests"]:
    print("manifest        ", short(manifest))
for f in layers["files"][:3]:
    print("data file       ", short(f["file_path"]), f["file_format"], human_bytes(f["file_size_in_bytes"]), f["record_count"], "rows")
record("iceberg", "metadata_json", short(layers["metadata_location"]), f"format version {layers['format_version']}, {layers['snapshots']} snapshot(s)")
record("iceberg", "manifest_list", short(layers["manifest_list"]))
record("iceberg", "manifests", len(layers["manifests"]), "; ".join(short(m) for m in layers["manifests"]))
record("iceberg", "data_files", len(layers["files"]), f"{human_bytes(sum(f['file_size_in_bytes'] for f in layers['files']))}, all {set(f['file_format'] for f in layers['files'])}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Both formats store Parquet
# MAGIC
# MAGIC The compression codec comes from a Parquet footer. Files Spark writes to a volume use snappy; the managed Delta and Iceberg tables default to zstd.

# COMMAND ----------

import pyarrow.parquet as pq

volume_file = sorted(e.path for e in dbutils.fs.ls(f"{N['base']}/parquet") if e.name.endswith(".parquet"))[0].replace("dbfs:", "")
record("parquet", "codec", pq.ParquetFile(volume_file).metadata.row_group(0).column(0).compression, "Parquet files Spark wrote to the volume")
iceberg_file = layers["files"][0]["file_path"]
record("iceberg", "codec", pq.ParquetFile(layers["table"].io.new_input(iceberg_file).open()).metadata.row_group(0).column(0).compression, "first data file of the managed Iceberg table")
delta_props = spark.sql(f"DESCRIBE DETAIL {N['delta']}").first()["properties"]
record("delta", "codec", delta_props.get("delta.parquet.compression.codec", "default"), "table property delta.parquet.compression.codec")

# COMMAND ----------

# MAGIC %md
# MAGIC ## UniForm: one set of Parquet files, two sets of metadata
# MAGIC
# MAGIC A Delta table with `delta.universalFormat.enabledFormats = 'iceberg'` writes Iceberg metadata beside its Delta log. Iceberg clients read the same Parquet files through the REST catalog. The check below compares the file lists.

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE TABLE {N['uniform']}
TBLPROPERTIES ('delta.enableIcebergCompatV2' = 'true', 'delta.universalFormat.enabledFormats' = 'iceberg')
AS SELECT * FROM {N['delta']}
""")
delta_side = {r["p"].rsplit("/", 1)[-1] for r in spark.table(N["uniform"]).select(F.col("_metadata.file_path").alias("p")).distinct().collect()}
# Iceberg metadata is generated after the Delta commit, so give it a moment to catch up.
for attempt in range(12):
    uniform = iceberg_layers(N["uniform"].split(".")[-1])
    iceberg_side = {f["file_path"].rsplit("/", 1)[-1] for f in uniform["files"]}
    if iceberg_side == delta_side:
        break
    time.sleep(10)
record("uniform", "same_parquet_files", "PASS" if delta_side == iceberg_side else "FAIL", f"Delta reads {len(delta_side)} files, Iceberg lists {len(iceberg_side)}, overlap {len(delta_side & iceberg_side)}")
record("uniform", "iceberg_metadata_json", short(uniform["metadata_location"]), f"written next to _delta_log; manifest list {short(uniform['manifest_list'])}")
iceberg_rows = uniform["table"].scan().to_arrow().num_rows
delta_rows = spark.table(N["uniform"]).count()
record("uniform", "row_count_matches", "PASS" if iceberg_rows == delta_rows else "FAIL", f"PyIceberg reads {iceberg_rows}, Spark reads {delta_rows}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the results

# COMMAND ----------

append_rows(spark, N["results"], results, RESULT_COLUMNS)
failed = [r["metric"] for r in results if r["value"] == "FAIL"]
if failed:
    raise Exception(f"Failed checks: {failed}")
display(spark.sql(f"SELECT format, metric, value, detail FROM {N['results']} WHERE run_id = '{RUN_ID}' AND step = 'metadata' ORDER BY format, metric"))
