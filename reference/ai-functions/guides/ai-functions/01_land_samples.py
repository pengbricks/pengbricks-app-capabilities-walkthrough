# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Land the sample data
# MAGIC
# MAGIC Writes the sample tables from the use-case spec: support tickets, call notes with made-up personal details, two lists of company names, product reviews, and daily orders. It renders six invoice PDFs into the `aif_documents` volume and downloads two real scans for OCR. Every sample carries the answer a person would give, so later steps can be scored.
# MAGIC
# MAGIC Safe to rerun: the schema and volume are created only if missing, tables are overwritten, the invoice PDFs are replaced, and a scan whose checksum already matches is not downloaded again. Each table is shown below, so you can read exactly what the AI Functions get as input.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ai_functions", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]

import aif_lib as a
spec = a.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}

# The bundle creates these; creating them here too lets the folder run by hand in a fresh schema.
spark.sql(f"CREATE SCHEMA IF NOT EXISTS `{catalog}`.`{schema}`")
spark.sql(f"CREATE VOLUME IF NOT EXISTS {a.fq(catalog, schema, spec['volume'])}")

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
# MAGIC ## What goes in
# MAGIC
# MAGIC **Support tickets** for `ai_classify`, `ai_analyze_sentiment`, `ai_summarize`, and `ai_decide`. The `expected_` columns are the answer key; the functions only see `body`.

# COMMAND ----------

display(spark.table(T["tickets"]).orderBy("ticket_id"))

# COMMAND ----------

# MAGIC %md
# MAGIC **Call notes** for `ai_mask`. `planted` lists every made-up name, email, and phone number in the note; step 4 checks that none of them survive.

# COMMAND ----------

display(spark.table(T["call_notes"]).orderBy("note_id"))

# COMMAND ----------

# MAGIC %md
# MAGIC **Accounts and vendors** for `ai_similarity`: the same company is often spelled differently in two systems.

# COMMAND ----------

display(spark.table(T["accounts"]).orderBy("account_id"))
display(spark.table(T["vendors"]).orderBy("vendor_id"))

# COMMAND ----------

# MAGIC %md
# MAGIC **Product reviews** for `ai_query` translation, and **daily orders** for `ai_forecast` (chart it with the + button on the result).

# COMMAND ----------

display(spark.table(T["reviews"]).orderBy("review_id"))
display(spark.table(T["daily_orders"]).orderBy("order_date", "region"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Documents
# MAGIC
# MAGIC The invoice PDFs are rendered with fpdf2; the answer key, `aif_invoice_truth`, holds the number, vendor, date, and total of each. The two scans come from public archives: [a 1947 letter from Harry S. Truman to Eleanor Roosevelt](https://commons.wikimedia.org/wiki/File:Letter_from_Harry_S._Truman_to_Eleanor_Roosevelt_-_DPLA_-_49b1c8f89d84a70ed20acf75b97ae3bf.pdf) (National Archives, via the Digital Public Library of America) and [Edison's 1880 electric lamp patent](https://patents.google.com/patent/US223898A/en) (US Patent 223,898). They have no reliable text layer, so step 3 has to read them with OCR.

# COMMAND ----------

folder = f"/Volumes/{catalog}/{schema}/{spec['volume']}/invoices"
os.makedirs(folder, exist_ok=True)
for old in os.listdir(folder):
    os.remove(os.path.join(folder, old))
for invoice in spec["invoices"]:
    a.render_invoice_pdf(invoice, f"{folder}/{invoice['number']}.pdf")
overwrite([(i["number"], i["vendor"], i["date"], a.invoice_total(i), f"{folder}/{i['number']}.pdf") for i in spec["invoices"]],
          "invoice_number string, vendor string, invoice_date string, total double, path string", T["invoices_truth"])
display(spark.table(T["invoices_truth"]).orderBy("invoice_number"))

# COMMAND ----------

import html

scan_folder = f"/Volumes/{catalog}/{schema}/{spec['volume']}/public"
rows = []
for doc in spec["scans"]["documents"]:
    path, downloaded = a.fetch_document(doc, scan_folder)
    rows.append((doc["file"], doc["title"], doc["shows"], doc["rights"], doc["source"], str(path), os.path.getsize(path), downloaded))
overwrite(rows, "file string, title string, shows string, rights string, source string, path string, bytes long, downloaded_this_run boolean",
          a.fq(catalog, schema, "aif_scans"))
displayHTML("<ul style='font:14px sans-serif'>" + "".join(
    f"<li><b>{html.escape(title)}</b>: {html.escape(shows)}. {html.escape(rights)}. "
    f"<a href='{html.escape(source)}' target='_blank'>Source and download</a> · {size // 1024} KB at <code>{html.escape(path)}</code>"
    f"{' (downloaded now)' if new else ' (already there, checksum verified)'}</li>"
    for _, title, shows, rights, source, path, size, new in rows) + "</ul>")

# COMMAND ----------

counts = {key: spark.table(T[key]).count() for key in ["tickets", "call_notes", "accounts", "vendors", "reviews", "daily_orders", "invoices_truth"]}
print(json.dumps(counts))
print(f"{len(os.listdir(folder))} invoice PDFs in {folder}; {len(rows)} scans in {scan_folder}")
