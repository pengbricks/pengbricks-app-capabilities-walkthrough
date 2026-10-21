# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt pyogrio

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Load geometries into Delta
# MAGIC
# MAGIC **Pattern 1: ingest and normalize GIS formats and SRIDs.** Each source arrives in a different shape, and each has a built-in way in:
# MAGIC
# MAGIC | Source | How it loads |
# MAGIC |---|---|
# MAGIC | GeoJSON file | `read_files` as text, then `ST_GeomFromGeoJSON` (always SRID 4326) |
# MAGIC | CSV with a WKT column | `ST_GeomFromText(wkt, 4326)` |
# MAGIC | CSV with longitude and latitude | `ST_Point(lon, lat, 4326)` |
# MAGIC | Shapefile, GeoPackage, KML | No built-in reader. Convert with GDAL (here through `pyogrio`) to WKB, then `ST_GeomFromWKB` |
# MAGIC
# MAGIC Every table stores `GEOMETRY(4326)` for interchange and a second `geom_m` column in a metric projection (UTM zone 10N, EPSG:32610) for distances, buffers, and areas. Point tables also carry an H3 cell and are clustered on it.
# MAGIC
# MAGIC Safe to rerun: every table is replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_geospatial", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]

import geo_lib as g
T = lambda name: g.fq(catalog, schema, name)
root = f"/Volumes/{catalog}/{schema}/geo_files"
UTM, H3 = g.UTM_SRID, g.H3_RES

# COMMAND ----------

# MAGIC %md
# MAGIC ## Zones from GeoJSON
# MAGIC
# MAGIC The file is one FeatureCollection. Read it whole, split the features, and parse each geometry. `ST_Transform` adds the metric copy.

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE TABLE {T('geo_zones')} AS
SELECT f:properties:zone_id::STRING AS zone_id, f:properties:zone_name::STRING AS zone_name,
       f:properties:district::STRING AS district, f:properties:target_psi::INT AS target_psi,
       geom, st_transform(geom, {UTM}) AS geom_m
FROM (SELECT f, st_geomfromgeojson(f:geometry::STRING) AS geom
      FROM (SELECT explode(cast(parse_json(value):features AS ARRAY<VARIANT>)) AS f
            FROM read_files('{root}/gis/zones.geojson', format => 'text', wholeText => true)))
""")
display(spark.sql(f"SELECT zone_id, zone_name, district, target_psi, st_srid(geom) AS srid, st_geometrytype(geom) AS type, round(st_area(geom_m) / 1e6, 2) AS area_km2 FROM {T('geo_zones')} ORDER BY zone_id"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Pipes from WKT, meters and events from longitude and latitude
# MAGIC
# MAGIC `read_files` infers column types from the CSV. Meters, events, and sensors get an H3 cell (resolution 9, edge about 200 m) next to the geometry, and the tables are clustered on that cell with liquid clustering.

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE TABLE {T('geo_pipes')} AS
SELECT pipe_id, material, diameter_mm, install_year, geom, st_transform(geom, {UTM}) AS geom_m,
       round(st_length(st_transform(geom, {UTM})), 1) AS length_m
FROM (SELECT *, st_geomfromtext(geometry_wkt, 4326) AS geom FROM read_files('{root}/gis/pipes.csv', format => 'csv', header => true))
""")

def point_table(table, source, keep):
    spark.sql(f"""
    CREATE OR REPLACE TABLE {T(table)} CLUSTER BY (h3_r{H3}) AS
    SELECT {keep}, longitude, latitude, geom, st_transform(geom, {UTM}) AS geom_m, h3_longlatash3(longitude, latitude, {H3}) AS h3_r{H3}
    FROM (SELECT *, st_point(longitude, latitude, 4326) AS geom FROM read_files('{root}/gis/{source}', format => 'csv', header => true))
    """)

