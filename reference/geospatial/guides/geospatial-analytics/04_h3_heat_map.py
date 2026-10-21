# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Aggregate events by H3 cell for a heat map
# MAGIC
# MAGIC **Pattern 6: H3 aggregation.** Counting points in a hexagon is a `GROUP BY` on a number, which is the cheapest spatial aggregation there is, and the result is a small table a dashboard can plot. This step turns low-pressure complaints into counts per resolution-8 cell (edge about 530 m), adds the cell's center as longitude and latitude, divides by the meters in that cell to get a rate, and smooths each cell with its six neighbors using `H3_KRing`.
# MAGIC
# MAGIC Safe to rerun: the table is replaced and the step's rows in `geo_results` are swapped.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_geospatial", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]

import geo_lib as g
T = lambda name: g.fq(catalog, schema, name)
HEAT, H3 = g.H3_HEAT_RES, g.H3_RES

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE TABLE {T('geo_complaint_cells')} AS
WITH complaints AS (
  SELECT h3_toparent(h3_r{H3}, {HEAT}) AS cell, count(*) AS complaints
  FROM {T('geo_events')} WHERE event_type = 'low_pressure_complaint' GROUP BY 1),
meters AS (
  SELECT h3_toparent(h3_r{H3}, {HEAT}) AS cell, count(*) AS meters FROM {T('geo_meters')} GROUP BY 1),
cells AS (
  SELECT c.cell, c.complaints, coalesce(m.meters, 0) AS meters FROM complaints c LEFT JOIN meters m USING (cell)),
smoothed AS (
  SELECT a.cell, sum(b.complaints) AS complaints_with_neighbors
  FROM (SELECT cell, explode(h3_kring(cell, 1)) AS neighbor FROM cells) a JOIN cells b ON b.cell = a.neighbor GROUP BY a.cell)
SELECT h3_h3tostring(c.cell) AS cell_hex, c.complaints, c.meters,
       CASE WHEN c.meters > 0 THEN round(100.0 * c.complaints / c.meters, 1) END AS complaints_per_100_meters,
       s.complaints_with_neighbors,
       st_x(st_geomfromtext(h3_centeraswkt(c.cell))) AS longitude, st_y(st_geomfromtext(h3_centeraswkt(c.cell))) AS latitude
FROM cells c JOIN smoothed s USING (cell)
""")
display(spark.sql(f"SELECT * FROM {T('geo_complaint_cells')} ORDER BY complaints DESC LIMIT 10"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Did the heat map find the hotspots?
# MAGIC
# MAGIC The generator placed three clusters of complaints (60, 45, and 30) around known points. For each one, look for a cell within 600 m of the cluster center that holds at least 15 complaints.

# COMMAND ----------

found = spark.sql(f"""
SELECT h.hotspot, h.complaints AS planted, max(c.complaints) AS best_cell, count(*) AS cells_in_range
FROM {T('geo_truth_hotspots')} h JOIN {T('geo_complaint_cells')} c
  ON st_distancespheroid(st_point(h.longitude, h.latitude, 4326), st_point(c.longitude, c.latitude, 4326)) <= 600
GROUP BY h.hotspot, h.complaints ORDER BY h.hotspot""")
display(found)
rows = found.collect()
hotspots_found = sum(1 for r in rows if r.best_cell >= 15)
total_cells = spark.table(T("geo_complaint_cells")).count()
total_complaints = spark.table(T("geo_complaint_cells")).selectExpr("sum(complaints)").first()[0]
expected_complaints = spark.table(T("geo_events")).where("event_type = 'low_pressure_complaint'").count()
print(f"{total_cells} cells hold {total_complaints} of {expected_complaints} complaints; hotspots found: {hotspots_found} of 3")

# COMMAND ----------

g.write_results(spark, T("geo_results"), "heat_map", [
    ("complaints", expected_complaints, ""),
    ("cells", total_cells, f"H3 resolution {HEAT}"),
    ("complaints_in_cells", total_complaints, "every complaint lands in exactly one cell"),
    ("hotspots_found", hotspots_found, "of 3 planted clusters, a cell of 15 or more within 600 m"),
], params["run_id"])
