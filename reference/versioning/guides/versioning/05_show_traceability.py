# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Show traceability
# MAGIC
# MAGIC Shows the contract registry, the Delta history of each physical table, and the Unity Catalog tags. Then it checks that the compatibility view exposes exactly the v1.1.0 columns and types.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_versioning_release", ['catalog', 'schema', 'use_case', 'release'])
ROOT = bundle_root()
SPEC_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"
CONTRACTS_DIR = ROOT / "contracts"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Registry and Delta history

# COMMAND ----------

from versioning_common import contracts_for, fq, load_spec

catalog, schema = params["catalog"], params["schema"]
spec = load_spec(SPEC_FILE)
dataset = spec["dataset"]["name"]
contracts = contracts_for(CONTRACTS_DIR, spec)

print("== contract_registry")
display(spark.table(fq(catalog, schema, "contract_registry")).orderBy("applied_at", "version"))

for suffix in ("v1_archive", "v2"):
    table = fq(catalog, schema, f"{dataset}_{suffix}")
    print(f"== DESCRIBE HISTORY {dataset}_{suffix}")
    display(spark.sql(f"DESCRIBE HISTORY {table}").select("version", "timestamp", "operation", "operationParameters"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Unity Catalog tags

# COMMAND ----------

display(spark.sql(f"""SELECT table_name, tag_name, tag_value
                      FROM `{catalog}`.information_schema.table_tags
                      WHERE schema_name = '{schema}' AND table_name LIKE '{dataset}%'
                      ORDER BY table_name, tag_name"""))

# COMMAND ----------

# MAGIC %md
# MAGIC ## The view still has the v1.1.0 shape

# COMMAND ----------

view = spark.table(fq(catalog, schema, f"{dataset}_v1"))
actual = [(f.name, f.dataType.simpleString()) for f in view.schema.fields]
expected = [(c["name"], c["type"].replace(" ", "")) for c in contracts["1.1.0"]["columns"]]
assert actual == expected, f"compat view {actual} != contract v1.1.0 {expected}"
v2_count = spark.table(fq(catalog, schema, f"{dataset}_v2")).count()
assert view.count() == v2_count
print(f"Compatibility verified: {dataset}_v1 exposes the v1.1.0 shape over {v2_count} rows of {dataset}_v2.")
