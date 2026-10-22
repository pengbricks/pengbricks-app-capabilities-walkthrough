# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. AI checks on the residue only
# MAGIC
# MAGIC Each check joins `aidq_rule_results` and keeps rows where the verdict is `unknown`, so a model sees only what the rules could not judge. Five functions, one per check:
# MAGIC
# MAGIC | Check | Function | Verdict |
# MAGIC |---|---|---|
# MAGIC | `reason_code` | `ai_classify` (version 2.1, confidence scores) | `pass` when the label matches the submitted code, `fail` when not, `review` under the confidence floor |
# MAGIC | `address` | `ai_extract` (version 2.1) | `pass` when a five-digit postal code comes back, `fail` when not |
# MAGIC | `duplicate_company` | `ai_similarity` over blocked pairs | `fail` at or above `fail_at`, `pass` below `pass_below`, `review` in between |
# MAGIC | `sensitive_note` | `ai_mask` | `fail` when masking changed the note |
# MAGIC | `status_comment` | `ai_query` with `responseFormat`, `modelParameters` (temperature 0.0), and `failOnError => false` | `pass` or `fail` with a reason, `review` when the response cannot be read |
# MAGIC
# MAGIC Each call runs once and the response is stored in `aidq_ai_results`. The quality table, the quarantine table, and the accepted table read stored results, so reporting never calls a model again. Anything the model cannot settle goes to `review`, which is a person.
# MAGIC
# MAGIC Safe to rerun: every table is replaced and the step's rows in `aidq_results` are swapped, not added. AI results can differ slightly between runs for borderline rows, so counts in `aidq_quarantine` and `aidq_records_accepted` can move by a row or two. Judge a change by precision and recall in notebook 4, not by exact counts. Required setup: AI Functions in the workspace region, and an `ai_query` endpoint that serves batch calls (see `00_start_here`). Beta and Preview: `ai_fix_grammar`, mentioned in the walkthrough, is Public Preview and is not run here.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ai_functions_data_quality", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]

