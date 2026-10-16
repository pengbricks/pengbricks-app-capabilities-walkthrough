# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Verify the tables
# MAGIC
# MAGIC Checks each format's table against the spec: row counts, rescued data, column types and nested content. Every check is written to `format_ingestion_checks`, and the notebook fails if any check fails.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_file_formats", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Expected values from the spec

# COMMAND ----------

from datetime import datetime, timezone
from source_ingestion import file_writers as fw
from source_ingestion.datagen import entity_frame
from source_ingestion.spec import load_spec

spec = load_spec(SPEC_FILE)
opts = spec["file_formats"]
checks: list[tuple[str, str, str, str, bool]] = []

def scalar(sql: str):
    return spark.sql(sql).first()[0]

def check(table: str, name: str, expected, actual) -> None:
    checks.append((table, name, str(expected), str(actual), str(expected) == str(actual)))

def types(table: str) -> dict[str, str]:
    return {r["col_name"]: r["data_type"] for r in spark.sql(f"DESCRIBE TABLE {ns}.{table}").collect()}

orders = [r.asDict() for r in entity_frame(spark, spec, "orders").collect()]
n_customers = spec["entities"]["customers"]["rows"]
n_orders = spec["entities"]["orders"]["rows"]
embedded = fw.count_delimited_with_embedded_delimiter(orders, "|")

# COMMAND ----------

# MAGIC %md
# MAGIC ## CSV and pipe-delimited

# COMMAND ----------

# CSV
t = "fmt_customers_csv"
check(t, "row_count", n_customers, scalar(f"SELECT count(*) FROM {ns}.{t}"))
check(t, "rescued_rows", 0, scalar(f"SELECT count(*) FROM {ns}.{t} WHERE _rescued_data IS NOT NULL"))
ty = types(t)
check(t, "credit_limit_type", "decimal(12,2)", ty["credit_limit"])
check(t, "created_date_type", "date", ty["created_date"])

# Pipe-delimited with quoted embedded delimiters
t = "fmt_orders_pipe"
check(t, "row_count", n_orders, scalar(f"SELECT count(*) FROM {ns}.{t}"))
check(t, "rescued_rows", 0, scalar(f"SELECT count(*) FROM {ns}.{t} WHERE _rescued_data IS NOT NULL"))
check(t, "notes_with_embedded_pipe", embedded, scalar(f"SELECT count(*) FROM {ns}.{t} WHERE notes LIKE '%|%'"))
check(t, "amount_type", "decimal(12,2)", types(t)["amount"])
check(t, "amount_sum", sum(o["amount"] for o in orders), scalar(f"SELECT sum(amount) FROM {ns}.{t}"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Excel: only the named sheet

# COMMAND ----------

t = "fmt_orders_excel"
check(t, "row_count", n_orders, scalar(f"SELECT count(*) FROM {ns}.{t}"))
check(t, "has_orders_columns", True, {"order_id", "amount", "notes"} <= set(types(t)))
check(t, "no_products_sheet_columns", False, "sku" in types(t))
check(t, "amount_sum", round(float(sum(o["amount"] for o in orders)), 2), round(float(scalar(f"SELECT sum(CAST(amount AS DOUBLE)) FROM {ns}.{t}")), 2))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Nested JSON and XML

# COMMAND ----------

# Nested JSON
t = "fmt_customers_json"
expected_json = fw.expected_json_counts(opts["nested_json_rows"])
check(t, "row_count", expected_json["customers"], scalar(f"SELECT count(*) FROM {ns}.{t}"))
check(t, "rescued_rows", 0, scalar(f"SELECT count(*) FROM {ns}.{t} WHERE _rescued_data IS NOT NULL"))
check(t, "contacts_array_elements", expected_json["contacts"], scalar(f"SELECT sum(size(contacts)) FROM {ns}.{t}"))
check("fmt_json_contacts", "row_count", expected_json["contacts"], scalar(f"SELECT count(*) FROM {ns}.fmt_json_contacts"))
check(t, "optional_loyalty_present", expected_json["loyalty"], scalar(f"SELECT count(loyalty) FROM {ns}.{t}"))
check(t, "address_is_struct", True, types(t)["address"].startswith("struct<"))

# XML
t = "fmt_orders_xml"
expected_xml = fw.expected_xml_counts(opts["xml_rows"], opts["xml_max_lines"], opts["xml_coupon_every"])
check(t, "row_count", expected_xml["orders"], scalar(f"SELECT count(*) FROM {ns}.{t}"))
check(t, "rescued_rows", 0, scalar(f"SELECT count(*) FROM {ns}.{t} WHERE _rescued_data IS NOT NULL"))
check(t, "repeating_line_elements", expected_xml["lines"], scalar(f"SELECT count(*) FROM {ns}.fmt_xml_order_lines"))
check(t, "optional_coupon_present", expected_xml["coupons"], scalar(f"SELECT count(coupon) FROM {ns}.{t}"))
check(t, "optional_coupon_null", expected_xml["orders"] - expected_xml["coupons"], scalar(f"SELECT count(*) FROM {ns}.{t} WHERE coupon IS NULL"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the checks and fail on any mismatch

# COMMAND ----------

now = datetime.now(timezone.utc)
rows = [(params["run_id"], now, *c) for c in checks]
spark.createDataFrame(
    rows, "run_id string, checked_at timestamp, table_name string, check_name string, expected string, actual string, passed boolean"
).write.mode("append").saveAsTable(f"{ns}.format_ingestion_checks")

for _, _, table, name, expected, actual, passed in rows:
    print(f"{'PASS' if passed else 'FAIL'} {table}.{name}: expected {expected}, actual {actual}")
failed = [r for r in rows if not r[-1]]
if failed:
    raise SystemExit(f"{len(failed)} of {len(rows)} checks failed")
print(f"All {len(rows)} checks passed")
