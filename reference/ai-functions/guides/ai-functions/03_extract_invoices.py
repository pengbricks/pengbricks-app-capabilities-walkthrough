# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Parse documents, then extract fields
# MAGIC
# MAGIC `ai_parse_document` reads every PDF in the volume: the six invoices from step 1 and two real scans, a typed 1947 letter with a handwritten postscript and an 1880 patent with drawings. It returns each element it finds (text, title, figure, signature, and so on) with a confidence, a bounding box, and, for figures, a written description. It also saves an image of every page, so the cells below draw what it found on top of the page.
# MAGIC
# MAGIC `ai_extract` then pulls named fields from the parsed text: number, vendor, date, and total from the invoices, and a small schema from the scans. Both are scored against the answer key in the spec.
# MAGIC
# MAGIC Safe to rerun: the page-image folder is cleared first, every table is replaced, and the step's rows in `aif_results` are swapped, not added.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ai_functions", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]

import aif_lib as a
spec = a.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}
parsed = a.fq(catalog, schema, "aif_documents_parsed")
elements = a.fq(catalog, schema, "aif_document_elements")
extracted = a.fq(catalog, schema, "aif_invoices_extracted")
scans_extracted = a.fq(catalog, schema, "aif_scans_extracted")

volume = f"/Volumes/{catalog}/{schema}/{spec['volume']}"
images = f"{volume}/parsed_images"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Parse every document once
# MAGIC
# MAGIC `imageOutputPath` saves one image per page; `descriptionElementTypes => '*'` asks for a written description of each figure. The parsed output is saved, so extraction and any later query read the table instead of parsing again.

# COMMAND ----------

import shutil, time

shutil.rmtree(images, ignore_errors=True)
os.makedirs(images)
options = f"map('version', '2.0', 'imageOutputPath', {a.sql_string(images + '/')}, 'descriptionElementTypes', '*')"
start = time.perf_counter()
spark.sql(f"""
CREATE OR REPLACE TABLE {parsed} AS
SELECT path, kind, doc,
       coalesce(array_size(try_variant_get(doc, '$.error_status', 'ARRAY<VARIANT>')), 0) AS parse_errors,  -- doc:error_status IS NULL never matches: a VARIANT null is a value
       array_size(cast(doc:document:pages AS ARRAY<VARIANT>)) AS pages,
       concat_ws('\\n', transform(cast(doc:document:elements AS ARRAY<VARIANT>), e -> e:content::STRING)) AS text
FROM (
  SELECT path, kind, ai_parse_document(content, {options}) AS doc
  FROM (SELECT path, content, 'invoice' AS kind FROM read_files('{volume}/invoices/', format => 'binaryFile')
        UNION ALL
        SELECT path, content, 'scan' AS kind FROM read_files('{volume}/public/', format => 'binaryFile', pathGlobFilter => '*.pdf'))
)
""")
parse_seconds = time.perf_counter() - start

