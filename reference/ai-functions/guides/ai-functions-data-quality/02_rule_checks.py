# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Rule checks first
# MAGIC
# MAGIC Each check starts as plain SQL. A rule returns `pass` or `fail` when it can be sure, and `unknown` when it cannot. The `unknown` rows are the residue, and they are the only rows the next notebook sends to a model. Rules cost compute only, so every row that a rule settles saves a model call.
# MAGIC
# MAGIC The SQL for each rule is built in `src/aidq_lib.py` (`rule_queries`) from the keyword, pattern, and block settings in `use_cases/data_quality.yml`. In a pipeline the same logic fits Lakeflow Declarative Pipelines expectations. Here it writes one results table so the AI step can read it. Safe to rerun: `aidq_rule_results` is replaced and the step's rows in `aidq_results` are swapped, not added.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ai_functions_data_quality", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]

import aif_lib as a
import aidq_lib as q
spec = q.load_spec(str(bundle_root() / "use_cases" / "data_quality.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}

# COMMAND ----------

queries = q.rule_queries(spec, T["records"])
union = "\nUNION ALL\n".join(f"({sql})" for sql in queries.values())
spark.sql(f"CREATE OR REPLACE TABLE {T['rule_results']} AS SELECT record_id, check_name, verdict, reason, current_timestamp() AS checked_at FROM ({union})")
display(spark.sql(f"""
SELECT check_name, sum(int(verdict = 'pass')) AS pass, sum(int(verdict = 'fail')) AS fail, sum(int(verdict = 'unknown')) AS unknown,
       round(avg(int(verdict = 'unknown')), 3) AS residue_share
FROM {T['rule_results']} GROUP BY check_name ORDER BY check_name"""))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Rows the rules could not judge

# COMMAND ----------

display(spark.sql(f"""
SELECT r.check_name, r.record_id, r.reason AS why_unknown,
       CASE r.check_name WHEN 'reason_code' THEN concat(t.reason_code, ' | ', t.reason_text) WHEN 'address' THEN t.address_raw
            WHEN 'duplicate_company' THEN t.company_raw WHEN 'sensitive_note' THEN t.note ELSE concat(t.order_status, ' | ', t.comment) END AS input
FROM {T['rule_results']} r JOIN {T['records']} t USING (record_id)
WHERE r.verdict = 'unknown' AND r.record_id <= 40 ORDER BY r.check_name, r.record_id"""))

# COMMAND ----------

total = spark.table(T["records"]).count()
rows = spark.sql(f"SELECT check_name, count_if(verdict = 'unknown') AS unknown FROM {T['rule_results']} GROUP BY check_name ORDER BY check_name").collect()
a.write_results(spark, T["results"], "rules", [
    (f"{r.check_name}_residue_share", q.residue_share(r.unknown, total), f"{r.unknown} of {total} rows go to AI") for r in rows
], params["run_id"])
