# Databricks notebook source
# MAGIC %md
# MAGIC # 3. Add the semantic layer
# MAGIC
# MAGIC Adds what Genie needs to read the cryptic columns: table and column comments, tags, and a Unity Catalog metric view (`sales_metrics`) that defines revenue, dimensions and synonyms once. Comments and tags are set in place, and the metric view is created or replaced, so a rerun gives the same result.

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

from apply_semantics import apply_semantics

definition = apply_semantics(spark, spec, catalog, schema)
print(definition)
