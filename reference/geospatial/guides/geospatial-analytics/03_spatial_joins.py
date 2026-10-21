# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Spatial joins: membership, proximity, nearest, and the H3 prefilter
# MAGIC
# MAGIC Four patterns, each scored against the `geo_truth_*` answer key from step 1.
# MAGIC
# MAGIC | Pattern | Question | Functions |
# MAGIC |---|---|---|
# MAGIC | 2. Point-in-polygon membership | Which pressure zone is each meter in? | `ST_Contains` |
# MAGIC | 3. Proximity and buffer impact | Which meters and pipes lie within 260 m of a main break? | `ST_DWithin` on the metric column, `ST_Distance`, `ST_Buffer` |
# MAGIC | 4. Nearest neighbor | Which pipe is each pressure sensor on? | `ST_DWithin` to narrow, `ST_Distance` to rank |
# MAGIC | 5. H3 prefilter, then exact | Same as pattern 2, with fewer pairs to test | `H3_CoverAsH3`, `H3_KRing`, then `ST_Contains` |
# MAGIC
# MAGIC Safe to rerun: every table is replaced and the step's rows in `geo_results` are swapped.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_geospatial", ['catalog', 'schema', 'radius_m', 'run_id'], defaults={'radius_m': '260', 'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
radius = float(params["radius_m"])

import geo_lib as g
T = lambda name: g.fq(catalog, schema, name)
H3 = g.H3_RES

# COMMAND ----------

