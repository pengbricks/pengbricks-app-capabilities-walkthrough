# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Land documents and track them
# MAGIC
# MAGIC **Pattern: land and track documents incrementally.** Files go into a Unity Catalog volume and stay there unchanged. Auto Loader reads the folder with the `binaryFile` format and writes one row per file to a table: the path, size, and modification time, plus when it was ingested. The table holds metadata only. The original bytes stay in the volume, and later steps read them from there.
# MAGIC
# MAGIC The notebook generates 28 sample documents of four types: invoices (two run to a second page, one is missing its total), request forms, letters, and scanned receipts (images with no text layer, one of them faint and tilted). Everything is made up. `dp_truth` holds the answer key for each file.
# MAGIC
# MAGIC Auto Loader remembers which files it has seen. The notebook runs it twice to show that: the first pass ingests every file, the second finds nothing new.
# MAGIC
# MAGIC Safe to rerun: the landing folder, the checkpoint, and every table this guide writes (except the run log) are cleared first, so each run starts from the same state and the cost measurement covers the whole pipeline.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_document_processing", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, run_id = params["catalog"], params["schema"], params["run_id"]

import shutil, json
from datetime import datetime, timezone
import aif_lib as a
import docproc_lib as d
spec = d.load_spec(str(bundle_root() / "use_cases" / "documents.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}
volume = f"/Volumes/{catalog}/{schema}/{spec['volume']}"
landing = f"{volume}/{spec['landing_folder']}"
checkpoint = f"{volume}/_checkpoints/{spec['landing_folder']}"

spark.sql(f"CREATE SCHEMA IF NOT EXISTS `{catalog}`.`{schema}`")
spark.sql(f"CREATE VOLUME IF NOT EXISTS {a.fq(catalog, schema, spec['volume'])}")
started = datetime.now(timezone.utc)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Start clean, then write the documents

# COMMAND ----------

for key in ["raw", "parsed", "classified", "extracted_raw", "extracted", "validated", "quarantine", "masked", "truth", "billing"]:
    spark.sql(f"DROP TABLE IF EXISTS {T[key]}")
shutil.rmtree(landing, ignore_errors=True)
shutil.rmtree(checkpoint, ignore_errors=True)
os.makedirs(landing)

docs = d.documents(spec)
for doc in docs:
    d.render_document(doc, f"{landing}/{doc['file']}")

spark.createDataFrame(
    [(x["file"], x["doc_type"], json.dumps(x["fields"]), x["planted"], x["expect_quarantine"]) for x in docs],
    "file_name string, doc_type string, fields string, planted array<string>, expect_quarantine boolean",
).write.mode("overwrite").saveAsTable(T["truth"])
display(spark.table(T["truth"]).orderBy("file_name"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Ingest with Auto Loader
# MAGIC
# MAGIC `cloudFiles` with `binaryFile` and `trigger(availableNow=True)`: process what is new, then stop. Dropping `content` keeps the table small; the file in the volume is the original.

# COMMAND ----------

from pyspark.sql import functions as F

def ingest():
    stream = (spark.readStream.format("cloudFiles")
              .option("cloudFiles.format", "binaryFile")
              .option("pathGlobFilter", "*.pdf")
              .load(landing)
              .select(F.col("path"), F.element_at(F.split("path", "/"), -1).alias("file_name"),
                      F.col("length").alias("size_bytes"), F.col("modificationTime").alias("modified_at"),
                      F.current_timestamp().alias("ingested_at")))
    query = (stream.writeStream.option("checkpointLocation", checkpoint).trigger(availableNow=True).toTable(T["raw"]))
    query.awaitTermination()

before = spark.table(T["raw"]).count() if spark.catalog.tableExists(T["raw"]) else 0
ingest()
first = spark.table(T["raw"]).count() - before
before = spark.table(T["raw"]).count()
ingest()
second = spark.table(T["raw"]).count() - before
print(f"first pass ingested {first} files; second pass ingested {second}")
display(spark.table(T["raw"]).orderBy("file_name"))

# COMMAND ----------

ended = datetime.now(timezone.utc)
sizes = spark.table(T["raw"]).agg(F.sum("size_bytes")).first()[0]
a.write_results(spark, T["results"], "land", [
    ("documents", len(docs), "sample PDFs generated into the volume"),
    ("auto_loader_first_pass", first, "files ingested"),
    ("auto_loader_second_pass", second, "files ingested on the next pass; 0 means nothing is read twice"),
    ("landed_bytes", float(sizes), "total size of the original files, kept unchanged in the volume"),
], run_id)
d.log_step(spark, T["run_log"], run_id, "land", started, ended, documents=len(docs))
