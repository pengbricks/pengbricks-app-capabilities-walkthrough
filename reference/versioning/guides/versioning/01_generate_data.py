# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Generate the seed data
# MAGIC
# MAGIC Writes deterministic sample rows for the dataset in the use-case spec. The generated columns must match the latest nonbreaking contract, so the later steps can seed from this table.

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
# MAGIC ## Load the spec and the contracts
# MAGIC
# MAGIC The columns declared in the spec have to equal the columns of the latest `1.x` contract.

# COMMAND ----------

from versioning_common import column_options, contracts_for, fq, load_spec, spark_type

spec = load_spec(SPEC_FILE)
dataset = spec["dataset"]
contracts = contracts_for(CONTRACTS_DIR, spec)

latest_v1 = max((v for v in contracts if v.startswith("1.")), key=lambda v: tuple(map(int, v.split("."))))
expected = [c["name"] for c in contracts[latest_v1]["columns"]]
declared = [c["name"] for c in dataset["columns"]]
assert declared == expected, f"spec columns {declared} do not match contract v{latest_v1} {expected}"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Generate the rows and write the seed table
# MAGIC
# MAGIC The seed is fixed, so every run produces the same rows. The write overwrites the table, so a rerun never adds rows.

# COMMAND ----------

import dbldatagen as dg

generator = dg.DataGenerator(
    spark, name=f"{spec['name']}_{dataset['name']}", rows=int(dataset["rows"]), partitions=2,
    randomSeedMethod="hash_fieldname", randomSeed=int(spec["seed"]),
).withIdOutput()  # dbldatagen drops `id` from the output unless asked
for column in dataset["columns"]:
    generator = generator.withColumn(column["name"], spark_type(column["type"]), **column_options(column))
df = generator.build().select(*declared)

target = fq(params["catalog"], params["schema"], f"{dataset['name']}_seed")
df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(target)
print(f"seed={spec['seed']} rows={spark.table(target).count()} -> {target}")
display(spark.table(target).limit(5))
