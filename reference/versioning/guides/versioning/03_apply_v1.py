# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Apply v1.0.0, then v1.1.0
# MAGIC
# MAGIC Creates the table from the v1.0.0 contract, then evolves it in place to v1.1.0 (nonbreaking). Objects from an earlier run are dropped first, so the job can run again.

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
# MAGIC ## Load the contracts and name the objects

# COMMAND ----------

from compatibility import create_table_sql, diff_contracts, evolve_sql
from versioning_common import (
    contracts_for, delta_version, drop_any, ensure_registry, fq, load_spec, register, set_tags,
)

catalog, schema, release = params["catalog"], params["schema"], params["release"]
spec = load_spec(SPEC_FILE)
dataset = spec["dataset"]["name"]
contracts = contracts_for(CONTRACTS_DIR, spec)
v1, v11 = contracts["1.0.0"], contracts["1.1.0"]

seed = fq(catalog, schema, f"{dataset}_seed")
table = fq(catalog, schema, f"{dataset}_v1")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Reset this guide's objects
# MAGIC
# MAGIC Drop the tables and view an earlier run created, and clear this dataset's registry rows.

# COMMAND ----------

for name in (f"{dataset}_v1", f"{dataset}_v1_archive", f"{dataset}_v2"):
    drop_any(spark, fq(catalog, schema, name))
ensure_registry(spark, catalog, schema)
spark.sql(f"DELETE FROM {fq(catalog, schema, 'contract_registry')} WHERE dataset = '{dataset}'")

# COMMAND ----------

# MAGIC %md
# MAGIC ## v1.0.0: create the table from the contract and load the seed rows

# COMMAND ----------

spark.sql(create_table_sql(v1, table))
v1_columns = ", ".join(f"`{c['name']}`" for c in v1["columns"])
spark.sql(f"INSERT INTO {table} SELECT {v1_columns} FROM {seed}")
register(spark, catalog, schema, dataset=dataset, version="1.0.0", change_type="initial",
         object_name=f"{dataset}_v1", release=release, delta_ver=delta_version(spark, table))
set_tags(spark, table, {"contract_version": "1.0.0", "deprecated": "false"})
print(f"v1.0.0 applied: {spark.table(table).count()} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## v1.1.0: nonbreaking, applied in place
# MAGIC
# MAGIC `ALTER TABLE` adds the new column. Existing rows hold NULL until the `MERGE` backfills them from the seed.

# COMMAND ----------

for change in diff_contracts(v1, v11):
    print(f"  {change.classification}: {change.kind} {change.detail}")
for statement in evolve_sql(v1, v11, table):
    print("  " + statement)
    spark.sql(statement)
added = [c.new_column for c in diff_contracts(v1, v11) if c.kind == "add_nullable_column"]
if added:
    assignments = ", ".join(f"t.`{c}` = s.`{c}`" for c in added)
    spark.sql(f"MERGE INTO {table} t USING {seed} s ON t.customer_id = s.customer_id "
              f"WHEN MATCHED THEN UPDATE SET {assignments}")
register(spark, catalog, schema, dataset=dataset, version="1.1.0", change_type="nonbreaking",
         object_name=f"{dataset}_v1", release=release, delta_ver=delta_version(spark, table))
set_tags(spark, table, {"contract_version": "1.1.0", "deprecated": "false"})
print("v1.1.0 applied in place; consumers of the table needed no change.")
display(spark.sql(f"SELECT * FROM {table} LIMIT 5"))
