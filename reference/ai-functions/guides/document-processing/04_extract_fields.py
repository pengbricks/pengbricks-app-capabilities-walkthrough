# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Schema-driven extraction
# MAGIC
# MAGIC **Pattern: one schema per document type, extraction by the route.** `ai_extract` takes the parsed text and a JSON schema with a type and a description for every field, and returns each field with a confidence score when `enableConfidenceScores` is on. The route from step 3 chooses the schema; documents on the `review` route are not extracted.
# MAGIC
# MAGIC Only the fields in the schema are requested. An invoice schema with four fields costs less than one that asks for every line item, and the validation step in step 5 only needs these four.
# MAGIC
# MAGIC Each response is stored as it came back in `dp_extract_responses`, then unpacked into a long table, one row per document and field, with the value, the confidence, and any error. Unpacking reads the stored response, so the model is called once per document, not once per field. Step 5 validates the long table. Safe to rerun: the extracted table and the step's rows in `dp_results` are replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_document_processing", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, run_id = params["catalog"], params["schema"], params["run_id"]

import json
from datetime import datetime, timezone
import aif_lib as a
import docproc_lib as d
spec = d.load_spec(str(bundle_root() / "use_cases" / "documents.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}
schemas = spec["extract"]["schemas"]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Extract per type
# MAGIC
# MAGIC Each type is one query. `ai_extract` runs once per document and its response is stored; a second query unpacks it into one row per field.

# COMMAND ----------

from pyspark.sql import functions as F

OPTIONS = "map('version', '2.1', 'enableConfidenceScores', 'true')"
started = datetime.now(timezone.utc)
spark.sql(f"DROP TABLE IF EXISTS {T['extracted_raw']}")
spark.sql(f"CREATE TABLE {T['extracted_raw']} (path STRING, file_name STRING, doc_type STRING, response VARIANT, extracted_at TIMESTAMP)")
sent = {}
for doc_type, fields in schemas.items():
    # One ai_extract call per document, stored as the raw response. Unpacking it into fields below reads this
    # table, so the model is never called again for each field.
    spark.sql(f"""
    INSERT INTO {T['extracted_raw']}
    SELECT c.path, c.file_name, '{doc_type}', ai_extract(p.text, {a.sql_string(d.schema_json(fields))}, {OPTIONS}), current_timestamp()
    FROM {T['classified']} c JOIN {T['parsed']} p ON c.path = p.path
    WHERE c.route = '{doc_type}'
    """)
    sent[doc_type] = spark.sql(f"SELECT count(*), coalesce(sum(chars), 0) FROM {T['parsed']} p JOIN {T['classified']} c ON c.path = p.path WHERE c.route = '{doc_type}'").first()

unpack = " UNION ALL ".join(
    f"SELECT path, file_name, doc_type, '{name}', response:response:{name}:value::STRING, response:response:{name}:confidence_score::DOUBLE, response:error_message::STRING "
    f"FROM {T['extracted_raw']} WHERE doc_type = '{doc_type}'"
    for doc_type, fields in schemas.items() for name in fields)
spark.sql(f"CREATE OR REPLACE TABLE {T['extracted']} AS SELECT * FROM ({unpack}) AS t(path, file_name, doc_type, field, value, confidence, extract_error)")
ended = datetime.now(timezone.utc)
docs = sum(n for n, _ in sent.values())
chars = sum(int(c) for _, c in sent.values())
display(spark.table(T["extracted"]).orderBy("file_name", "field"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Score against the answer key
# MAGIC
# MAGIC Every field is compared with `dp_truth`: numbers within one cent, dates exactly, text after dropping case and punctuation. A field that should be empty (the invoice with no total, the form with no date) is correct only if it comes back empty.

# COMMAND ----------

truth = {r.file_name: (r.doc_type, json.loads(r.fields)) for r in spark.table(T["truth"]).collect()}
got = {}
for r in spark.table(T["extracted"]).collect():
    got.setdefault(r.file_name, {})[r.field] = r.value
checked = ok = 0
wrong = []
for file_name, (doc_type, expected) in truth.items():
    for field, want in expected.items():
        spec_type = schemas[doc_type][field]["type"]
        if file_name not in got or field not in got[file_name]:
            continue  # not extracted (wrong route or review): counted below
        checked += 1
        if d.value_matches(field, spec_type, want, got[file_name][field]):
            ok += 1
        else:
            wrong.append(f"{file_name}:{field}={got[file_name][field]!r} (expected {want!r})")
missing_docs = [f for f in truth if f not in got]
display(spark.createDataFrame([(w,) for w in wrong] or [("none",)], "wrong_field string"))
a.write_results(spark, T["results"], "extract", [
    ("documents_extracted", len(got), f"{len(missing_docs)} not extracted: {missing_docs}"),
    ("fields_checked", checked, ""),
    ("field_accuracy", ok / checked if checked else 0.0, f"{ok} of {checked}; wrong: {wrong}"),
    ("seconds", (ended - started).total_seconds(), "extract every document"),
    ("input_chars", chars, "characters of parsed text sent to ai_extract"),
], run_id)
d.log_step(spark, T["run_log"], run_id, "extract", started, ended, documents=docs, input_chars=chars)
