# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Extract invoice fields from PDFs
# MAGIC
# MAGIC Reads the invoice PDFs from the volume, parses each with `ai_parse_document`, and pulls the number, vendor, date, and total with `ai_extract`. Results go to `aif_invoices_extracted`, with any per-file error kept in its own column instead of failing the run. The scoring cell compares every field with `aif_invoice_truth`.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ai_functions", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]

import aif_lib as a
spec = a.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}
extracted = a.fq(catalog, schema, "aif_invoices_extracted")

# COMMAND ----------

import time

folder = f"/Volumes/{catalog}/{schema}/{spec['volume']}/invoices/"
schema_json = a.sql_string(spec["extract"]["schema"])
start = time.perf_counter()
spark.sql(f"""
CREATE OR REPLACE TABLE {extracted} AS
WITH parsed AS (
  SELECT path, coalesce(array_size(try_variant_get(doc, '$.error_status', 'ARRAY<VARIANT>')), 0) AS parse_errors,  -- doc:error_status IS NULL never matches: a VARIANT null is a value
         concat_ws('\\n', transform(cast(doc:document:elements AS ARRAY<VARIANT>), e -> e:content::STRING)) AS text
  FROM (SELECT path, ai_parse_document(content, map('version', '2.0')) AS doc
        FROM read_files('{folder}', format => 'binaryFile'))
)
SELECT path, parse_errors,
       r:response:invoice_number::STRING AS invoice_number,
       r:response:vendor::STRING AS vendor,
       r:response:invoice_date::STRING AS invoice_date,
       r:response:total::DOUBLE AS total,
       r:error_message::STRING AS extract_error
FROM (SELECT path, parse_errors, ai_extract(text, {schema_json}, map('version', '2.0')) AS r
      FROM parsed WHERE parse_errors = 0)
""")
seconds = time.perf_counter() - start
display(spark.table(extracted))

# COMMAND ----------

truth = {r.path.split("/")[-1]: r for r in spark.table(T["invoices_truth"]).collect()}
got = {r.path.split("/")[-1]: r for r in spark.table(extracted).collect()}
tolerance = float(spec["extract"]["total_tolerance"])
fields = {"invoice_number": 0, "vendor": 0, "invoice_date": 0, "total": 0}
misses = []
for name, expected in truth.items():
    actual = got.get(name)
    for field in fields:
        want, have = getattr(expected, field), getattr(actual, field) if actual else None
        ok = have is not None and (abs(float(have) - want) <= tolerance if field == "total" else str(have).strip().lower() == str(want).lower())
        fields[field] += ok
        if not ok:
            misses.append(f"{name}:{field}={have!r}")
n = len(truth)
a.write_results(spark, T["results"], "extract", [
    ("invoices", n, ""),
    ("parsed", len(got), "PDFs that parsed without an error"),
    *[(f"{field}_accuracy", hits / n, "") for field, hits in fields.items()],
    ("fields_wrong", len(misses), ", ".join(misses)),
    ("seconds", seconds, "parse and extract every PDF"),
], params["run_id"])
