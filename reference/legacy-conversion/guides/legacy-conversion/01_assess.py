# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Assess
# MAGIC
# MAGIC Splits the legacy script into steps and classifies each by its main construct (MERGE, cursor, temp table and so on). The classification decides which steps can convert automatically.

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
spark.sql(f"CREATE SCHEMA IF NOT EXISTS `{catalog}`.`{schema}`")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Classify every step
# MAGIC
# MAGIC The table is overwritten, so a rerun gives one row per step.

# COMMAND ----------

steps = h.split_steps(read_text(ROOT, spec["workload"]["legacy_sql"]))
rows = []
for s in steps:
    primary, tags = h.classify(s.sql)
    rows.append((s.step_id, s.name, primary, ",".join(tags), s.sql))
    print(f"step {s.step_id:02d} {s.name}: {primary} [{', '.join(tags)}]")

df = spark.createDataFrame(rows, "step_id INT, step_name STRING, construct STRING, tags STRING, legacy_sql STRING")
df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(fq(catalog, schema, "assessment_classification"))
print(f"classified {len(rows)} statements")
display(spark.table(fq(catalog, schema, "assessment_classification")).drop("legacy_sql").orderBy("step_id"))
