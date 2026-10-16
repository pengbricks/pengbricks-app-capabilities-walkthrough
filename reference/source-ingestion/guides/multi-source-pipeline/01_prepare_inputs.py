# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Prepare the inputs
# MAGIC
# MAGIC Builds the three inputs for the pipeline:
# MAGIC
# MAGIC - database extract: Delta table `ms_db_customers` (stands in for the output of the relational extract guide)
# MAGIC - landed files: a CSV with the provider's own column names
# MAGIC - API output: one JSON-lines file per API page, written by the authenticated pagination client
# MAGIC
# MAGIC The landing folder is cleared first and the table is overwritten, so a rerun replaces its own output.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_multi_source", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

import json, os, shutil
import requests
from pyspark.sql import functions as F
from source_ingestion.api_client import TokenManager, fetch_all_pages
from source_ingestion.datagen import entity_frame
from source_ingestion.spec import load_spec

spec = load_spec(SPEC_FILE)
ms = spec["multi_source"]
root = f"/Volumes/{catalog}/{schema}/source_landing/multi_source"
shutil.rmtree(root, ignore_errors=True)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Database extract

# COMMAND ----------

db = entity_frame(spark, spec, "customers", rows=ms["db_rows"], seed_offset=11)
db.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{ns}.ms_db_customers")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Landed files, with a different column naming than the database

# COMMAND ----------

files = entity_frame(spark, spec, "customers", rows=ms["file_rows"], seed_offset=22).select(
    F.col("customer_id").alias("cust_no"),
    F.concat_ws(" ", "first_name", "last_name").alias("name"),
    F.col("email").alias("mail"),
    F.col("city").alias("town"),
    F.col("country").alias("nation"),
    F.col("created_date").alias("signup_date"),
)
os.makedirs(f"{root}/files", exist_ok=True)
files.toPandas().to_csv(f"{root}/files/customers_landed.csv", index=False)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. API output: first N pages, one file per page

# COMMAND ----------

api = spec["rest_api"]
session = requests.Session()
tokens = TokenManager(session, api["base_url"], api["username"], api["password"], refresh_after_seconds=1e9)
page_size = api["page_size"]
result = fetch_all_pages(session, tokens, f"{api['base_url']}{api['endpoint']}", "users", page_size)
wanted = result.records[: ms["api_pages"] * page_size]
os.makedirs(f"{root}/api", exist_ok=True)
for page in range(ms["api_pages"]):
    chunk = wanted[page * page_size : (page + 1) * page_size]
    with open(f"{root}/api/page_{page + 1:04d}.json", "w", encoding="utf-8") as handle:
        handle.write("\n".join(json.dumps(r) for r in chunk) + "\n")

print(f"db={ms['db_rows']} files={ms['file_rows']} api={len(wanted)} (api total {result.total})")