import json
from datetime import datetime, timezone
import aif_lib as a
import aidq_lib as q
spec = q.load_spec(str(bundle_root() / "use_cases" / "data_quality.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}
ai_rows, calls = [], []   # (record_id, check_name, verdict, reason, confidence, raw, model) and one call log row per check


def residue(check):
    """The records of this check that the rules left unknown."""
    return f"JOIN {T['rule_results']} u ON u.record_id = t.record_id AND u.check_name = '{check}' AND u.verdict = 'unknown'"


def log_call(check, function, rows, chars, started):
    calls.append((check, function, int(rows), int(chars), started, datetime.now(timezone.utc)))
    print(f"{check}: {rows} rows sent to {function}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## reason_code: `ai_classify` validates a category against its free text
# MAGIC
# MAGIC The labels are a JSON object, so each description becomes part of the prompt. `enableConfidenceScores` returns a score from 0 to 1 per label, and rows under `reason.min_confidence` go to review.

# COMMAND ----------

labels = a.sql_string(q.classify_labels_json(spec))
started = datetime.now(timezone.utc)
rows = spark.sql(f"""
SELECT record_id, reason_code, cast(r AS STRING) AS raw, chars FROM (
  SELECT t.record_id, t.reason_code, length(t.reason_text) AS chars,
         ai_classify(t.reason_text, {labels}, map('version', '2.1', 'enableConfidenceScores', 'true')) AS r
  FROM {T['records']} t {residue('reason_code')} WHERE t.reason_text IS NOT NULL)""").collect()
floor = float(spec["reason"]["min_confidence"])
for r in rows:
    label, confidence, error = q.parse_classify(r.raw)
    verdict, reason = q.classify_verdict(label, confidence, r.reason_code, floor)
    ai_rows.append((r.record_id, "reason_code", verdict, error or reason, confidence, r.raw, "ai_classify 2.1"))
log_call("reason_code", "ai_classify", len(rows), sum(r.chars for r in rows), started)

# COMMAND ----------

# MAGIC %md
# MAGIC ## address: `ai_extract` standardizes an address into fields
# MAGIC
# MAGIC The schema names four fields with a type and a description each. The postal code field says to return null when the text has none, so a made-up code is less likely. The verdict checks the extracted postal code, and notebook 4 scores the extracted postal code and state against the answer key.

# COMMAND ----------

schema_literal = a.sql_string(q.extract_schema_json())
started = datetime.now(timezone.utc)
rows = spark.sql(f"""
SELECT record_id, cast(r AS STRING) AS raw, chars FROM (
  SELECT t.record_id, length(t.address_raw) AS chars,
         ai_extract(t.address_raw, {schema_literal}, map('version', '2.1', 'enableConfidenceScores', 'true')) AS r
  FROM {T['records']} t {residue('address')} WHERE t.address_raw IS NOT NULL)""").collect()
for r in rows:
    values, error = q.parse_extract(r.raw, ["street", "city", "state", "postal_code"])
    verdict, reason = q.extract_verdict(values, error)
    ai_rows.append((r.record_id, "address", verdict, reason, None, r.raw, "ai_extract 2.1"))
log_call("address", "ai_extract", len(rows), sum(r.chars for r in rows), started)

# COMMAND ----------

# MAGIC %md
# MAGIC ## duplicate_company: `ai_similarity` on blocked pairs
# MAGIC
# MAGIC A full cross join would call the model once per pair of records. Blocking on the first letters of the normalized name keeps only pairs that could match, and `max_pairs` caps the count. The cost of blocking is recall: a duplicate whose first letters differ is never compared. Each pair is scored once and saved in `aidq_duplicate_pairs`. `ai_similarity` returns a relative score meant for ranking, so the two thresholds in the spec are starting points to tune on the labels.

# COMMAND ----------

key = "regexp_replace(regexp_replace(lower({c}), '(^| )(inc|llc|ltd|corp|co|company)[.,]?( |$)', ' '), '[^a-z0-9]', '')"
block = int(spec["duplicates"]["block_chars"])
started = datetime.now(timezone.utc)
spark.sql(f"""
CREATE OR REPLACE TABLE {T['duplicate_pairs']} AS
SELECT record_id, earlier_id, ai_similarity(company_raw, earlier_name) AS score FROM (
  SELECT t.record_id, t.company_raw, e.record_id AS earlier_id, e.company_raw AS earlier_name
  FROM {T['records']} t {residue('duplicate_company')}
  JOIN {T['records']} e ON e.record_id < t.record_id
   AND left({key.format(c='e.company_raw')}, {block}) = left({key.format(c='t.company_raw')}, {block})
  ORDER BY t.record_id, e.record_id LIMIT {int(spec['duplicates']['max_pairs'])})""")
best = spark.sql(f"""
SELECT record_id, max_by(earlier_id, score) AS closest, max(score) AS score FROM {T['duplicate_pairs']} GROUP BY record_id""").collect()
pairs_scored = spark.table(T["duplicate_pairs"]).count()
chars = spark.sql(f"SELECT coalesce(sum(length(t.company_raw) + length(e.company_raw)), 0) FROM {T['duplicate_pairs']} p JOIN {T['records']} t ON t.record_id = p.record_id JOIN {T['records']} e ON e.record_id = p.earlier_id").first()[0]
fail_at, pass_below = float(spec["duplicates"]["fail_at"]), float(spec["duplicates"]["pass_below"])
for r in best:
    verdict = q.similarity_verdict(r.score, fail_at, pass_below)
    ai_rows.append((r.record_id, "duplicate_company", verdict, f"closest earlier record {r.closest} scored {r.score:.2f}", r.score, None, "ai_similarity"))
log_call("duplicate_company", "ai_similarity", pairs_scored, chars, started)
display(spark.sql(f"SELECT * FROM {T['duplicate_pairs']} ORDER BY score DESC LIMIT 20"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## sensitive_note: `ai_mask` finds sensitive values in free text
# MAGIC
# MAGIC `ai_mask` returns the note with sensitive spans replaced by `[MASKED]`. Comparing the output with the input turns masking into detection: a changed note held something sensitive. The patterns in notebook 2 catch emails and phone numbers, so the residue here is names and places the patterns cannot recognize. For columns, not free text, use Data Classification in Unity Catalog. Masking is model-based, so notebook 4 measures it.

# COMMAND ----------

mask_labels = "array(" + ", ".join(a.sql_string(x) for x in spec["pii"]["labels"]) + ")"
started = datetime.now(timezone.utc)
rows = spark.sql(f"""
SELECT record_id, note, masked, length(note) AS chars FROM (
  SELECT t.record_id, t.note, ai_mask(t.note, {mask_labels}) AS masked
  FROM {T['records']} t {residue('sensitive_note')} WHERE t.note IS NOT NULL)""").collect()
for r in rows:
    verdict, reason = q.mask_verdict(r.note, r.masked)
    ai_rows.append((r.record_id, "sensitive_note", verdict, reason, None, r.masked, "ai_mask"))
log_call("sensitive_note", "ai_mask", len(rows), sum(r.chars for r in rows), started)

# COMMAND ----------

# MAGIC %md
# MAGIC ## status_comment: `ai_query` with structured output returns pass, fail, and a reason
# MAGIC
# MAGIC `responseFormat` takes a JSON schema, so the model returns `{"verdict": "pass" | "fail", "reason": "..."}` instead of free text. `failOnError => false` returns a struct with `response` and `errorMessage` (per the ai_query docs), so one bad row does not fail the batch. The SQL reads the struct with `to_json` and the code accepts either `response` or the older `result` key. `modelParameters => named_struct('temperature', 0.0)` asks for the least random output; it lowers the variance and does not remove it. `ai_classify`, `ai_extract`, `ai_similarity`, and `ai_mask` document no determinism option. A response that is not the expected JSON becomes `review`. Structured output needs a chat model; if the endpoint rejects batch calls or `responseFormat`, the `errorMessage` shows it and every row lands in review.

# COMMAND ----------

fmt = a.sql_string(q.response_format_json())
instructions = a.sql_string(q.VALIDATION_INSTRUCTIONS)
endpoint = a.sql_string(spec["endpoint"])
started = datetime.now(timezone.utc)
rows = spark.sql(f"""
SELECT record_id, to_json(r) AS payload, chars FROM (
  SELECT t.record_id, length(t.order_status) + length(t.comment) AS chars,
         ai_query({endpoint}, concat({instructions}, ' Status: ', t.order_status, '. Comment: ', t.comment),
                  responseFormat => {fmt}, modelParameters => {q.MODEL_PARAMETERS_SQL}, failOnError => false) AS r
  FROM {T['records']} t {residue('status_comment')} WHERE t.comment IS NOT NULL)""").collect()
for r in rows:
    raw, error = q.split_query_struct(r.payload)
    verdict, reason = q.parse_verdict(raw)
    ai_rows.append((r.record_id, "status_comment", verdict, error or reason, None, raw, spec["endpoint"]))
log_call("status_comment", "ai_query", len(rows), sum(r.chars for r in rows), started)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the results, quarantine the failures, join back
# MAGIC
# MAGIC `aidq_quality_results` has one row per record and check: the rule verdict where a rule settled it, the AI verdict where not, with a `source` column. `aidq_quarantine` lists each record with a failed or review check and the reasons. `aidq_records_accepted` is the records with no failed or review check, joined back from the source table.

# COMMAND ----------

AI_DDL = "record_id int, check_name string, verdict string, reason string, confidence double, raw string, model string"
spark.createDataFrame(ai_rows, AI_DDL).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(T["ai_results"])
CALL_DDL = "check_name string, function string, rows_sent long, chars_sent long, started_at timestamp, ended_at timestamp"
spark.createDataFrame(calls, CALL_DDL).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(T["ai_calls"])

spark.sql(f"CREATE OR REPLACE TABLE {T['quality']} AS {q.combine_sql(T['rule_results'], T['ai_results'])}")
spark.sql(f"CREATE OR REPLACE TABLE {T['quarantine']} AS {q.quarantine_sql(T['quality'])}")
spark.sql(f"""CREATE OR REPLACE TABLE {T['accepted']} AS
SELECT t.* FROM {T['records']} t LEFT ANTI JOIN {T['quarantine']} z ON z.record_id = t.record_id""")

total = spark.table(T["records"]).count()
expected, actual = total * len(q.CHECKS), spark.table(T["quality"]).count()
assert actual == expected, f"quality table has {actual} rows, expected {expected}: some record and check has no verdict"
display(spark.sql(f"SELECT check_name, source, verdict, count(*) AS rows FROM {T['quality']} GROUP BY ALL ORDER BY check_name, source, verdict"))
display(spark.sql(f"SELECT * FROM {T['quarantine']} ORDER BY record_id LIMIT 25"))

quarantined, accepted = spark.table(T["quarantine"]).count(), spark.table(T["accepted"]).count()
a.write_results(spark, T["results"], "ai", [
    ("quality_rows", actual, f"{total} records x {len(q.CHECKS)} checks"),
    ("quarantined_records", quarantined, "at least one failed or review check"),
    ("accepted_records", accepted, "no failed or review check"),
    *[(f"{c}_rows_to_ai", n, f) for c, f, n, _, _, _ in calls],
], params["run_id"])
