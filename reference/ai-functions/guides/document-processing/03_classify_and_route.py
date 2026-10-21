# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Classify and route by type
# MAGIC
# MAGIC **Pattern: classify first, then send each type down its own path.** `ai_classify` reads the parsed text and returns a label with a confidence score. The label picks the extraction schema in step 4, so an invoice is never asked for a letter's fields. A document whose confidence is below the threshold in the spec (0.7) goes to the `review` route instead of guessing.
# MAGIC
# MAGIC The labels carry a one-line description each, which is part of the prompt. The notebook scores the result against `dp_truth` and shows the routes.
# MAGIC
# MAGIC Safe to rerun: the classified table and the step's rows in `dp_results` are replaced.

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
labels = a.sql_string(json.dumps(spec["classify"]["labels"]))
threshold = float(spec["classify"]["min_confidence"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Classify every parsed document
# MAGIC
# MAGIC Version 2.1 returns `response` as an array of `{value, confidence_score}`. Text is cut to 6,000 characters, which is more than any sample document has. Documents whose parse failed are not classified.

# COMMAND ----------

started = datetime.now(timezone.utc)
spark.sql(f"""
CREATE OR REPLACE TABLE {T['classified']} AS
SELECT path, file_name,
       r:response[0]:value::STRING AS predicted_type,
       r:response[0]:confidence_score::DOUBLE AS confidence,
       CASE WHEN r:error_message::STRING IS NOT NULL OR r:response[0]:confidence_score::DOUBLE < {threshold} THEN 'review'
            ELSE r:response[0]:value::STRING END AS route,
       r:error_message::STRING AS classify_error
FROM (SELECT path, file_name,
             ai_classify(left(text, 6000), {labels}, map('version', '2.1', 'enableConfidenceScores', 'true')) AS r
      FROM {T['parsed']} WHERE parse_errors = 0)
""")
ended = datetime.now(timezone.utc)
scored = spark.sql(f"""
SELECT c.file_name, t.doc_type AS expected_type, c.predicted_type, round(c.confidence, 3) AS confidence, c.route, c.classify_error
FROM {T['classified']} c JOIN {T['truth']} t USING (file_name) ORDER BY c.file_name""")
display(scored)

# COMMAND ----------

rows = scored.collect()
correct = sum(r.expected_type == r.predicted_type for r in rows)
routes = {}
for r in rows:
    routes[r.route] = routes.get(r.route, 0) + 1
chars = spark.sql(f"SELECT sum(least(chars, 6000)) FROM {T['parsed']} WHERE parse_errors = 0").first()[0]
display(spark.createDataFrame(list(routes.items()), "route string, documents long"))
a.write_results(spark, T["results"], "classify", [
    ("documents", len(rows), ""),
    ("type_accuracy", correct / len(rows), f"{correct} of {len(rows)} documents got the right type"),
    ("routed_to_review", routes.get("review", 0), f"confidence below {threshold:g} or an error"),
    ("seconds", (ended - started).total_seconds(), "classify every document"),
    ("input_chars", chars, "characters sent to ai_classify"),
], run_id)
d.log_step(spark, T["run_log"], run_id, "classify", started, ended, documents=len(rows), input_chars=chars)
