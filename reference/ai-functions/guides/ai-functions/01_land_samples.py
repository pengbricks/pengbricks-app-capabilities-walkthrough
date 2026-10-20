# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Land the sample data
# MAGIC
# MAGIC Writes the sample tables from the use-case spec: support tickets, call notes with made-up personal details, two lists of company names, product reviews, and daily orders. It also renders six invoice PDFs into the `aif_documents` volume. Every sample carries the answer a person would give, so later steps can be scored. Tables are overwritten and PDFs replaced, so a rerun gives the same data.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ai_functions", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]

import aif_lib as a
spec = a.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}

# COMMAND ----------

import json

def overwrite(rows, columns, table):
    spark.createDataFrame(rows, columns).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)

overwrite([(t["id"], t["body"], t["category"], t["sentiment"]) for t in spec["tickets"]],
          "ticket_id int, body string, expected_category string, expected_sentiment string", T["tickets"])
overwrite([(n["id"], n["note"], n["planted"]) for n in spec["call_notes"]],
          "note_id int, note string, planted array<string>", T["call_notes"])
overwrite([(x["id"], x["country"], x["name"]) for x in spec["accounts"]], "account_id string, country string, name string", T["accounts"])
overwrite([(x["id"], x["country"], x["name"]) for x in spec["vendors"]], "vendor_id string, country string, name string", T["vendors"])
overwrite([(r["id"], r["text"]) for r in spec["reviews"]], "review_id int, text string", T["reviews"])
spark.sql(a.daily_orders_sql(spec)).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(T["daily_orders"])

# COMMAND ----------

# MAGIC %md
# MAGIC The invoice PDFs are rendered with fpdf2. The answer key, `aif_invoice_truth`, holds the number, vendor, date, and total of each.

# COMMAND ----------

folder = f"/Volumes/{catalog}/{schema}/{spec['volume']}/invoices"
os.makedirs(folder, exist_ok=True)
for old in os.listdir(folder):
    os.remove(os.path.join(folder, old))
for invoice in spec["invoices"]:
    a.render_invoice_pdf(invoice, f"{folder}/{invoice['number']}.pdf")
overwrite([(i["number"], i["vendor"], i["date"], a.invoice_total(i), f"{folder}/{i['number']}.pdf") for i in spec["invoices"]],
          "invoice_number string, vendor string, invoice_date string, total double, path string", T["invoices_truth"])

counts = {key: spark.table(T[key]).count() for key in ["tickets", "call_notes", "accounts", "vendors", "reviews", "daily_orders", "invoices_truth"]}
print(json.dumps(counts))
print(f"{len(os.listdir(folder))} invoice PDFs in {folder}")