spark.sql(f"""
CREATE OR REPLACE TABLE {elements} AS
SELECT path, kind, e:bbox[0]:page_id::INT AS page, e:id::INT AS element_id, e:type::STRING AS type,
       round(e:confidence::DOUBLE, 3) AS confidence, e:content::STRING AS content, e:description::STRING AS description,
       cast(e:bbox[0]:coord AS ARRAY<DOUBLE>) AS coord
FROM {parsed} LATERAL VIEW explode(cast(doc:document:elements AS ARRAY<VARIANT>)) AS e
""")
display(spark.table(parsed).select("path", "kind", "pages", "parse_errors", "text").orderBy("kind", "path"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## What OCR found on each page
# MAGIC
# MAGIC Each box is one element. The color is its type; hover a box for the type, the confidence, and the text it read. Below each document is every element as a row, including the figure descriptions.

# COMMAND ----------

import html, json

pages = spark.sql(f"""
SELECT path, kind, p:id::INT AS page, p:image_uri::STRING AS image_uri
FROM {parsed} LATERAL VIEW explode(cast(doc:document:pages AS ARRAY<VARIANT>)) AS p
ORDER BY kind DESC, path, page""").collect()
by_page = {}
for e in spark.table(elements).collect():
    by_page.setdefault((e.path, e.page), []).append(e.asDict())
titles = {d["file"]: d["title"] for d in spec["scans"]["documents"]}

def show_document(path, kind):
    name = path.split("/")[-1]
    blocks = []
    for p in (p for p in pages if p.path == path):
        image = open(p.image_uri, "rb").read()
        width, _ = a.jpeg_size(image)
        blocks.append(a.page_overlay_html(image, width, by_page.get((path, p.page), []), 420 if kind == "scan" else 300))
    displayHTML(f"<h3 style='font:600 16px sans-serif'>{html.escape(titles.get(name, name))}</h3>" + a.legend_html() + "".join(blocks))
    display(spark.table(elements).where(f"path = {a.sql_string(path)}").select("page", "element_id", "type", "confidence", "content", "description").orderBy("page", "element_id"))

for path in sorted({p.path for p in pages if p.kind == "scan"}):
    show_document(path, "scan")

# COMMAND ----------

# MAGIC %md
# MAGIC The six invoices are simple generated PDFs, so this shows just the first; every invoice's elements are in `aif_document_elements`.

# COMMAND ----------

show_document(sorted(p.path for p in pages if p.kind == "invoice")[0], "invoice")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Extract invoice fields
# MAGIC
# MAGIC Results go to `aif_invoices_extracted`, with any per-file error kept in its own column instead of failing the run. The table shows the expected value next to each extracted one.

# COMMAND ----------

schema_json = a.sql_string(spec["extract"]["schema"])
start = time.perf_counter()
spark.sql(f"""
CREATE OR REPLACE TABLE {extracted} AS
SELECT path,
       r:response:invoice_number::STRING AS invoice_number,
       r:response:vendor::STRING AS vendor,
       r:response:invoice_date::STRING AS invoice_date,
       r:response:total::DOUBLE AS total,
       r:error_message::STRING AS extract_error
FROM (SELECT path, ai_extract(text, {schema_json}, map('version', '2.0')) AS r
      FROM {parsed} WHERE kind = 'invoice' AND parse_errors = 0)
""")
seconds = time.perf_counter() - start
display(spark.sql(f"""
SELECT x.invoice_number, t.invoice_number AS expected_number, x.vendor, t.vendor AS expected_vendor,
       x.invoice_date, t.invoice_date AS expected_date, x.total, t.total AS expected_total, x.extract_error
FROM {extracted} x FULL JOIN {T['invoices_truth']} t ON element_at(split(x.path, '/'), -1) = element_at(split(t.path, '/'), -1)
ORDER BY t.invoice_number"""))

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
    ("seconds", seconds, "extract every invoice"),
], params["run_id"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Extract fields from the scans
# MAGIC
# MAGIC The same `ai_extract` call, with a schema for letters and patents. Two things make scans harder than the invoices. Truman's name is only in his handwritten signature. And OCR misreads the faded specification page of the patent as "No. 223,996, dated January 17, 1886", while the cover page says 223,898 and January 27, 1880.
# MAGIC
# MAGIC So the text given to `ai_extract` keeps only elements at or above `scans.min_confidence` in the spec (0.8), and skips signatures, whose "text" is a guess at handwriting. The misread element scored 0.70; the cover page scored 0.86. Without the filter, extraction picked the misread values in one of three reference runs. Everything OCR found is still shown above and saved in `aif_document_elements`.

# COMMAND ----------

scan_schema = json.loads(spec["scans"]["schema"])
min_confidence = float(spec["scans"]["min_confidence"])
start = time.perf_counter()
spark.sql(f"""
CREATE OR REPLACE TABLE {scans_extracted} AS
SELECT path, {", ".join(f"r:response:{field}::STRING AS {field}" for field in scan_schema)}, r:error_message::STRING AS extract_error
FROM (SELECT path, ai_extract(text, {a.sql_string(json.dumps(scan_schema))}, map('version', '2.0')) AS r
      FROM (SELECT path, concat_ws('\\n', transform(array_sort(collect_list(struct(page, element_id, content))), x -> x.content)) AS text
            FROM {elements}
            WHERE kind = 'scan' AND confidence >= {min_confidence} AND type <> 'signature' AND content IS NOT NULL
            GROUP BY path))
""")
scan_seconds = time.perf_counter() - start
dropped = spark.table(elements).where(f"kind = 'scan' AND (confidence < {min_confidence} OR type = 'signature')")
display(dropped.select("path", "page", "type", "confidence", "content").orderBy("path", "page", "element_id"))

rows, checks = [], []
got = {r.path.split("/")[-1]: r.asDict() for r in spark.table(scans_extracted).collect()}
for doc in spec["scans"]["documents"]:
    actual = got.get(doc["file"], {})
    for field in scan_schema:
        want = doc["expected"].get(field)
        ok = a.field_matches(field, want, actual.get(field)) if want is not None else None
        rows.append((doc["file"], field, actual.get(field), want, ok))
        if ok is not None:
            checks.append((doc["file"], field, ok))
display(spark.createDataFrame(rows, "file string, field string, extracted string, expected string, correct boolean"))

wrong = [f"{file}:{field}" for file, field, ok in checks if not ok]
a.write_results(spark, T["results"], "ocr", [
    ("scans", len(spec["scans"]["documents"]), ""),
    ("pages", sum(1 for p in pages if p.kind == "scan"), ""),
    ("elements", spark.table(elements).where("kind = 'scan'").count(), "text, titles, figures, signatures, and headers found"),
    ("figures_described", spark.table(elements).where("kind = 'scan' AND type = 'figure' AND description IS NOT NULL").count(), ""),
    ("elements_left_out", dropped.count(), f"below {min_confidence} confidence, or signatures"),
    ("fields_checked", len(checks), ""),
    ("field_accuracy", sum(ok for *_, ok in checks) / len(checks) if checks else 0.0, f"wrong: {wrong}"),
    ("parse_seconds", parse_seconds, "parse every invoice and scan, with page images and figure descriptions"),
    ("seconds", scan_seconds, "extract the scans"),
], params["run_id"])
