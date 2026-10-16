# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Record
# MAGIC
# MAGIC Writes the statement list, the summary and the role-based effort estimate, then logs the run. The three assessment tables are overwritten. `etl_log` gets one row per run. Needs the tables from `02_convert` and `03_reconcile`.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_legacy_conversion_assessment", ["catalog", "schema", "use_case"])
catalog, schema = params["catalog"], params["schema"]

import datetime
from lc_common import fq, load_spec, write_table
import lc_helpers as h
spec = load_spec(bundle_root(), params["use_case"])
cat, sch = catalog, schema
ts = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Statements and summary

# COMMAND ----------

conv = spark.table(fq(cat, sch, "assessment_conversion")).orderBy("step_id").collect()
write_table(spark, [(r.step_id, r.step_name, r.construct, r.status, r.notes, r.executed_from, ts) for r in conv],
            "step_id INT, step_name STRING, construct STRING, status STRING, notes STRING, executed_from STRING, assessed_at TIMESTAMP",
            cat, sch, "assessment_statements")

summary, counts = h.summarize([r.status for r in conv])
tests = spark.table(fq(cat, sch, "assessment_test_results")).collect()
passed = sum(1 for t in tests if t.passed)
write_table(spark, [(spec["name"], summary["total_statements"], summary["clean_count"], summary["warning_count"],
                     summary["manual_count"], summary["automated_coverage_pct"], summary["remediation_count"],
                     passed, len(tests) - passed, ts)],
            "use_case STRING, total_statements INT, clean_count INT, warning_count INT, manual_count INT, "
            "automated_coverage_pct DOUBLE, remediation_count INT, tests_passed INT, tests_failed INT, assessed_at TIMESTAMP",
            cat, sch, "assessment_summary")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Effort per role
# MAGIC
# MAGIC Hours come from the counts of clean, warning and manual steps and the assumptions in the spec. The assumption is stored with each row.

# COMMAND ----------

eff = h.effort_model(counts, spec["effort"])
write_table(spark, [(spec["name"], e["role"], e["clean_hours"], e["warning_hours"], e["manual_hours"], e["fixed_hours"],
                     e["total_hours"], e["assumption"]) for e in eff],
            "use_case STRING, role STRING, clean_hours DOUBLE, warning_hours DOUBLE, manual_hours DOUBLE, fixed_hours DOUBLE, "
            "total_hours DOUBLE, assumption STRING", cat, sch, "assessment_effort")
display(spark.table(fq(cat, sch, "assessment_effort")))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Log the run
# MAGIC
# MAGIC The equivalent of the legacy TRY/CATCH logging. This table keeps one row per run.

# COMMAND ----------

spark.sql(f"CREATE TABLE IF NOT EXISTS {fq(cat, sch, 'etl_log')} (run_at TIMESTAMP, step_name STRING, rows_loaded INT, message STRING)")
msg = "completed" if passed == len(tests) else f"{len(tests) - passed} checks failed"
spark.sql(f"INSERT INTO {fq(cat, sch, 'etl_log')} VALUES (current_timestamp(), 'legacy_conversion_assessment', {len(conv)}, '{msg}')")
print(summary, f"tests passed={passed} failed={len(tests) - passed}", sep="\n")