# MAGIC %md
# MAGIC ## Pattern 2: which zone is each meter in?
# MAGIC
# MAGIC `ST_Contains(zone, meter)` needs both geometries in the same SRID. A meter outside every zone keeps a row with a null zone (left join), so it shows up in the count instead of vanishing.

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE TABLE {T('geo_meter_zone')} AS
SELECT m.meter_id, m.customer_class, z.zone_id, z.district
FROM {T('geo_meters')} m LEFT JOIN {T('geo_zones')} z ON st_contains(z.geom, m.geom)
""")
display(spark.sql(f"SELECT zone_id, district, count(*) AS meters, sum(CASE WHEN customer_class = 'commercial' THEN 1 ELSE 0 END) AS commercial FROM {T('geo_meter_zone')} GROUP BY ALL ORDER BY zone_id"))
wrong_zone = spark.sql(f"""
SELECT count(*) FROM {T('geo_meter_zone')} r JOIN {T('geo_truth_meter_zone')} t USING (meter_id)
WHERE NOT (r.zone_id <=> t.expected_zone)""").first()[0]
meter_rows = spark.table(T("geo_meter_zone")).count()
outside = spark.table(T("geo_meter_zone")).where("zone_id IS NULL").count()
dup = meter_rows - spark.table(T("geo_meter_zone")).select("meter_id").distinct().count()
print(f"{meter_rows} meter rows, {outside} outside every zone, {dup} duplicated, {wrong_zone} in the wrong zone")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Pattern 5: prefilter with H3, then test exactly
# MAGIC
# MAGIC Cover each zone with H3 cells once. `H3_CoverAsH3` returns every cell that touches the polygon; `H3_PolyfillAsH3` returns only cells whose center is inside, so it misses meters near an edge. Joining meters to zone cells on the cell ID is an equality join, which Spark can shuffle and sort cheaply. `ST_Contains` then runs only on the pairs that survive.

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE TABLE {T('geo_zone_cells')} AS
SELECT zone_id, explode(h3_coverash3(st_astext(geom), {H3})) AS cell FROM {T('geo_zones')}
""")
spark.sql(f"""
CREATE OR REPLACE TABLE {T('geo_zone_cells_center')} AS
SELECT zone_id, explode(h3_polyfillash3(st_astext(geom), {H3})) AS cell FROM {T('geo_zones')}
""")
candidates = spark.sql(f"SELECT count(*) FROM {T('geo_meters')} m JOIN {T('geo_zone_cells')} c ON m.h3_r{H3} = c.cell").first()[0]
prefiltered = spark.sql(f"""
SELECT m.meter_id, z.zone_id
FROM {T('geo_meters')} m JOIN {T('geo_zone_cells')} c ON m.h3_r{H3} = c.cell
JOIN {T('geo_zones')} z ON z.zone_id = c.zone_id AND st_contains(z.geom, m.geom)""")
exact = spark.sql(f"SELECT meter_id, zone_id FROM {T('geo_meter_zone')} WHERE zone_id IS NOT NULL")
differs = prefiltered.exceptAll(exact).count() + exact.exceptAll(prefiltered).count()
center_only = spark.sql(f"""
SELECT count(*) FROM (SELECT m.meter_id, c.zone_id FROM {T('geo_meters')} m JOIN {T('geo_zone_cells_center')} c ON m.h3_r{H3} = c.cell) h
LEFT ANTI JOIN {T('geo_meter_zone')} e ON h.meter_id = e.meter_id AND h.zone_id = e.zone_id""").first()[0]
center_missed = spark.sql(f"""
SELECT count(*) FROM {T('geo_meter_zone')} e LEFT ANTI JOIN (SELECT m.meter_id, c.zone_id FROM {T('geo_meters')} m JOIN {T('geo_zone_cells_center')} c ON m.h3_r{H3} = c.cell) h
ON h.meter_id = e.meter_id AND h.zone_id = e.zone_id WHERE e.zone_id IS NOT NULL""").first()[0]
naive_pairs = spark.table(T("geo_meters")).count() * spark.table(T("geo_zones")).count()
print(f"pairs for ST_Contains: {naive_pairs} without a prefilter, {candidates} with the H3 cover")
print(f"prefilter + exact differs from exact-only on {differs} rows")
print(f"cell-only (cover) gives {candidates - spark.table(T('geo_meter_zone')).where('zone_id IS NOT NULL').count()} extra pairs before the exact test; cell-center (polyfill) puts {center_only} meters in a wrong zone and misses {center_missed}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Pattern 3: what is within 260 m of a main break?
# MAGIC
# MAGIC `ST_DWithin` measures in the units of the coordinates. On longitude and latitude that is degrees, which is useless for a radius in meters, so the join uses the `geom_m` columns in UTM (meters). Without a prefilter this is a nested-loop-style distance test, so the meter join uses an H3 ring first: the break's cell plus its neighbors out to `k` rings. At resolution 9 (edge about 200 m) two rings cover 260 m with room to spare.
# MAGIC
# MAGIC Pipes are lines, so the join uses `ST_DWithin` against the whole linestring: a main counts if any part of it is inside the radius.

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE TABLE {T('geo_break_impact')} AS
SELECT e.event_id, 'meter' AS asset_type, m.meter_id AS asset_id, z.zone_id, round(st_distance(e.geom_m, m.geom_m), 1) AS distance_m
FROM (SELECT *, explode(h3_kring(h3_r{H3}, 2)) AS ring_cell FROM {T('geo_events')} WHERE event_type = 'main_break') e
JOIN {T('geo_meters')} m ON m.h3_r{H3} = e.ring_cell AND st_dwithin(e.geom_m, m.geom_m, {radius})
LEFT JOIN {T('geo_meter_zone')} z ON z.meter_id = m.meter_id
UNION ALL
SELECT e.event_id, 'pipe', p.pipe_id, NULL, round(st_distance(e.geom_m, p.geom_m), 1)
FROM {T('geo_events')} e JOIN {T('geo_pipes')} p ON st_dwithin(e.geom_m, p.geom_m, {radius})
WHERE e.event_type = 'main_break'
""")
display(spark.sql(f"SELECT event_id, asset_type, count(*) AS assets, min(distance_m) AS nearest_m, max(distance_m) AS farthest_m FROM {T('geo_break_impact')} GROUP BY ALL ORDER BY event_id, asset_type"))
display(spark.sql(f"""
SELECT i.event_id, i.zone_id, m.customer_class, count(*) AS meters_to_notify FROM {T('geo_break_impact')} i JOIN {T('geo_meter_zone')} m ON m.meter_id = i.asset_id
WHERE i.asset_type = 'meter' GROUP BY ALL ORDER BY event_id, zone_id, customer_class"""))

result = spark.table(T("geo_break_impact")).select("event_id", "asset_type", "asset_id")
truth = spark.table(T("geo_truth_impact"))
impact_diff = result.exceptAll(truth).count() + truth.exceptAll(result).count()
print(f"impact rows {result.count()}, differing from the answer key: {impact_diff}")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Planar meters or geodesic distance?
# MAGIC
# MAGIC The UTM distance above is planar. `ST_DistanceSpheroid` measures on the WGS 84 ellipsoid from the longitude/latitude geometries. Over 260 m the two should agree closely; this compares them for every impacted meter. `ST_Buffer` on the metric column draws the same radius as a polygon you can map.

# COMMAND ----------

compare = spark.sql(f"""
SELECT i.event_id, i.asset_id, i.distance_m AS utm_m, round(st_distancespheroid(e.geom, m.geom), 1) AS spheroid_m
FROM {T('geo_break_impact')} i JOIN {T('geo_events')} e USING (event_id) JOIN {T('geo_meters')} m ON m.meter_id = i.asset_id
WHERE i.asset_type = 'meter'""")
max_gap = compare.selectExpr("max(abs(utm_m - spheroid_m))").first()[0]
display(compare.orderBy("event_id", "utm_m").limit(8))
buffer_check = spark.sql(f"""
WITH buf AS (SELECT event_id, st_buffer(geom_m, {radius}) AS area FROM {T('geo_events')} WHERE event_type = 'main_break'),
inside AS (SELECT buf.event_id, count(*) AS meters_inside_buffer FROM buf JOIN {T('geo_meters')} m ON st_contains(buf.area, m.geom_m) GROUP BY buf.event_id)
SELECT buf.event_id, round(st_area(buf.area) / 1e4, 1) AS buffer_hectares, round(pi() * {radius} * {radius} / 1e4, 1) AS circle_hectares, inside.meters_inside_buffer
FROM buf JOIN inside USING (event_id) ORDER BY buf.event_id""")
display(buffer_check)
print(f"largest gap between UTM and spheroidal distance: {max_gap:.2f} m")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Pattern 4: nearest asset
# MAGIC
# MAGIC There is no k-nearest-neighbor operator in the spatial functions I could find. The pattern is to narrow candidates with `ST_DWithin` (a search radius you choose from the network's density) and then rank by `ST_Distance`, keeping the first. A sensor with no pipe in range keeps no row, which is the right answer for a bad coordinate.
# MAGIC
# MAGIC The same table lines up sensor readings with assets: each sensor's average pressure goes to its pipe, and to its zone, where it can be compared with the zone's target.

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE TABLE {T('geo_sensor_pipe')} AS
SELECT sensor_id, pipe_id, distance_m FROM (
  SELECT s.sensor_id, p.pipe_id, round(st_distance(s.geom_m, p.geom_m), 1) AS distance_m,
         row_number() OVER (PARTITION BY s.sensor_id ORDER BY st_distance(s.geom_m, p.geom_m)) AS rank
  FROM {T('geo_sensors')} s JOIN {T('geo_pipes')} p ON st_dwithin(s.geom_m, p.geom_m, 100))
WHERE rank = 1
""")
spark.sql(f"""
CREATE OR REPLACE TABLE {T('geo_pipe_pressure')} AS
SELECT sp.pipe_id, sp.sensor_id, z.zone_id, z.target_psi, round(avg(r.pressure_psi), 1) AS avg_psi, round(avg(r.pressure_psi) - z.target_psi, 1) AS vs_target_psi, sp.distance_m
FROM {T('geo_sensor_pipe')} sp JOIN {T('geo_sensors')} s USING (sensor_id)
JOIN {T('geo_sensor_readings')} r USING (sensor_id)
LEFT JOIN {T('geo_zones')} z ON st_contains(z.geom, s.geom)
GROUP BY sp.pipe_id, sp.sensor_id, z.zone_id, z.target_psi, sp.distance_m
""")
display(spark.sql(f"SELECT * FROM {T('geo_pipe_pressure')} ORDER BY vs_target_psi"))
nearest_wrong = spark.sql(f"SELECT count(*) FROM {T('geo_truth_nearest')} t LEFT JOIN {T('geo_sensor_pipe')} r USING (sensor_id) WHERE NOT (r.pipe_id <=> t.expected_pipe)").first()[0]
print(f"sensors matched {spark.table(T('geo_sensor_pipe')).count()} of {spark.table(T('geo_sensors')).count()}; wrong pipe: {nearest_wrong}")

