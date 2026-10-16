# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Generate the sample files
# MAGIC
# MAGIC Writes one file per format from the use-case spec into `/Volumes/<catalog>/<schema>/source_landing/formats`. The folder is cleared first, so a rerun replaces every file instead of adding copies.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_file_formats", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Build the files locally
# MAGIC
# MAGIC Volumes do not support random-access writes, and an `.xlsx` is a zip file that needs them. Every file is built in a local temp folder first, then copied to the volume.

# COMMAND ----------

import shutil, tempfile
from source_ingestion import file_writers as fw
from source_ingestion.datagen import entity_frame
from source_ingestion.spec import load_spec

spec = load_spec(SPEC_FILE)
options = spec["file_formats"]
volume_root = f"/Volumes/{catalog}/{schema}/source_landing/formats"
shutil.rmtree(volume_root, ignore_errors=True)  # idempotent: each run rewrites every file
root = tempfile.mkdtemp(prefix="formats_")

customers = [r.asDict() for r in entity_frame(spark, spec, "customers").collect()]
orders = [r.asDict() for r in entity_frame(spark, spec, "orders").collect()]

fw.write_delimited(f"{root}/csv/customers.csv", customers)
fw.write_delimited(f"{root}/pipe/orders.txt", orders, delimiter="|")
fw.write_workbook(
    f"{root}/excel/orders_workbook.xlsx",
    {
        "README": [{"note": "Only the Orders sheet is ingested."}],
        options["excel_sheet"]: orders,
        "Products": [{"sku": f"SKU-{i:03d}", "price": 9.5 + i} for i in range(10)],
    },
)
json_rows = customers[: options["nested_json_rows"]]
fw.write_nested_json(f"{root}/json/customers_nested.json", json_rows)
xml_rows = orders[: options["xml_rows"]]
fw.write_orders_xml(f"{root}/xml/orders.xml", xml_rows, options["xml_max_lines"], options["xml_coupon_every"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Copy to the volume

# COMMAND ----------

embedded = fw.count_delimited_with_embedded_delimiter(orders, "|")
shutil.copytree(root, volume_root)
print(f"customers={len(customers)} orders={len(orders)} orders_with_pipe_in_notes={embedded}")
print(f"Files written under {volume_root}")
