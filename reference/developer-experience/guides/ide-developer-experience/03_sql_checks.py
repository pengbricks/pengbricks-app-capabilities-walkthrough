# Databricks notebook source
# MAGIC %md
# MAGIC # 3. SQL checks
# MAGIC
# MAGIC `assert_true` fails the cell, and so the task, when a check does not hold. The query is the same one you would run in a SQL editor; the widgets fill in the table and column names. Safe to rerun: it only reads.

# COMMAND ----------

import sys, os
sys.dont_write_bytecode = True  # workspace files cannot hold __pycache__
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_developer_experience_workflow", ['catalog', 'schema', 'use_case', 'output_table', 'key_column', 'value_column'])
ROOT = bundle_root()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Assert the output table is sound

# COMMAND ----------

checks = spark.sql(
    """
    SELECT
      assert_true(COUNT(*) > 0, 'output table is empty') AS non_empty,
      assert_true(COUNT(*) = COUNT(DISTINCT IDENTIFIER(:key_column)), 'keys must be unique') AS unique_keys,
      assert_true(COUNT(IDENTIFIER(:key_column)) = COUNT(*), 'keys must not be null') AS no_null_keys,
      assert_true(MIN(IDENTIFIER(:value_column)) >= 0, 'values must not be negative') AS non_negative
    FROM IDENTIFIER(:catalog || '.' || :schema || '.' || :output_table)
    """,
    args={k: params[k] for k in ("catalog", "schema", "output_table", "key_column", "value_column")},
)
display(checks)
print("All SQL checks passed.")
