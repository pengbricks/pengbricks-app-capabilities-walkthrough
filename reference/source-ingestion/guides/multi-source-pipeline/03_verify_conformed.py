# Databricks notebook source
# MAGIC %md
# MAGIC # 3. Verify the conformed table
# MAGIC
# MAGIC Every row has a `source_system`, counts match the inputs, and `(source_system, source_id)` is unique. Safe to rerun: it only reads.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_multi_source", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

from source_ingestion.spec import load_spec

ms = load_spec(SPEC_FILE)["multi_source"]
counts = {r["source_system"]: r["n"] for r in spark.sql(f"SELECT source_system, count(*) n FROM {ns}.customers_conformed GROUP BY 1").collect()}
total = sum(counts.values())
nulls = spark.sql(f"SELECT count(*) FROM {ns}.customers_conformed WHERE source_system IS NULL").first()[0]
distinct = spark.sql(f"SELECT count(DISTINCT source_system, source_id) FROM {ns}.customers_conformed").first()[0]
api_rows = spark.sql(f"SELECT count(*) FROM {ns}.stg_api_users").first()[0]
print(f"rows by source_system: {counts}; total={total}; null source_system={nulls}; distinct keys={distinct}")
assert counts.get("database") == ms["db_rows"], counts
assert counts.get("files") == ms["file_rows"], counts
assert counts.get("api") == api_rows > 0, counts
assert nulls == 0 and distinct == total
print("Conformed table matches all three sources")
