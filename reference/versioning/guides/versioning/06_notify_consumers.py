# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 6. Notify consumers
# MAGIC
# MAGIC Writes one notification row per consumer named in the spec: which of its columns the breaking change touches, what to do, and by when.

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
# MAGIC ## Work out who is affected

# COMMAND ----------

from compatibility import BREAKING, diff_contracts
from versioning_common import contracts_for, fq, load_spec

catalog, schema, release = params["catalog"], params["schema"], params["release"]
spec = load_spec(SPEC_FILE)
dataset = spec["dataset"]["name"]
owner = spec["dataset"]["owner"]
contracts = contracts_for(CONTRACTS_DIR, spec)
v11, v2 = contracts["1.1.0"], contracts["2.0.0"]
sunset = str(v2["sunset_date"])

breaking = [c for c in diff_contracts(v11, v2) if c.classification == BREAKING]
renames = {c.column: c.new_column for c in breaking if c.kind == "rename_column"}
affected = set(renames) | {c.column for c in breaking}

rows = []
for consumer in spec["consumers"]:
    impacted = sorted(set(consumer["uses"]) & affected)
    if impacted:
        mapping = ", ".join(f"{c} -> {renames.get(c, c)}" for c in impacted)
        action = f"Move reads from {dataset}_v1 to {dataset}_v2 and update columns ({mapping}) before {sunset}."
    else:
        action = f"No code change needed. Optionally move to {dataset}_v2 before {sunset}."
    message = (f"{dataset} {v2['version']} is released (tag {release}). It changes the schema in a breaking way. "
               f"{dataset}_v1 keeps working as a deprecated view until {sunset}. Owner: {owner}.")
    rows.append((dataset, v2["version"], consumer["name"], ",".join(impacted), message, action, sunset, release))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the notifications
# MAGIC
# MAGIC The table is overwritten, so a rerun replaces the rows.

# COMMAND ----------

df = spark.createDataFrame(
    rows, "dataset STRING, contract_version STRING, consumer STRING, impacted_columns STRING, "
          "message STRING, action_required STRING, deadline STRING, release_tag STRING")
df = df.selectExpr("*", "to_date(deadline) AS deadline_date", "current_timestamp() AS created_at").drop("deadline") \
       .withColumnRenamed("deadline_date", "deadline")
target = fq(catalog, schema, "consumer_notifications")
df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(target)
display(spark.table(target).select("consumer", "impacted_columns", "action_required", "deadline"))
