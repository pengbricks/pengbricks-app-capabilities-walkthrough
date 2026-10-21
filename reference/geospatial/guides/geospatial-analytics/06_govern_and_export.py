# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 6. Govern the tables and export to GIS tools
# MAGIC
# MAGIC **Pattern 8, the export half.** Esri and QGIS can read a SQL warehouse over ODBC or JDBC, or open files. This step writes the impacted meters to the volume as a CSV with a WKT column and as a GeoJSON file, both of which QGIS opens directly.
# MAGIC
# MAGIC **Governance.** Geometry columns are ordinary Unity Catalog columns, so the usual controls apply. This step puts a row filter on a copy of the meter table so that a person sees only the districts mapped to them, and reads the grants on the geometry tables. It changes no grants.
# MAGIC
# MAGIC Safe to rerun: the governed copy is dropped and rebuilt, the access table is replaced, and exports overwrite their files.

# COMMAND ----------

import sys, os, json
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_geospatial", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]

import geo_lib as g
T = lambda name: g.fq(catalog, schema, name)
root = f"/Volumes/{catalog}/{schema}/geo_files"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Export impacted meters for QGIS or Esri

# COMMAND ----------

import shutil
shutil.rmtree(f"{root}/exports", ignore_errors=True)
os.makedirs(f"{root}/exports")
rows = spark.sql(f"""
SELECT i.event_id, m.meter_id, m.customer_class, i.zone_id, i.distance_m, st_astext(m.geom) AS wkt, st_asgeojson(m.geom) AS geojson
FROM {T('geo_break_impact')} i JOIN {T('geo_meters')} m ON m.meter_id = i.asset_id WHERE i.asset_type = 'meter' ORDER BY i.event_id, i.distance_m""").collect()
import csv
with open(f"{root}/exports/impacted_meters.csv", "w", newline="") as handle:
    writer = csv.writer(handle)
    writer.writerow(["event_id", "meter_id", "customer_class", "zone_id", "distance_m", "wkt"])
    writer.writerows([[r.event_id, r.meter_id, r.customer_class, r.zone_id, r.distance_m, r.wkt] for r in rows])
features = [{"type": "Feature", "properties": {"event_id": r.event_id, "meter_id": r.meter_id, "zone_id": r.zone_id, "distance_m": r.distance_m}, "geometry": json.loads(r.geojson)} for r in rows]
with open(f"{root}/exports/impacted_meters.geojson", "w") as handle:
    json.dump({"type": "FeatureCollection", "features": features}, handle)
print(f"exported {len(rows)} meters:", sorted(os.listdir(f"{root}/exports")))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Row filter by district
# MAGIC
# MAGIC Name the function's parameter something no column in the subquery uses. Inside the `EXISTS`, a bare `district` resolves to the access table's own column, the test is always true, and the filter lets every row through.
# MAGIC
# MAGIC The filter function returns true for a row when the access table maps the current user to that row's district. The access table here maps the user running this notebook to `north`, so the filtered copy shows only north meters. In production, map groups instead of users, or call `is_account_group_member()`, and manage the mapping like any other governed table.

# COMMAND ----------

user = spark.sql("SELECT current_user()").first()[0]
spark.sql(f"DROP TABLE IF EXISTS {T('geo_meters_governed')}")
spark.sql(f"DROP FUNCTION IF EXISTS {T('geo_district_filter')}")
spark.sql(f"CREATE OR REPLACE TABLE {T('geo_district_access')} AS SELECT current_user() AS user_name, 'north' AS district")
spark.sql(f"""
CREATE FUNCTION {T('geo_district_filter')}(row_district STRING)
RETURN EXISTS (SELECT 1 FROM {T('geo_district_access')} a WHERE a.user_name = current_user() AND a.district = row_district)
""")
spark.sql(f"""
CREATE TABLE {T('geo_meters_governed')} AS
SELECT m.meter_id, m.customer_class, z.district, m.geom FROM {T('geo_meters')} m JOIN {T('geo_meter_zone')} z USING (meter_id) WHERE z.district IS NOT NULL
""")
all_rows = spark.table(T("geo_meters_governed")).count()
spark.sql(f"ALTER TABLE {T('geo_meters_governed')} SET ROW FILTER {T('geo_district_filter')} ON (district)")
visible = spark.sql(f"SELECT district, count(*) AS meters FROM {T('geo_meters_governed')} GROUP BY district").collect()
display(spark.createDataFrame([r.asDict() for r in visible]))
print(f"{user} sees {sum(r.meters for r in visible)} of {all_rows} meters, in districts {[r.district for r in visible]}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Who can read the geometry tables
# MAGIC
# MAGIC Read-only. To give a team access, grant `USE CATALOG`, `USE SCHEMA`, and `SELECT` on the tables (or on the schema) to a group.

# COMMAND ----------

grants = spark.sql(f"SHOW GRANTS ON TABLE {T('geo_meters')}").collect()
display(spark.createDataFrame([r.asDict() for r in grants]) if grants else spark.createDataFrame([], "Principal string, ActionType string, ObjectType string, ObjectKey string"))
for table, comment in {
    "geo_meters": "Synthetic service meters as WGS 84 points with a UTM 10N copy and an H3 resolution 9 cell. Clustered on the cell.",
    "geo_pipes": "Synthetic water mains as WGS 84 linestrings with a UTM 10N copy.",
    "geo_zones": "Synthetic pressure zones as WGS 84 polygons with a UTM 10N copy.",
}.items():
    spark.sql(f"COMMENT ON TABLE {T(table)} IS {g.sql_string(comment)}")

# COMMAND ----------

g.write_results(spark, T("geo_results"), "govern_export", [
    ("exported_meters", len(rows), "impacted meters written as CSV (WKT) and GeoJSON"),
    ("meters_in_governed_copy", all_rows, "meters inside a zone, before the row filter"),
    ("meters_visible_with_filter", sum(r.meters for r in visible), "rows the running user can read after the filter"),
    ("districts_visible", len(visible), "of 2"),
], params["run_id"])
display(spark.sql(f"SELECT step, metric, value, detail FROM {T('geo_results')} ORDER BY step, metric"))
