# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Mask personal data, then match company names
# MAGIC
# MAGIC `ai_mask` replaces names, emails, and phone numbers in free-text call notes and saves the result to `aif_call_notes_masked`. The check looks for every planted value in the masked text. `ai_similarity` then scores account names against vendor names within the same country, saves every scored pair to `aif_account_vendor_scores`, and counts a pair as a match above the threshold. Precision and recall come from the known matches in the spec.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ai_functions", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]

import aif_lib as a
spec = a.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}
masked_table = a.fq(catalog, schema, spec["tables"]["call_notes"] + "_masked")
scores_table = a.fq(catalog, schema, "aif_account_vendor_scores")

# COMMAND ----------

import time

labels = "array(" + ", ".join(a.sql_string(label) for label in spec["mask"]["labels"]) + ")"
start = time.perf_counter()
spark.sql(f"""
CREATE OR REPLACE TABLE {masked_table} AS
SELECT note_id, ai_mask(note, {labels}) AS note, planted
FROM {T['call_notes']}
""")
mask_seconds = time.perf_counter() - start
masked = spark.table(masked_table).collect()
display(spark.table(masked_table).select("note_id", "note"))

leaks = {r.note_id: a.leaked(r.note, list(r.planted)) for r in masked}
planted = sum(len(r.planted) for r in masked)
leaked_values = [f"{note}:{value}" for note, values in leaks.items() for value in values]

# COMMAND ----------

# MAGIC %md
# MAGIC The join is blocked on country, so the model scores 3 to 5 pairs per account instead of every pair. Each pair is scored once and the score is saved; the threshold filter reads the saved score.

# COMMAND ----------

start = time.perf_counter()
spark.sql(f"""
CREATE OR REPLACE TABLE {scores_table} AS
SELECT a.account_id, a.name AS account_name, v.vendor_id, v.name AS vendor_name,
       ai_similarity(a.name, v.name) AS score
FROM {T['accounts']} a JOIN {T['vendors']} v ON a.country = v.country
""")
match_seconds = time.perf_counter() - start
threshold = float(spec["match"]["threshold"])
scored = spark.table(scores_table).collect()
predicted = {(r.account_id, r.vendor_id) for r in scored if r.score > threshold}
expected = {tuple(pair) for pair in spec["matches"]}
scores = a.match_scores(predicted, expected)
display(spark.table(scores_table).orderBy("account_id", "score"))

a.write_results(spark, T["results"], "mask", [
    ("notes", len(masked), ""),
    ("values_planted", planted, ""),
    ("values_leaked", len(leaked_values), ", ".join(leaked_values)),
    ("seconds", mask_seconds, ""),
], params["run_id"])
a.write_results(spark, T["results"], "match", [
    ("pairs_scored", len(scored), "accounts x vendors in the same country"),
    ("threshold", threshold, ""),
    *[(k, v, "") for k, v in scores.items()],
    ("seconds", match_seconds, ""),
], params["run_id"])
