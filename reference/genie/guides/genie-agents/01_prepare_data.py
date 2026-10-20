# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Prepare the data
# MAGIC
# MAGIC Creates the sample tables from the use-case spec if they do not exist, then comments and tags them and creates the `sales_metrics` metric view. The agent reads the metric view, so business definitions such as revenue live in Unity Catalog and not in the agent's instructions. Existing tables are kept, comments are set in place, and the metric view is replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_genie_agents", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
base = f"{catalog}.{schema}"

from genie_lib import load_spec
spec = load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))

# COMMAND ----------

from setup_data import generate_tables
from apply_semantics import apply_semantics

generate_tables(spark, spec, catalog, schema, recreate=False)
apply_semantics(spark, spec, catalog, schema)
for table in spec["tables"]:
    print(table["name"], spark.table(f"{base}.{table['name']}").count(), "rows")
