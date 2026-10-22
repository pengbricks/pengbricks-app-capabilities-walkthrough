# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. A small messy dataset with an answer key
# MAGIC
# MAGIC Writes 300 order records with the problems rules struggle with: a return reason in free text that may not match its code, addresses in several formats (some with no postal code), company names that repeat with typos and abbreviations, notes that hold names and phone numbers, and comments that contradict the order status.
# MAGIC
# MAGIC `aidq_records` holds the inputs only. `aidq_truth` holds the answer for every record and check. Keeping them apart means no AI call can read an answer by accident. The data comes from a fixed seed, so it is the same on every run. Safe to rerun: both tables are replaced and the step's rows in `aidq_results` are swapped, not added.

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

records, truth = q.generate_sample(int(spec["sample"]["rows"]), int(spec["sample"]["seed"]))
for table, rows, ddl in ((T["records"], records, q.RECORDS_DDL), (T["truth"], truth, q.TRUTH_DDL)):
    columns = [c.split()[0] for c in ddl.split(", ")]
    frame = spark.createDataFrame([tuple(r[c] for c in columns) for r in rows], ddl)
    frame.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
display(spark.sql(f"SELECT * FROM {T['records']} ORDER BY record_id LIMIT 25"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## How many of each problem the answer key holds

# COMMAND ----------

counts = spark.sql(f"""
SELECT count(*) AS records,
       sum(int(truth_reason_bad)) AS reason_code_wrong, sum(int(truth_address_bad)) AS address_without_postal_code,
       sum(int(truth_duplicate)) AS duplicate_companies, sum(int(truth_pii)) AS notes_with_sensitive_text,
       sum(int(truth_contradiction)) AS comments_that_contradict_status
FROM {T['truth']}""")
display(counts)
c = counts.first()
a.write_results(spark, T["results"], "sample", [
    ("records", c.records, f"seed {spec['sample']['seed']}"),
    ("reason_code_wrong", c.reason_code_wrong, ""),
    ("address_without_postal_code", c.address_without_postal_code, ""),
    ("duplicate_companies", c.duplicate_companies, ""),
    ("notes_with_sensitive_text", c.notes_with_sensitive_text, ""),
    ("comments_that_contradict_status", c.comments_that_contradict_status, ""),
], params["run_id"])
