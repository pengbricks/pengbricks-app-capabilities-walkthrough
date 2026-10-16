# Databricks notebook source
# MAGIC %md
# MAGIC # 2. Prepare the semantics
# MAGIC
# MAGIC Adds table and column comments, tags, and the `sales_metrics` metric view. Comments and tags are set in place, and the metric view is created or replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_genie_ux", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
base = f"{catalog}.{schema}"

from genie_lib import load_spec
spec = load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))

# COMMAND ----------

from apply_semantics import apply_semantics

definition = apply_semantics(spark, spec, catalog, schema)
print(definition)
