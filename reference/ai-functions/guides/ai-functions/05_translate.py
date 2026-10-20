# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Translate with ai_query
# MAGIC
# MAGIC `ai_translate` does not cover Japanese, so this step calls `ai_query` with a pay-per-token model from the spec. Not every pay-per-token endpoint accepts batch calls: in the reference workspace `databricks-claude-haiku-5-5` and `databricks-claude-sonnet-5-5` returned "not supported for batch inference", and Llama 3.3 70B, GPT OSS 120B, Claude Sonnet 4.6, and GPT-5 mini worked. `failOnError => false` returns a struct with `result` and `errorMessage`, so one bad row does not fail the batch. Safe to rerun: the table is replaced and the step's rows in `aif_results` are swapped, not added.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ai_functions", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]

import aif_lib as a
spec = a.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}
translated = a.fq(catalog, schema, spec["tables"]["reviews"] + "_translated")

# COMMAND ----------

import time

t = spec["translate"]
prompt = a.sql_string(f"Translate to {t['language']}. Return only the translation: ")
start = time.perf_counter()
spark.sql(f"""
CREATE OR REPLACE TABLE {translated} AS
SELECT review_id, text, r.result AS translation, r.errorMessage AS error
FROM (SELECT review_id, text, ai_query({a.sql_string(t['endpoint'])}, concat({prompt}, text), failOnError => false) AS r
      FROM {T['reviews']})
""")
translate_seconds = time.perf_counter() - start
rows = spark.table(translated).collect()
display(spark.table(translated))
japanese = [r for r in rows if r.translation and any("\u3040" <= ch <= "\u30ff" or "\u4e00" <= ch <= "\u9fff" for ch in r.translation)]

a.write_results(spark, T["results"], "translate", [
    ("reviews", len(rows), f"endpoint {t['endpoint']}"),
    ("errors", sum(1 for r in rows if r.error), ""),
    ("in_target_script", len(japanese), "rows whose output contains Japanese characters"),
    ("seconds", translate_seconds, ""),
], params["run_id"])
