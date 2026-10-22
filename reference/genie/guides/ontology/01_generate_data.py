# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Generate the sample data
# MAGIC
# MAGIC Drops and regenerates each sample table from the use-case spec with the sample-data generator (`src/sample_data.py`) and a fixed seed, so every run produces the same rows. This also removes the comments and tags from the previous run, which gives the baseline questions a clean start.
# MAGIC
# MAGIC Safe to rerun: the tables are dropped and regenerated with the same seed.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ontology", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
base = f"{catalog}.{schema}"

from genie_lib import load_spec
spec = load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))

# COMMAND ----------

from setup_data import generate_tables

generate_tables(spark, spec, catalog, schema, recreate=True)
for table in spec["tables"]:
    print(table["name"], spark.table(f"{base}.{table['name']}").count(), "rows")
