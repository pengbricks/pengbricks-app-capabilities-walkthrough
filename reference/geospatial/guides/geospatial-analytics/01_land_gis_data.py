# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Land the GIS files
# MAGIC
# MAGIC Writes the files a GIS team would hand over, into the `geo_files` volume: a GeoJSON export of four pressure zones, a CSV of pipes with WKT geometry, CSVs of meters, events, sensors, and sensor readings with longitude and latitude, and three inspection-report PDFs. The network is fictional and generated from fixed formulas, so every run writes the same files.
# MAGIC
# MAGIC It also saves the answer key as `geo_truth_*` tables (which zone each meter is in, which assets lie near each break, which pipe is nearest each sensor, what each report says). Later steps score their spatial joins against it.
# MAGIC
# MAGIC Safe to rerun: the schema and volume are created only if missing, the `gis/` and `reports/` folders are cleared first, and the answer-key tables are replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_geospatial", ['catalog', 'schema'])
catalog, schema = params["catalog"], params["schema"]

import geo_lib as g
volume = "geo_files"
spark.sql(f"CREATE SCHEMA IF NOT EXISTS `{catalog}`.`{schema}`")
spark.sql(f"CREATE VOLUME IF NOT EXISTS {g.fq(catalog, schema, volume)}")
root = f"/Volumes/{catalog}/{schema}/{volume}"

# COMMAND ----------

import csv, json, shutil

network = g.build_network()
for folder in ("gis", "reports"):
    shutil.rmtree(f"{root}/{folder}", ignore_errors=True)
    os.makedirs(f"{root}/{folder}")

def write_csv(name, rows, columns):
    with open(f"{root}/gis/{name}", "w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(columns)
        writer.writerows([[row[c] for c in columns] for row in rows])

with open(f"{root}/gis/zones.geojson", "w") as handle:
    handle.write(g.feature_collection(network["zones"], g.polygon_ring))
write_csv("pipes.csv", [{**p, "geometry_wkt": p["wkt"]} for p in network["pipes"]],
          ["pipe_id", "material", "diameter_mm", "install_year", "geometry_wkt"])
write_csv("meters.csv", [{**m, "longitude": m["lon"], "latitude": m["lat"]} for m in network["meters"]],
          ["meter_id", "customer_class", "install_year", "longitude", "latitude"])
write_csv("events.csv", [{**e, "longitude": e["lon"], "latitude": e["lat"]} for e in network["events"]],
          ["event_id", "event_type", "event_time", "longitude", "latitude"])
write_csv("sensors.csv", [{**s, "longitude": s["lon"], "latitude": s["lat"]} for s in network["sensors"]],
          ["sensor_id", "longitude", "latitude"])
write_csv("sensor_readings.csv", network["readings"], ["sensor_id", "reading_time", "pressure_psi"])
for report in g.REPORTS:
    g.render_report_pdf(report, f"{root}/reports/{report[0]}")
print(sorted(os.listdir(f"{root}/gis")), sorted(os.listdir(f"{root}/reports")))

# COMMAND ----------

# MAGIC %md
# MAGIC ## The answer key
# MAGIC
# MAGIC Computed from the generating coordinates with plain Python geometry, not with Databricks spatial functions, so the checks in the next steps are independent of what they check.

# COMMAND ----------

def fq(name):
    return g.fq(catalog, schema, name)

def overwrite(rows, columns, table):
    spark.createDataFrame(rows, columns).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(fq(table))

overwrite([(m["meter_id"], m["expected_zone"]) for m in network["meters"]], "meter_id string, expected_zone string", "geo_truth_meter_zone")
impact = g.expected_impact(network)
overwrite([(event, kind[:-1], asset) for event, groups in impact.items() for kind, assets in groups.items() for asset in sorted(assets)],
          "event_id string, asset_type string, asset_id string", "geo_truth_impact")
overwrite(sorted(g.expected_nearest_pipe(network).items()), "sensor_id string, expected_pipe string", "geo_truth_nearest")
overwrite([(r[0], r[1], r[2], r[3]) for r in g.REPORTS], "file string, asset_id string, condition string, inspection_date string", "geo_truth_reports")
overwrite([(f"hotspot-{i}", *g.utm_to_lonlat(g.ORIGIN[0] + x, g.ORIGIN[1] + y), n) for i, (x, y, n) in enumerate(g.HOTSPOTS, 1)],
          "hotspot string, longitude double, latitude double, complaints int", "geo_truth_hotspots")
display(spark.table(fq("geo_truth_impact")).groupBy("event_id", "asset_type").count().orderBy("event_id", "asset_type"))
