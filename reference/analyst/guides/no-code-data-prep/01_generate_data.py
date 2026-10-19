# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Generate the sample data
# MAGIC
# MAGIC Builds `analyst_customers`, `analyst_orders` from the use-case spec with the sample-data generator (`src/sample_data.py`) and a fixed seed. Each table is overwritten, so a rerun replaces the data.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_no_code_prep", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
fq = f"{catalog}.{schema}"
ROOT = bundle_root()
SPEC_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the tables

# COMMAND ----------

from analyst_common.datagen import generate_tables
from analyst_common.spec import load_spec

spec = load_spec(SPEC_FILE)
generate_tables(spark, spec, ['analyst_customers', 'analyst_orders'], catalog, schema)
