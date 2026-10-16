# Databricks notebook source
# MAGIC %md
# MAGIC # 5. Compare the answers
# MAGIC
# MAGIC Pivots the before and after answers into one row per question (`ontology_comparison_summary`, replaced on each run) and prints how many answers match the expected result at each stage.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ontology", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
base = f"{params['catalog']}.{params['schema']}"
run_id = params["run_id"].replace("'", "")

# COMMAND ----------

spark.sql(
    f"""
    CREATE OR REPLACE TABLE {base}.ontology_comparison_summary AS
    SELECT b.run_id, b.question_id, b.question,
           b.genie_sql AS baseline_sql, b.matches_expected AS baseline_match,
           e.genie_sql AS enhanced_sql, e.matches_expected AS enhanced_match,
           b.expected_sql
    FROM {base}.ontology_comparison b
    JOIN {base}.ontology_comparison e
      ON b.run_id = e.run_id AND b.question_id = e.question_id AND e.stage = 'enhanced'
    WHERE b.stage = 'baseline' AND b.run_id = '{run_id}'
    ORDER BY b.question_id
    """
)
summary = spark.table(f"{base}.ontology_comparison_summary")
total = summary.count()
before = summary.filter("baseline_match").count()
after = summary.filter("enhanced_match").count()
print(f"Matches expected answer: baseline {before}/{total}, with semantics {after}/{total}")
for row in summary.select("question_id", "baseline_match", "enhanced_match").collect():
    print(f"  {row.question_id}: before={row.baseline_match} after={row.enhanced_match}")
if total == 0:
    raise RuntimeError("No comparison rows for this run")
