# Databricks notebook source
# MAGIC %md
# MAGIC # Geospatial analytics on a water network
# MAGIC
# MAGIC This guide works through eight repeatable patterns for spatial data on Databricks, using a fictional water network as the running example: four pressure zones (polygons), 108 mains (linestrings), 484 meters (points), three main breaks, 165 low-pressure complaints, 12 pressure sensors, and three inspection-report PDFs. The patterns apply to any asset network, such as roads, lighting, or retail sites.
# MAGIC
# MAGIC Nothing here is real utility data. The network is generated from fixed formulas, and the answer key (`geo_truth_*`) is computed with plain Python geometry so each spatial join is scored against an independent result.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | Patterns | What it does |
# MAGIC |---|---|---|
# MAGIC | `01_land_gis_data` | | Writes a GeoJSON zone file, WKT and lon/lat CSVs, and three inspection PDFs to the `geo_files` volume, plus the answer key. |
# MAGIC | `02_load_geometries` | 1. Ingest and normalize | `ST_GeomFromGeoJSON`, `ST_GeomFromText`, `ST_Point`, `ST_Transform` to EPSG:32610, validity and SRID checks, liquid clustering on an H3 cell, and a GDAL round trip for GeoPackage, Shapefile, and KML. |
# MAGIC | `03_spatial_joins` | 2, 3, 4, 5 | `ST_Contains` membership, `ST_DWithin` and `ST_Buffer` impact around breaks, nearest pipe per sensor, and the H3 prefilter against exact predicates. |
# MAGIC | `04_h3_heat_map` | 6. H3 aggregation | Complaints per resolution-8 cell, a rate per meter, and a neighbor-smoothed count. |
# MAGIC | `05_inspection_documents` | 7. Documents next to geometry | `ai_parse_document` and `ai_extract` over the PDFs, joined to the pipe geometry. |
# MAGIC | `06_govern_and_export` | 8. Export, plus governance | CSV (WKT) and GeoJSON for QGIS or Esri, a district row filter, and a read of the grants. |
# MAGIC
# MAGIC Pattern 8's map half is the AI/BI dashboard `Capability guides water network map`, which reads the tables from steps 3 to 5.
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC **By hand, in this folder:** open `01_land_gis_data`, Run all, then open the others in order and Run all in each. Everything runs on serverless notebook compute. The widgets fill themselves from the deployed job, so nothing needs editing.
# MAGIC
# MAGIC **As a job:** run `capability-guides-geospatial` (or **Quick run** in the app). Steps 3 to 5 run in parallel.
# MAGIC
# MAGIC **Safe to rerun, in any mix.** Every table is replaced, never appended. The step's rows in `geo_results` are swapped. The `gis/`, `reports/`, and `exports/` folders in the volume are cleared and rewritten.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables and the `geo_files` volume. |
# MAGIC | `radius_m` | Meters around a main break that count as impacted. Default 260. |
# MAGIC | `warehouse_id` | Bundle variable: the SQL warehouse behind the dashboard. |
# MAGIC | `run_id` | Set by the job on steps 2 to 6. Defaults to `manual` when run by hand. |

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_geospatial"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')
catalog, schema = params["catalog"], params["schema"]
tables = {
    "Inputs": ["geo_zones", "geo_pipes", "geo_meters", "geo_events", "geo_sensors", "geo_sensor_readings"],
    "Answer key": ["geo_truth_meter_zone", "geo_truth_impact", "geo_truth_nearest", "geo_truth_reports", "geo_truth_hotspots"],
    "Results": ["geo_meter_zone", "geo_zone_cells", "geo_break_impact", "geo_sensor_pipe", "geo_pipe_pressure", "geo_complaint_cells",
                "geo_reports_parsed", "geo_reports_extracted", "geo_inspected_assets", "geo_meters_governed", "geo_results"],
}
for group, names in tables.items():
    links.append(f"<li>{group}: " + ", ".join(f'<a href="{host}/explore/data/{catalog}/{schema}/{n}">{n}</a>' for n in names) + "</li>")
links.append(f'<li>Files: <a href="{host}/explore/data/volumes/{catalog}/{schema}/geo_files">geo_files volume</a> (gis/, reports/, exports/)</li>')
no_job = "" if any("Job <b>" in link for link in links) else f"<p>No deployed job is tagged {JOB_KEY}. Deploy the bundle to run it as a job; the notebooks still run by hand.</p>"
displayHTML(no_job + "<ul>" + "".join(links) + "</ul>")