point_table("geo_meters", "meters.csv", "meter_id, customer_class, install_year")
point_table("geo_events", "events.csv", "event_id, event_type, to_timestamp(event_time) AS event_time")
point_table("geo_sensors", "sensors.csv", "sensor_id")
spark.sql(f"""
CREATE OR REPLACE TABLE {T('geo_sensor_readings')} AS
SELECT sensor_id, to_timestamp(reading_time) AS reading_time, pressure_psi FROM read_files('{root}/gis/sensor_readings.csv', format => 'csv', header => true)
""")
counts = {t: spark.table(T(t)).count() for t in ("geo_zones", "geo_pipes", "geo_meters", "geo_events", "geo_sensors", "geo_sensor_readings")}
print(counts)
display(spark.sql(f"SELECT meter_id, customer_class, longitude, latitude, st_astext(geom) AS wgs84, st_astext(st_transform(geom, {UTM})) AS utm_10n, h3_r{H3} FROM {T('geo_meters')} LIMIT 3"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Check the geometries
# MAGIC
# MAGIC Run these on every load. An invalid polygon or a mixed SRID does not always fail a join; it can quietly drop rows.

# COMMAND ----------

checks = spark.sql(f"""
SELECT 'zones' AS tbl, count(*) AS rows, sum(CASE WHEN st_isvalid(geom) THEN 0 ELSE 1 END) AS invalid, count(DISTINCT st_srid(geom)) AS srids, sum(CASE WHEN st_isempty(geom) THEN 1 ELSE 0 END) AS empty FROM {T('geo_zones')}
UNION ALL SELECT 'pipes', count(*), sum(CASE WHEN st_isvalid(geom) THEN 0 ELSE 1 END), count(DISTINCT st_srid(geom)), sum(CASE WHEN st_isempty(geom) THEN 1 ELSE 0 END) FROM {T('geo_pipes')}
UNION ALL SELECT 'meters', count(*), sum(CASE WHEN st_isvalid(geom) THEN 0 ELSE 1 END), count(DISTINCT st_srid(geom)), sum(CASE WHEN st_isempty(geom) THEN 1 ELSE 0 END) FROM {T('geo_meters')}
UNION ALL SELECT 'events', count(*), sum(CASE WHEN st_isvalid(geom) THEN 0 ELSE 1 END), count(DISTINCT st_srid(geom)), sum(CASE WHEN st_isempty(geom) THEN 1 ELSE 0 END) FROM {T('geo_events')}
""").collect()
display(spark.createDataFrame([r.asDict() for r in checks]))
srid_estimate = spark.sql(f"SELECT st_estimatesrid(st_union_agg(geom)) FROM {T('geo_zones')}").first()[0]
print("st_estimatesrid for the whole service area:", srid_estimate)
clustering = [r for r in spark.sql(f"DESCRIBE DETAIL {T('geo_meters')}").collect()][0]["clusteringColumns"]
print("geo_meters clustered on:", clustering)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Shapefile, GeoPackage, and KML
# MAGIC
# MAGIC Databricks has no built-in reader for these container formats, and `read_files` does not list them. The pattern is to let GDAL do the decoding and hand Spark standard WKB. This cell writes the zones to each format and reads them back with `pyogrio`, which bundles GDAL. It then loads the WKB with `ST_GeomFromWKB`, sets SRID 4326, and compares each zone with the GeoJSON load. On a real project the files come from the GIS team; `pyogrio.raw.read` and the WKB step are the same.
# MAGIC
# MAGIC GDAL writes SQLite (GeoPackage) and multi-file (Shapefile) formats to local disk, so the cell works in a temp folder and copies the files to the volume afterward. Each format runs on its own, and a failure is recorded, not raised.

# COMMAND ----------

import numpy as np
from pyogrio import raw as ogr

zones = spark.sql(f"SELECT zone_id, zone_name, st_asbinary(geom) AS wkb FROM {T('geo_zones')} ORDER BY zone_id").collect()
import shutil, tempfile
folder = tempfile.mkdtemp()  # GDAL formats need local disk: SQLite and multi-file writes fail on the volume mount
keep = f"{root}/gis/containers"
shutil.rmtree(keep, ignore_errors=True)
formats = {"GeoPackage": ("zones.gpkg", "GPKG"), "Shapefile": ("zones.shp", "ESRI Shapefile"), "KML": ("zones.kml", "KML")}
format_results = {}
for label, (name, driver) in formats.items():
    path = f"{folder}/{name}"
    try:
        ogr.write(path, geometry=np.array([bytes(z.wkb) for z in zones], dtype=object),
                  field_data=[np.array([z.zone_id for z in zones], dtype=object)], fields=["zone_id"],
                  geometry_type="Polygon", crs="EPSG:4326", driver=driver)
        meta, _, geometry, field_data = ogr.read(path)
        frame = spark.createDataFrame([(str(i), bytearray(w)) for i, w in zip(field_data[0], geometry)], "zone_id string, wkb binary")
        frame.createOrReplaceTempView("zz_container_zones")
        mismatches = spark.sql(f"""
            SELECT count(*) FROM (SELECT zone_id, st_setsrid(st_geomfromwkb(wkb), 4326) AS g FROM zz_container_zones) c
            JOIN {T('geo_zones')} z USING (zone_id)
            WHERE NOT (st_npoints(c.g) = st_npoints(z.geom) AND st_distance(st_centroid(c.g), st_centroid(z.geom)) < 1e-5)""").first()[0]
        format_results[label] = (len(geometry), mismatches, "")
    except Exception as error:  # record and keep going
        format_results[label] = (0, -1, str(error).splitlines()[0][:160])
shutil.copytree(folder, keep)
display(spark.createDataFrame([(k, *v) for k, v in format_results.items()], "format string, zones_read int, mismatches int, error string"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## GeoParquet and newline-delimited GeoJSON
# MAGIC
# MAGIC Neither has a documented built-in geometry reader, so this cell checks what the plain readers do. A GeoParquet file is Parquet with a WKB `BINARY` column and a `geo` metadata entry; `read_files` returns the column as binary, and `ST_GeomFromWKB` turns it into GEOMETRY. A newline-delimited GeoJSON file has one Feature per line; read it as text, parse each line, and use `ST_GeomFromGeoJSON`. Both are compared with the GeoJSON load.

# COMMAND ----------

import json, pyarrow as pa, pyarrow.parquet as pq

COMPARE = """WHERE NOT (st_npoints(c.g) = st_npoints(z.geom) AND st_distance(st_centroid(c.g), st_centroid(z.geom)) < 1e-5)"""
extra = {}
scratch = tempfile.mkdtemp()
try:
    table = pa.table({"zone_id": [z.zone_id for z in zones], "geometry": pa.array([bytes(z.wkb) for z in zones], type=pa.binary())})
    geo = {"version": "1.0.0", "primary_column": "geometry", "columns": {"geometry": {"encoding": "WKB", "geometry_types": ["Polygon"]}}}
    pq.write_table(table.replace_schema_metadata({"geo": json.dumps(geo)}), f"{scratch}/zones.parquet")
    shutil.copy(f"{scratch}/zones.parquet", f"{keep}/zones.parquet")
    column_type = spark.sql(f"SELECT * FROM read_files('{keep}/zones.parquet', format => 'parquet')").schema["geometry"].dataType.simpleString()
    bad = spark.sql(f"""
        SELECT count(*) FROM (SELECT zone_id, st_setsrid(st_geomfromwkb(geometry), 4326) AS g FROM read_files('{keep}/zones.parquet', format => 'parquet')) c
        JOIN {T('geo_zones')} z USING (zone_id) {COMPARE}""").first()[0]
    extra["GeoParquet"] = (len(zones), bad, f"read_files returns the geometry column as {column_type}; ST_GeomFromWKB converts it")
except Exception as error:
    extra["GeoParquet"] = (0, -1, str(error).splitlines()[0][:160])
try:
    features = json.loads(spark.sql(f"SELECT value FROM read_files('{root}/gis/zones.geojson', format => 'text', wholeText => true)").first()[0])["features"]
    with open(f"{scratch}/zones.ndjson", "w") as handle:
        handle.write("\n".join(json.dumps(f) for f in features) + "\n")
    shutil.copy(f"{scratch}/zones.ndjson", f"{keep}/zones.ndjson")
    bad = spark.sql(f"""
        SELECT count(*) FROM (SELECT f:properties:zone_id::STRING AS zone_id, st_geomfromgeojson(f:geometry::STRING) AS g
                              FROM (SELECT parse_json(value) AS f FROM read_files('{keep}/zones.ndjson', format => 'text'))) c
        JOIN {T('geo_zones')} z USING (zone_id) {COMPARE}""").first()[0]
    extra["NDJSON"] = (len(features), bad, "one Feature per line, read as text")
except Exception as error:
    extra["NDJSON"] = (0, -1, str(error).splitlines()[0][:160])
display(spark.createDataFrame([(k, *v) for k, v in extra.items()], "format string, zones_read int, mismatches int, note string"))
format_results.update(extra)

# COMMAND ----------

rows = [(f"rows_{t}", n, "") for t, n in counts.items()]
rows += [("invalid_geometries", sum(r["invalid"] for r in checks), "ST_IsValid false across zones, pipes, meters, events"),
         ("srids_per_table_max", max(r["srids"] for r in checks), "")]
for label, (read, mismatches, error) in format_results.items():
    rows.append((f"container_{label.lower()}_ok", 1.0 if read == len(zones) and mismatches == 0 else 0.0, error or f"{read} zones read, {mismatches} differ from the GeoJSON load"))
g.write_results(spark, T("geo_results"), "load", rows, params["run_id"])
