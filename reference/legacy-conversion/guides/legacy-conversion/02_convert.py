# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Convert
# MAGIC
# MAGIC Transpiles each step from T-SQL to Databricks SQL with sqlglot and records it as clean, warning or manual. A step that fails to transpile is recorded for hand remediation instead of raising. Needs the table from `01_assess`.
# MAGIC
# MAGIC Safe to rerun: `assessment_conversion` is overwritten.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_legacy_conversion_assessment", ["catalog", "schema", "use_case"])
catalog, schema = params["catalog"], params["schema"]

from lc_common import fq, load_spec, read_text
import lc_helpers as h
ROOT = bundle_root()
spec = load_spec(ROOT, params["use_case"])
w = spec["workload"]
cs = f"`{catalog}`.`{schema}`"
remediation = {s.step_id: s for s in h.split_steps(read_text(ROOT, w["remediation_sql"]))}

# COMMAND ----------

# MAGIC %md
# MAGIC ## Convert each step
# MAGIC
# MAGIC For a manual step, the hand-written SQL in `remediation/manual_remediations.sql` becomes the executable statement. `executed_from` records whether each step runs from the `auto` or the `manual` version.

# COMMAND ----------

rows = []
for r in spark.table(fq(catalog, schema, "assessment_classification")).orderBy("step_id").collect():
    conv = h.convert_statement(r.legacy_sql, catalog, schema, w["legacy_schema"], w["temp_table_prefix"])
    manual_sql, executable, source = "", "", "none"
    if conv.status == "manual":
        rem = remediation.get(r.step_id)
        if rem is not None and rem.sql:
            manual_sql = rem.sql.replace("{cs}", cs)
            executable, source = manual_sql, "manual"
        else:
            conv.notes.append("Remediation recorded as a non-SQL change (no statement to run).")
    else:
        executable, source = conv.converted_sql, "auto"
    rows.append((r.step_id, r.step_name, r.construct, conv.status, " | ".join(conv.notes),
                 r.legacy_sql, conv.converted_sql, manual_sql, executable, source))
    print(f"step {r.step_id:02d} {r.step_name}: {conv.status} ({source})")

df = spark.createDataFrame(rows, "step_id INT, step_name STRING, construct STRING, status STRING, notes STRING, "
                                 "legacy_sql STRING, converted_sql STRING, manual_sql STRING, executable_sql STRING, executed_from STRING")
df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(fq(catalog, schema, "assessment_conversion"))
display(spark.table(fq(catalog, schema, "assessment_conversion")).select("step_id", "step_name", "construct", "status", "executed_from", "notes").orderBy("step_id"))
