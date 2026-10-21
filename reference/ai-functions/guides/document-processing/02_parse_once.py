# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Parse once, store, reuse
# MAGIC
# MAGIC **Pattern: parse each document once and keep the output.** `ai_parse_document` reads a file's bytes and returns text, layout, tables, and OCR text for scans as a VARIANT. It is the most expensive call in the pipeline per page, so the notebook parses only files that are in the landing table and not yet in the parsed table, and stores the whole result. Classification, extraction, masking, search, and any later question read the stored table.
# MAGIC
# MAGIC The notebook runs the same insert twice. The first pass parses every file. The second finds nothing pending and parses nothing, which is what keeps a rerun, a retry, or a daily schedule from paying for the same page twice.
# MAGIC
# MAGIC Limits from the function's docs: 500 pages and 100 MB per document. A longer document fails unless you pass `pageRange`. Safe to rerun: new files are added, files already parsed are skipped, and the step's rows in `dp_results` are replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_document_processing", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, run_id = params["catalog"], params["schema"], params["run_id"]

from datetime import datetime, timezone
import aif_lib as a
import docproc_lib as d
spec = d.load_spec(str(bundle_root() / "use_cases" / "documents.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}
volume = f"/Volumes/{catalog}/{schema}/{spec['volume']}"
landing = f"{volume}/{spec['landing_folder']}"

spark.sql(f"""
CREATE TABLE IF NOT EXISTS {T['parsed']} (
  path STRING, file_name STRING, parsed_at TIMESTAMP, doc VARIANT, parse_errors INT, pages INT, text STRING, chars INT)
""")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Parse what is pending
# MAGIC
# MAGIC The anti-join against the parsed table is the "once". The error count uses `array_size(try_variant_get(...))` because a JSON null inside a VARIANT is a value, not SQL NULL, so `doc:error_status IS NULL` would drop every row.

# COMMAND ----------

def parse_pending() -> int:
    before = spark.table(T["parsed"]).count()
    spark.sql(f"""
    INSERT INTO {T['parsed']}
    SELECT path, element_at(split(path, '/'), -1), current_timestamp(), doc,
           coalesce(array_size(try_variant_get(doc, '$.error_status', 'ARRAY<VARIANT>')), 0),
           array_size(cast(doc:document:pages AS ARRAY<VARIANT>)),
           concat_ws('\\n', transform(cast(doc:document:elements AS ARRAY<VARIANT>), e -> e:content::STRING)) AS text,
           0
    FROM (
      SELECT f.path, ai_parse_document(f.content, map('version', '2.0')) AS doc
      FROM read_files('{landing}', format => 'binaryFile', pathGlobFilter => '*.pdf') f
      LEFT SEMI JOIN {T['raw']} r ON f.path = r.path
      LEFT ANTI JOIN {T['parsed']} p ON f.path = p.path
    )
    """)
    spark.sql(f"UPDATE {T['parsed']} SET chars = length(text) WHERE chars = 0")
    return spark.table(T["parsed"]).count() - before

started = datetime.now(timezone.utc)
first = parse_pending()
ended = datetime.now(timezone.utc)
second = parse_pending()
print(f"first pass parsed {first} documents in {(ended - started).total_seconds():.0f}s; second pass parsed {second}")

# COMMAND ----------

from pyspark.sql import functions as F

totals = spark.table(T["parsed"]).agg(F.count("*").alias("docs"), F.sum("pages").alias("pages"), F.sum("chars").alias("chars"),
                                       F.sum(F.when(F.col("parse_errors") > 0, 1).otherwise(0)).alias("errors")).first()
display(spark.table(T["parsed"]).select("file_name", "pages", "parse_errors", "chars", "text").orderBy("file_name"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## What the parser returned for one scanned receipt
# MAGIC
# MAGIC The receipt PDFs contain only an image. Every word below came from OCR.

# COMMAND ----------

display(spark.sql(f"""
SELECT e:type::STRING AS type, round(e:confidence::DOUBLE, 3) AS confidence, e:content::STRING AS content
FROM {T['parsed']} LATERAL VIEW explode(cast(doc:document:elements AS ARRAY<VARIANT>)) AS e
WHERE file_name = 'RCT-5001.pdf'"""))

# COMMAND ----------

a.write_results(spark, T["results"], "parse", [
    ("documents_parsed", totals.docs, "rows in the parsed table"),
    ("pages_parsed", totals.pages, "pages across all documents"),
    ("parse_errors", totals.errors, "documents whose parse returned an error"),
    ("parse_first_pass", first, "documents parsed on the first pass"),
    ("parse_second_pass", second, "documents parsed on the second pass; 0 means no page is parsed twice"),
    ("parse_seconds", (ended - started).total_seconds(), "wall time for the first pass"),
    ("parsed_chars", totals.chars, "characters of text kept"),
], run_id)
d.log_step(spark, T["run_log"], run_id, "parse", started, ended, documents=totals.docs, pages=totals.pages, input_chars=totals.chars)
