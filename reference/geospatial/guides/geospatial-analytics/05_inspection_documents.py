# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Join inspection reports to the asset geometry
# MAGIC
# MAGIC **Pattern 7: unstructured documents next to spatial data.** The inspection PDFs sit in the `geo_files` volume under Unity Catalog, next to the GIS files. `ai_parse_document` reads each one, `ai_extract` pulls the asset ID, condition, and date into columns, and a plain join on the asset ID attaches the pipe's geometry, material, and zone. From there the spatial functions work on a report like on any other row: here, the distance from each inspected pipe to the nearest main break.
# MAGIC
# MAGIC Scanned maps and photos follow the same shape (volume, parse or describe, extract, join on an ID or a location), but this step runs only the PDFs. See the markdown at the end for the image options.
# MAGIC
# MAGIC Safe to rerun: every table is replaced and the step's rows in `geo_results` are swapped.

# COMMAND ----------

import sys, os, json
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_geospatial", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]

import geo_lib as g
T = lambda name: g.fq(catalog, schema, name)
reports = f"/Volumes/{catalog}/{schema}/geo_files/reports"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Parse once, keep the result
# MAGIC
# MAGIC The parsed output is saved, so extraction and every later query read the table instead of parsing again. `parse_errors` counts entries in `error_status`; a VARIANT null is a value, not SQL NULL, so `doc:error_status IS NULL` would never match.

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE TABLE {T('geo_reports_parsed')} AS
SELECT path, doc,
       coalesce(array_size(try_variant_get(doc, '$.error_status', 'ARRAY<VARIANT>')), 0) AS parse_errors,
       array_size(cast(doc:document:pages AS ARRAY<VARIANT>)) AS pages,
       concat_ws('\\n', transform(cast(doc:document:elements AS ARRAY<VARIANT>), e -> e:content::STRING)) AS text
FROM (SELECT path, ai_parse_document(content, map('version', '2.0')) AS doc
      FROM read_files('{reports}/', format => 'binaryFile', pathGlobFilter => '*.pdf'))
""")
display(spark.sql(f"SELECT element_at(split(path, '/'), -1) AS file, pages, parse_errors, text FROM {T('geo_reports_parsed')} ORDER BY file"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Extract the fields
# MAGIC
# MAGIC The schema names three fields and says what each one holds. Results go to a table with any per-file error kept in its own column.

# COMMAND ----------

schema_json = g.sql_string(json.dumps(g.EXTRACT_SCHEMA))
spark.sql(f"""
CREATE OR REPLACE TABLE {T('geo_reports_extracted')} AS
SELECT element_at(split(path, '/'), -1) AS file,
       r:response:asset_id::STRING AS asset_id, r:response:condition::STRING AS condition,
       r:response:inspection_date::STRING AS inspection_date, r:error_message::STRING AS extract_error
FROM (SELECT path, ai_extract(text, {schema_json}, map('version', '2.0')) AS r FROM {T('geo_reports_parsed')} WHERE parse_errors = 0)
""")
display(spark.sql(f"""
SELECT x.file, x.asset_id, t.asset_id AS expected_asset, x.condition, t.condition AS expected_condition, x.inspection_date, t.inspection_date AS expected_date, x.extract_error
FROM {T('geo_reports_extracted')} x FULL JOIN {T('geo_truth_reports')} t USING (file) ORDER BY file"""))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Join to the pipe geometry
# MAGIC
# MAGIC Join on the extracted asset ID. A report whose ID matches no pipe keeps a row with a null `pipe_id` so it can be reviewed, not lost. The distance to the nearest main break uses the metric column.

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE TABLE {T('geo_inspected_assets')} AS
WITH pipe_zone AS (  -- a main that crosses a zone line intersects two zones; keep the lower zone ID
  SELECT p.pipe_id, min(z.zone_id) AS zone_id FROM {T('geo_pipes')} p JOIN {T('geo_zones')} z ON st_intersects(z.geom, p.geom) GROUP BY p.pipe_id)
SELECT x.file, x.asset_id, x.condition, to_date(x.inspection_date) AS inspection_date,
       p.pipe_id IS NOT NULL AS matched_pipe, p.material, p.diameter_mm, p.install_year, p.length_m, z.zone_id, p.geom,
       b.event_id AS nearest_break, round(b.distance_m, 0) AS distance_to_break_m
FROM {T('geo_reports_extracted')} x
LEFT JOIN {T('geo_pipes')} p ON p.pipe_id = x.asset_id
LEFT JOIN pipe_zone z ON z.pipe_id = p.pipe_id
LEFT JOIN (SELECT p2.pipe_id, e.event_id, st_distance(p2.geom_m, e.geom_m) AS distance_m,
                  row_number() OVER (PARTITION BY p2.pipe_id ORDER BY st_distance(p2.geom_m, e.geom_m)) AS rank
           FROM {T('geo_pipes')} p2 CROSS JOIN {T('geo_events')} e WHERE e.event_type = 'main_break') b ON b.pipe_id = p.pipe_id AND b.rank = 1
""")
display(spark.sql(f"SELECT file, asset_id, condition, inspection_date, matched_pipe, material, zone_id, nearest_break, distance_to_break_m, st_astext(geom) AS geometry FROM {T('geo_inspected_assets')} ORDER BY file"))

truth = {r.file: r for r in spark.table(T("geo_truth_reports")).collect()}
got = {r.file: r for r in spark.table(T("geo_reports_extracted")).collect()}
fields = {"asset_id": 0, "condition": 0, "inspection_date": 0}
wrong = []
for file, expected in truth.items():
    actual = got.get(file)
    for field in fields:
        want, have = getattr(expected, field), getattr(actual, field) if actual else None
        ok = have is not None and str(have).strip().lower() == str(want).lower()
        fields[field] += ok
        if not ok:
            wrong.append(f"{file}:{field}={have!r}")
matched = spark.table(T("geo_inspected_assets")).where("matched_pipe").count()
parsed_ok = spark.table(T("geo_reports_parsed")).where("parse_errors = 0").count()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Photos and scanned maps
# MAGIC
# MAGIC This step does not run images. Two routes exist, and the guide only claims what the docs state:
# MAGIC
# MAGIC - **Scanned maps and image PDFs:** `ai_parse_document` OCRs scans and can describe figures (`descriptionElementTypes`), as the AI Functions guide shows.
# MAGIC - **Photos:** `ai_query` accepts image input (JPEG or PNG) through the `files =>` argument on a multimodal model endpoint, with the file bytes from `read_files(..., format => 'binaryFile')`. Which model to call and how well it reads a pipe photo is something to test on a labeled sample of your own photos first. Location comes from the asset ID or the photo's own metadata; a model reading a picture does not give you a coordinate.

# COMMAND ----------

g.write_results(spark, T("geo_results"), "documents", [
    ("reports", len(truth), ""),
    ("parsed_without_error", parsed_ok, ""),
    *[(f"{field}_correct", hits, f"of {len(truth)}") for field, hits in fields.items()],
    ("fields_wrong", len(wrong), ", ".join(wrong)),
    ("matched_to_pipe", matched, "extracted asset ID found in geo_pipes"),
], params["run_id"])
