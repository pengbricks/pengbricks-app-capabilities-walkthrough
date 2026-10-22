# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Unit tests
# MAGIC
# MAGIC Runs the same pytest suite you run in your IDE, here on serverless. The task fails on any test failure, so a bad change never reaches the transform step. Safe to rerun: it only runs tests.

# COMMAND ----------

import sys, os
sys.dont_write_bytecode = True  # workspace files cannot hold __pycache__
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_developer_experience_workflow", [])
ROOT = bundle_root()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run pytest
# MAGIC
# MAGIC The tests import `dx_demo` from `src/`, so the path is set first. Bytecode writing is off because workspace files cannot hold `__pycache__`.

# COMMAND ----------

import pytest

sys.path.insert(0, str(ROOT / "src"))
code = pytest.main([str(ROOT / "tests"), "-v", "-p", "no:cacheprovider"])
if code != 0:
    raise Exception(f"pytest failed with exit code {int(code)}")
print("All tests passed.")