# COMMAND ----------

meters_in_range = spark.table(T("geo_break_impact")).where("asset_type = 'meter'").count()
g.write_results(spark, T("geo_results"), "joins", [
    ("meters", meter_rows, ""),
    ("meters_outside_every_zone", outside, "left join keeps them with a null zone"),
    ("zone_membership_wrong", wrong_zone, "ST_Contains against the answer key"),
    ("zone_membership_duplicates", dup, "a meter in two zones would show twice"),
    ("pairs_without_prefilter", naive_pairs, "meters x zones"),
    ("pairs_with_h3_cover", candidates, "meter and zone-cell pairs that share a cell"),
    ("prefilter_differs_from_exact", differs, "rows that differ between H3 cover + ST_Contains and ST_Contains alone"),
    ("polyfill_only_wrong_zone", center_only, "meters given a zone by H3 cell center alone that ST_Contains does not give"),
    ("polyfill_only_missed", center_missed, "meters ST_Contains places in a zone that cell-center polyfill misses"),
    ("impact_radius_m", radius, ""),
    ("impact_meters", meters_in_range, "meters within the radius of a break, all breaks"),
    ("impact_rows_differ_from_key", impact_diff, "meters and pipes within the radius against the answer key"),
    ("utm_vs_spheroid_max_gap_m", max_gap, "ST_Distance on UTM against ST_DistanceSpheroid, impacted meters"),
    ("sensors_matched", spark.table(T("geo_sensor_pipe")).count(), "of 12"),
    ("nearest_pipe_wrong", nearest_wrong, "against the answer key"),
], params["run_id"])
