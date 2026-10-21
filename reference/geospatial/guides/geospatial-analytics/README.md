# Geospatial analytics

## Overview

A folder of notebooks works through eight repeatable patterns for spatial data on a fictional water network: four pressure zones (polygons), 108 mains (linestrings), 484 meters (points), three main breaks, 165 low-pressure complaints, 12 pressure sensors, and three inspection-report PDFs. The patterns fit any asset network. Every spatial join is scored against an answer key that `01_land_gis_data` computes with plain Python geometry. The same notebooks run as one serverless job; job key: `capability_guides_geospatial`.

All data is synthetic. The network is generated from fixed formulas in `src/geo_lib.py` and laid out in UTM zone 10N, then converted to longitude and latitude so the files look like a GIS export. The inspection PDFs are rendered at run time with fpdf2.

| # | Pattern | Notebook |
|---|---|---|
| 1 | Ingest and normalize GIS formats and SRIDs | `02_load_geometries` |
| 2 | Point-in-polygon membership | `03_spatial_joins` |
| 3 | Proximity and buffer impact | `03_spatial_joins` |
| 4 | Nearest neighbor | `03_spatial_joins` |
| 5 | H3 prefilter, then exact predicate | `03_spatial_joins` |
| 6 | H3 aggregation for heat maps | `04_h3_heat_map` |
| 7 | Join documents to assets | `05_inspection_documents` |
| 8 | Map and export (plus governance) | `06_govern_and_export` and the dashboard |

## Run it

- **By hand:** open the `guides/geospatial-analytics` folder, read `00_start_here`, then Run all in `01_land_gis_data` and each notebook after it. Everything runs on serverless notebook compute. Widgets fill from the deployed job.
- **As a job:** run `capability-guides-geospatial`, or Quick run in the app. Steps 3 to 5 run in parallel.
- **Dashboard:** the bundle also deploys the AI/BI dashboard `Capability guides water network map`, with two point maps, a bar chart, and a table. It reads tables the job writes, so run the job first.
- **Safe to rerun, in any mix:** every table is replaced, never appended; each step swaps its own rows in `geo_results`; the `gis/`, `reports/`, and `exports/` folders in the `geo_files` volume are cleared and rewritten; step 1 creates the schema and volume if they are missing.

## Reference run

Results from one run in the reference workspace, on serverless job compute. They show the setup works. The network is small, so nothing here is a timing.

| Step | Functions | Result in the reference run |
|---|---|---|
| Load | `ST_GeomFromGeoJSON`, `ST_GeomFromText`, `ST_Point`, `ST_Transform`, `ST_IsValid`, `ST_EstimateSRID` | 4 zones, 108 pipes, 484 meters, 168 events, 12 sensors loaded; 0 invalid geometries; 1 SRID per table. |
| Containers | `ST_GeomFromWKB` after GDAL (`pyogrio`) | GeoPackage, Shapefile, and KML all read back with 4 zones equal to the GeoJSON load. |
| Membership | `ST_Contains` | 400 of 484 meters in a zone (100 per zone), 84 outside every zone, 0 wrong against the key, 0 duplicates. |
| H3 prefilter | `H3_CoverAsH3`, then `ST_Contains` | 576 pairs tested instead of 1,936, and the same rows as the exact join. Cell-center polyfill alone put 42 meters in a wrong zone and missed 20. |
| Break impact | `ST_DWithin` on EPSG:32610, `ST_Distance`, `ST_Buffer`, `H3_KRing` | 17 meters and 9 pipes within 260 m of the three breaks (6, 6, and 5 meters), 0 differences from the key. The buffer polygon holds the same meters. The UTM distance and `ST_DistanceSpheroid` differ by at most 0.1 m. |
| Nearest | `ST_DWithin`, `ST_Distance` | 12 of 12 sensors matched to the right pipe. Eight average below their zone's target pressure, four of them by more than 5 psi. |
| Heat map | `H3_ToParent`, `H3_KRing`, `H3_CenterAsWKT` | 165 complaints in 19 resolution-8 cells; all 3 planted clusters found. |
| Documents | `ai_parse_document`, `ai_extract` | 3 of 3 PDFs parsed; asset ID, condition, and date correct on all 3; all matched to a pipe. The Poor-condition pipe is 100 m from the first break. |
| Govern and export | Row filter, `ST_AsGeoJSON`, `ST_AsText` | 17 impacted meters exported as CSV (WKT) and GeoJSON. With the filter, the running user sees 200 of 400 meters, in one of two districts. |

### What the reference run taught

- **GEOMETRY cannot be grouped.** `GROUP BY` on a GEOMETRY column fails with `GROUP_EXPRESSION_TYPE_IS_NOT_ORDERABLE`. Group by an ID or an H3 cell, and compute areas in a CTE.
- **The predicates took GEOMETRY, not GEOGRAPHY.** On the warehouse, `ST_Contains`, `ST_Distance`, and `ST_Buffer` rejected a GEOGRAPHY argument and asked for GEOMETRY. GEOGRAPHY is Public Preview.
- **`ST_DWithin` is planar.** It measures in the units of the coordinates, which are degrees on SRID 4326. Run it on a projected column.
- **A row filter parameter can be shadowed.** The first run named the parameter `district`. Inside the `EXISTS` subquery that resolved to the access table's own `district` column, the test was always true, and all 400 meters showed. Renaming the parameter to `row_district` gave 200.
- **H3 `LATERAL VIEW explode(...) JOIN` does not parse.** Explode in a subquery, then join.
- **GDAL writes to local disk.** Writing a GeoPackage straight to the volume path failed with a SQLite error, and the Shapefile read back empty. Writing in a temp folder and copying to the volume worked.
- **Polyfill is not a prefilter.** `H3_PolyfillAsH3` returns cells whose center is inside the polygon. Use `H3_CoverAsH3` to prefilter.
- **A count against the answer key found a near-tie.** One meter sat 0.04 m from the 250 m radius, so the radius moved to 260 m. Keep test points away from thresholds.

## Not covered

- Photos were not run. `ai_query` accepts JPEG or PNG through its `files` argument, but which model reads a pipe photo well is not tested here.
- Time and scale. The tables hold hundreds of rows, so the H3 prefilter and liquid clustering are described, not timed.
- Sedona and GeoPandas were not run.
