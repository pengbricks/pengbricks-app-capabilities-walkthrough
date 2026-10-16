# Databricks notebook source
# MAGIC %md
# MAGIC # 2. Simulate the upload
# MAGIC
# MAGIC Writes a CSV to a folder named after the current user. In real use the analyst drops the file there from the UI. The file name is fixed, so a rerun replaces it.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_byod", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
fq = f"{catalog}.{schema}"
ROOT = bundle_root()
SPEC_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Build the file
# MAGIC
# MAGIC Keys 0 to `matched_keys`-1 exist in `analyst_customers`. Keys from `unmatched_start` up do not.

# COMMAND ----------

import csv
from analyst_common.helpers import upload_path
from analyst_common.spec import load_spec

upload = load_spec(SPEC_FILE)["upload"]
user = spark.sql("SELECT current_user()").first()[0]
path = upload_path(catalog, schema, "uploads", user, upload["file_name"])

keys = [f"{upload['key_prefix']}{i:06d}" for i in range(int(upload["matched_keys"]))]
keys += [f"{upload['key_prefix']}{int(upload['unmatched_start']) + i:06d}" for i in range(int(upload["unmatched_keys"]))]
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w", newline="", encoding="utf-8") as handle:
    writer = csv.writer(handle)
    writer.writerow(["customer_id", "account_owner", "annual_target"])
    for index, key in enumerate(keys):
        writer.writerow([key, f"owner_{index % 12:02d}", 10000 + (index * 137) % 90000])
print(f"Wrote {len(keys)} rows to {path}")
