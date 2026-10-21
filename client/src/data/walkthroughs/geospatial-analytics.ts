import type { Walkthrough } from './types.ts';

const DOCS = 'https://docs.databricks.com/aws/en';

export const walkthrough: Walkthrough = {
  slug: 'geospatial-analytics',
  area: 'General Guides',
  title: 'Geospatial analytics',
  intro:
    'Utilities, transportation agencies, and retail teams all ask the same where-questions of an asset network: which meters sit in this zone, what is near this break, which pipe is closest to this sensor, where do complaints cluster. Databricks answers them with native GEOMETRY values, ST_ functions, and H3 cells in SQL. This guide is eight patterns, each with when to use it, how it works, best practices, and a short example. A fictional water network runs through all of them.',
  businessValue: {
    summary:
      'Utility and public-sector teams can answer where-questions from governed tables: which customers sit in a pressure zone, who a main break affects, where complaints cluster. Eight repeatable patterns, shown on a synthetic water network.',
    outcomes: [
      {
        title: 'Faster outage notification',
        body: 'One buffer join lists every meter within a set distance of a break, with its zone and customer class. Crews and communications teams work from the same list instead of a map export.',
      },
      {
        title: 'One governed copy of GIS data',
        body: 'Zones, pipes, and meters load into Delta tables under Unity Catalog. Grants and district row filters apply to geometry like any other column, and no separate spatial server holds a second copy.',
      },
      {
        title: 'Inspection reports tied to assets',
        body: 'Inspection PDFs are parsed, the asset ID and condition are extracted, and both join to the pipe geometry. A Poor rating then shows its zone and nearest break without anyone retyping it.',
      },
      {
        title: 'Maps for analysts and GIS staff',
        body: 'An H3 count gives a complaint heat map from one grouped query, and an AI/BI dashboard draws it. GIS staff open GeoJSON or WKT exports in QGIS or Esri.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Store GEOMETRY, keep a metric copy.',
      body: 'GEOMETRY is generally available and every ST_ predicate here takes it. Keep the interchange column in SRID 4326 and a second column in a projected SRID for distances and buffers.',
    },
    {
      title: 'Check SRID and validity on every load.',
      body: 'Mixed SRIDs raise errors, but an invalid polygon can quietly drop rows from a join. Count both after each load.',
    },
    {
      title: 'H3 prefilters; ST_ decides.',
      body: 'Join on a cover of H3 cells to shrink the pair count, then run the exact predicate on what survives. H3 alone misplaces points near edges.',
    },
    {
      title: 'Aggregate with H3, not polygons.',
      body: 'A GROUP BY on a cell ID is the cheapest spatial aggregation and gives a small table a dashboard can map.',
    },
    {
      title: 'Documents join on an ID.',
      body: 'ai_parse_document and ai_extract turn inspection PDFs into columns. A normal join on the asset ID attaches the geometry.',
    },
    {
      title: 'Govern like any table.',
      body: 'Grant on the table, filter rows by district, and put files in a Unity Catalog volume. Shapefile, GeoPackage, and KML have no built-in reader; convert them with GDAL.',
    },
  ],
  sections: [
    {
      id: 'patterns',
      heading: 'Eight patterns, one network',
      prose:
        'The reference job builds a fictional water network from fixed formulas: four pressure zones, 108 mains, 484 meters, three main breaks, 165 low-pressure complaints, 12 pressure sensors, and three inspection PDFs. Each pattern below is scored against an answer key computed with plain Python geometry. The same patterns fit any asset network: roads and signs, street lights, parcels, retail sites.',
      diagram: {
        type: 'flow',
        title: 'From GIS files to answers',
        description:
          'GIS files, event and sensor CSVs, and inspection PDFs sit in a Unity Catalog volume. A load step writes GEOMETRY tables in Delta. Four analysis steps run on those tables: spatial joins, an H3 heat map, a document join, and governance. Their outputs are an AI/BI map dashboard, GIS exports, and governed tables.',
        lanes: [
          { label: 'Volume', fromRow: 0, toRow: 0 },
          { label: 'Delta in Unity Catalog', fromRow: 1, toRow: 2 },
          { label: 'Outputs', fromRow: 3, toRow: 3 },
        ],
        nodes: [
          { id: 'gis', label: 'GIS files', sub: 'GeoJSON, WKT, CSV', col: 0, row: 0, kind: 'store' },
          { id: 'events', label: 'Events, sensors', sub: 'lon and lat CSVs', col: 1, row: 0, kind: 'store' },
          { id: 'pdfs', label: 'Inspection PDFs', sub: 'reports', col: 2, row: 0, kind: 'store' },
          { id: 'geom', label: 'GEOMETRY tables', sub: 'SRID 4326 + metric copy', col: 0, row: 1, kind: 'highlight' },
          { id: 'docs', label: 'Parsed reports', sub: 'asset ID, condition', col: 2, row: 1 },
          { id: 'joins', label: 'Spatial joins', sub: 'ST_Contains, ST_DWithin', col: 0, row: 2 },
          { id: 'h3', label: 'H3 heat map', sub: 'count per cell', col: 1, row: 2 },
          { id: 'assets', label: 'Inspected assets', sub: 'report + geometry', col: 2, row: 2 },
          { id: 'dash', label: 'AI/BI map', kind: 'surface', col: 0, row: 3 },
          { id: 'export', label: 'GIS export', sub: 'GeoJSON, WKT CSV', kind: 'surface', col: 1, row: 3 },
          { id: 'gov', label: 'Row filter', sub: 'by district', kind: 'gate', col: 2, row: 3 },
        ],
        edges: [
          { from: 'gis', to: 'geom' },
          { from: 'events', to: 'geom' },
          { from: 'pdfs', to: 'docs' },
          { from: 'geom', to: 'joins' },
          { from: 'geom', to: 'h3' },
          { from: 'docs', to: 'assets' },
          { from: 'geom', to: 'assets', dashed: true },
          { from: 'joins', to: 'dash' },
          { from: 'h3', to: 'dash' },
          { from: 'joins', to: 'export' },
          { from: 'assets', to: 'gov' },
        ],
        legend: [
          { kind: 'store', label: 'Files in the volume' },
          { kind: 'highlight', label: 'Native spatial types' },
          { kind: 'gate', label: 'Access control' },
        ],
      },
      points: [
        {
          strong: '1. Ingest and normalize.',
          text: 'GeoJSON, WKT, and lon/lat columns into GEOMETRY, one SRID, one metric copy.',
        },
        { strong: '2. Point-in-polygon membership.', text: 'Which zone is each meter in.' },
        { strong: '3. Proximity and buffer impact.', text: 'Which assets are within N meters of an event.' },
        { strong: '4. Nearest neighbor.', text: 'Which pipe is each sensor on.' },
        { strong: '5. H3 prefilter, then exact.', text: 'Fewer pairs to test, same answer.' },
        { strong: '6. H3 aggregation.', text: 'Counts per cell for a heat map.' },
        { strong: '7. Documents next to geometry.', text: 'Inspection PDFs parsed and joined to assets.' },
        { strong: '8. Map and export.', text: 'AI/BI point maps, notebooks, and files for QGIS or Esri.' },
      ],
    },
    {
      id: 'types',
      heading: 'Native types, and what runs where',
      prose:
        'GEOMETRY(srid) stores planar coordinates in any of about 11,000 supported SRIDs. GEOGRAPHY stores longitude and latitude on the 4326 datum only. Both are Delta column types, so they sit in ordinary tables under Unity Catalog. A column cannot be grouped or used as a dimension in a metric view or a Lakeflow Spark Declarative Pipelines materialized view, so group by an ID or an H3 cell instead.',
      table: {
        caption: 'Release stage and support, from the docs and the reference run',
        columns: ['Item', 'Status'],
        rows: [
          [
            'GEOMETRY type and its ST_ functions',
            'Generally available. Databricks Runtime 17.1 and above, and Databricks SQL (not classic SQL warehouses).',
          ],
          ['GEOGRAPHY type and its ST_ functions', 'Public Preview. SRID 4326 only.'],
          [
            'H3 functions',
            'Databricks Runtime 17.0 and above on every compute type except classic SQL warehouses, including non-Photon clusters.',
          ],
          [
            'Serverless notebook and job compute',
            'Ran every ST_ and H3 function in the reference job, plus ai_parse_document and ai_extract.',
          ],
          [
            'SQL warehouse',
            'Ran the ST_ and H3 functions spot-checked (ST_Contains, ST_Intersects, ST_DWithin, ST_Transform, ST_Buffer, ST_GeomFromGeoJSON, ST_DistanceSpheroid, H3 indexing and covers), plus ALTER TABLE ... SET ROW FILTER and CLUSTER BY.',
          ],
          [
            'GEOGRAPHY arguments',
            'In the reference workspace, ST_Contains, ST_Distance, and ST_Buffer rejected a GEOGRAPHY argument and asked for GEOMETRY. ST_GeogFromText and the format converters accepted it.',
          ],
        ],
      },
      options: {
        caption: 'GEOMETRY or GEOGRAPHY',
        rows: [
          {
            option: 'GEOMETRY(4326) plus a projected copy',
            when: 'Almost always. Zones, pipes, parcels, and points that join, buffer, or measure.',
            tradeoffs:
              'Generally available, and the ST_ predicates and measures take it. Distances are planar in the unit of the SRID, so measure in a projected SRID. Needs one extra column.',
          },
          {
            option: 'GEOGRAPHY(4326)',
            when: 'Global data where a flat projection distorts badly, and you only convert, store, and export.',
            tradeoffs:
              'Public Preview. The docs say the ST_ functions accept GEOGRAPHY or GEOMETRY, but the predicates and measures this guide uses rejected GEOGRAPHY in the reference workspace. Check the function you need before you commit a column to it.',
          },
        ],
        recommendation:
          'Store GEOMETRY(4326) for interchange and add a projected GEOMETRY column for metric work. This is practical guidance based on what ran, not a docs rule.',
      },
      links: [
        { label: 'GEOMETRY type', url: `${DOCS}/sql/language-manual/data-types/geometry-type` },
        { label: 'GEOGRAPHY type', url: `${DOCS}/sql/language-manual/data-types/geography-type` },
        { label: 'ST geospatial functions', url: `${DOCS}/sql/language-manual/sql-ref-st-geospatial-functions` },
        { label: 'H3 geospatial functions', url: `${DOCS}/sql/language-manual/sql-ref-h3-geospatial-functions` },
        {
          label: 'Tutorial: geospatial pipeline with native spatial types',
          url: `${DOCS}/ldp/tutorial-spatial-pipelines`,
        },
      ],
    },
    {
      id: 'native-vs-libraries',
      heading: 'Native functions or a spatial library',
      prose:
        'The docs describe the native types and functions but do not compare them with Apache Sedona or GeoPandas. The table is practical guidance, and this guide did not run either library.',
      options: {
        caption: 'Where each tool fits',
        rows: [
          {
            option: 'Native GEOMETRY and ST_ functions',
            when: 'Joins, buffers, areas, distances, and format conversion over table-sized data, in SQL or a pipeline.',
            tradeoffs:
              'Nothing to install, runs on serverless and SQL warehouses, governed as a table column. Covers the functions listed in the docs and no more; raster and network analysis are outside it.',
          },
          {
            option: 'A library such as Sedona or GeoPandas',
            when: 'An operation the native list does not have, a format reader you need, or a team that already has code in that library.',
            tradeoffs:
              'More functions and readers. You manage the install and version, usually need classic or custom environments, and move data between the library type and a Delta column. GeoPandas runs on one machine.',
          },
        ],
        recommendation:
          'Start native, since it removes the install and keeps geometry in Delta. Reach for a library for a specific gap, and write the result back to a native column. Shapefile, GeoPackage, and KML are the common gap; this guide fills it with GDAL through pyogrio.',
      },
    },
    {
      id: 'ingest',
      heading: 'Pattern 1: ingest and normalize GIS formats',
      points: [
        {
          strong: 'When to use it.',
          text: 'At the start of every project, and each time a new layer arrives. A bad SRID or an invalid polygon here becomes a wrong answer in every later join.',
        },
        {
          strong: 'How it works.',
          text: 'Match the constructor to the source: ST_GeomFromGeoJSON (always SRID 4326), ST_GeomFromText for WKT, ST_GeomFromWKB, and ST_Point(lon, lat, 4326) for coordinate columns. Add a projected copy with ST_Transform.',
        },
        {
          strong: 'Best practice: one interchange SRID.',
          text: 'Store 4326 as the shared form. Use ST_EstimateSRID to pick a projected SRID for the area, then keep that as a second column. ST_Contains and ST_DWithin require both inputs in the same SRID.',
        },
        {
          strong: 'Best practice: check after every load.',
          text: 'Count ST_IsValid failures, empty geometries, and distinct SRIDs per table. Mixed SRIDs error out, but an invalid ring does not always fail loudly.',
        },
        {
          strong: 'Best practice: land files in a volume.',
          text: 'Put raw files in a Unity Catalog volume, load them to Delta, and keep the volume copy as the source of record.',
        },
        {
          strong: 'Shapefile, GeoPackage, KML.',
          text: 'read_files lists no reader for these. Let GDAL (here pyogrio) decode them to WKB, then ST_GeomFromWKB. In the reference run all three formats read back with the four zones equal to the GeoJSON load. Write and read them on local disk and copy the files to the volume afterward: GeoPackage and Shapefile failed when written straight to the volume path.',
        },
      ],
      examples: [
        {
          label: 'GeoJSON, WKT, and lon/lat into GEOMETRY',
          language: 'sql',
          code: `-- GeoJSON FeatureCollection: one file, one row per feature
SELECT f:properties:zone_id::STRING AS zone_id,
       st_geomfromgeojson(f:geometry::STRING) AS geom            -- GEOMETRY(4326)
FROM (SELECT explode(cast(parse_json(value):features AS ARRAY<VARIANT>)) AS f
      FROM read_files('/Volumes/main/gis/files/zones.geojson', format => 'text', wholeText => true));

-- WKT column, then a point from coordinates, then a metric copy
SELECT st_geomfromtext(geometry_wkt, 4326) AS geom FROM read_files('/Volumes/main/gis/files/pipes.csv', format => 'csv', header => true);
SELECT st_point(longitude, latitude, 4326) AS geom, h3_longlatash3(longitude, latitude, 9) AS h3_r9 FROM meters_raw;
SELECT st_transform(geom, 32610) AS geom_m FROM meters;           -- UTM zone 10N, meters`,
          notes: [
            'The reference job wraps this with ST_IsValid, ST_SRID, and ST_IsEmpty counts per table.',
            'Point tables also carry an H3 cell and use CLUSTER BY on it.',
          ],
        },
      ],
      links: [
        { label: 'ST_GeomFromGeoJSON', url: `${DOCS}/sql/language-manual/functions/st_geomfromgeojson` },
        { label: 'ST_GeomFromWKB', url: `${DOCS}/sql/language-manual/functions/st_geomfromwkb` },
        { label: 'ST_Transform', url: `${DOCS}/sql/language-manual/functions/st_transform` },
        {
          label: 'read_files',
          url: `${DOCS}/sql/language-manual/functions/read_files`,
          note: 'Lists the supported file formats.',
        },
        { label: 'Unity Catalog volumes', url: `${DOCS}/volumes/` },
      ],
    },
    {
      id: 'membership',
      heading: 'Pattern 2: point-in-polygon membership',
      points: [
        {
          strong: 'When to use it.',
          text: 'Assigning customers to pressure zones, incidents to districts, or sites to sales territories.',
        },
        {
          strong: 'How it works.',
          text: 'Join on ST_Contains(polygon, point). Use a left join so a point outside every polygon keeps a row with a null zone and shows up in the count.',
        },
        {
          strong: 'Best practice: know the edge rule.',
          text: 'ST_Contains follows the DE-9IM definition, so a point exactly on the polygon boundary is not contained; ST_Covers includes it (checked on a warehouse). Pipes are lines, so a main that crosses a zone line intersects two zones; use ST_Intersects for lines and keep the rule you chose.',
        },
        {
          strong: 'Best practice: test for duplicates.',
          text: 'Overlapping polygons give a point two rows. Count rows against distinct IDs after the join.',
        },
      ],
      examples: [
        {
          label: 'Meters to zones',
          language: 'sql',
          code: `SELECT m.meter_id, z.zone_id, z.district
FROM meters m LEFT JOIN zones z ON st_contains(z.geom, m.geom);`,
        },
      ],
      links: [
        { label: 'ST_Contains', url: `${DOCS}/sql/language-manual/functions/st_contains` },
        { label: 'ST_Intersects', url: `${DOCS}/sql/language-manual/functions/st_intersects` },
      ],
    },
    {
      id: 'proximity',
      heading: 'Pattern 3: proximity and buffer impact',
      points: [
        {
          strong: 'When to use it.',
          text: 'Notifying customers near a main break, listing assets inside a work zone, or finding sites within a service radius.',
        },
        {
          strong: 'How it works.',
          text: 'ST_DWithin(a, b, distance) is true when the planar distance is at or under the threshold, in the unit of the coordinates. On 4326 that unit is degrees, so run it on the projected column. ST_Buffer on the projected point draws the same radius as a polygon you can map.',
        },
        {
          strong: 'Best practice: measure in meters.',
          text: 'Transform once, store the metric column, and reuse it. For lines, ST_DWithin tests the whole linestring: a main counts if any part is inside the radius.',
        },
        {
          strong: 'Best practice: prefilter large joins.',
          text: 'Add H3 cells around the event (H3_KRing) so the join starts from an equality on the cell. See pattern 5.',
        },
      ],
      options: {
        caption: 'Projected SRID or geodesic distance',
        rows: [
          {
            option: 'Projected SRID (UTM, state plane)',
            when: 'A service area that fits one projection zone: a city, a county, a utility territory.',
            tradeoffs:
              'ST_DWithin, ST_Distance, ST_Buffer, and ST_Area work directly, and they are indexable by prefilter. Distances distort away from the projection center. In the reference run the gap to the spheroidal distance was 0.1 m over 260 m.',
          },
          {
            option: 'Geodesic: ST_DistanceSpheroid or ST_DistanceSphere',
            when: 'Point-to-point distance over a long span or across projection zones.',
            tradeoffs:
              'Measures on the ellipsoid or sphere from 4326 values, in meters, with no projection to choose. The docs describe these for point GEOMETRY inputs, so they do not measure to a line or polygon, and there is no matching ST_DWithin.',
          },
        ],
        recommendation:
          'Use a projected SRID for the join and the buffer. Use the geodesic functions to check a few results or for long point-to-point distances. Pick the projection with ST_EstimateSRID.',
      },
      examples: [
        {
          label: 'Meters and pipes within 260 m of a break',
          language: 'sql',
          code: `SELECT e.event_id, m.meter_id, round(st_distance(e.geom_m, m.geom_m), 1) AS distance_m
FROM events e JOIN meters m ON st_dwithin(e.geom_m, m.geom_m, 260)
WHERE e.event_type = 'main_break';

-- the same radius as a polygon for a map layer
SELECT event_id, st_buffer(geom_m, 260) AS impact_area FROM events WHERE event_type = 'main_break';`,
          notes: ['Neither ST_Buffer nor ST_Distance accepted a GEOGRAPHY argument in the reference workspace.'],
        },
      ],
      links: [
        { label: 'ST_DWithin', url: `${DOCS}/sql/language-manual/functions/st_dwithin` },
        { label: 'ST_Distance', url: `${DOCS}/sql/language-manual/functions/st_distance` },
        { label: 'ST_Buffer', url: `${DOCS}/sql/language-manual/functions/st_buffer` },
        { label: 'ST_DistanceSpheroid', url: `${DOCS}/sql/language-manual/functions/st_distancespheroid` },
      ],
    },
    {
      id: 'nearest',
      heading: 'Pattern 4: nearest neighbor',
      points: [
        {
          strong: 'When to use it.',
          text: 'Snapping a sensor, work order, or complaint to the closest pipe, hydrant, or station; lining up readings with assets.',
        },
        {
          strong: 'How it works.',
          text: 'The ST_ function list has no k-nearest-neighbor operator. Narrow candidates with ST_DWithin at a search radius you choose, rank them by ST_Distance with row_number(), and keep rank 1.',
        },
        {
          strong: 'Best practice: choose the radius from the network.',
          text: 'Too small and sensors with a bad coordinate drop out, which is a useful signal. Too large and the join grows. Report how many inputs found no match.',
        },
        {
          strong: 'Best practice: line up readings after the match.',
          text: 'Join readings to the matched asset, then compare to the zone target. The reference run shows how far the average pressure at each sensor sits from the target for its zone.',
        },
      ],
      examples: [
        {
          label: 'Nearest pipe for each sensor',
          language: 'sql',
          code: `SELECT sensor_id, pipe_id, distance_m FROM (
  SELECT s.sensor_id, p.pipe_id, round(st_distance(s.geom_m, p.geom_m), 1) AS distance_m,
         row_number() OVER (PARTITION BY s.sensor_id ORDER BY st_distance(s.geom_m, p.geom_m)) AS rank
  FROM sensors s JOIN pipes p ON st_dwithin(s.geom_m, p.geom_m, 100))
WHERE rank = 1;`,
        },
      ],
      links: [
        {
          label: 'ST geospatial functions (includes ST_ClosestPoint)',
          url: `${DOCS}/sql/language-manual/sql-ref-st-geospatial-functions`,
        },
      ],
    },
    {
      id: 'h3-prefilter',
      heading: 'Pattern 5: H3 prefilter, then exact',
      points: [
        {
          strong: 'When to use it.',
          text: 'A join between large tables where most pairs are obviously far apart, such as millions of meters against thousands of zones or parcels.',
        },
        {
          strong: 'How it works.',
          text: 'Cover each polygon once with H3_CoverAsH3, which returns every cell that touches it. Join points to those cells on the cell ID (an equality join), then run ST_Contains on the pairs that remain.',
        },
        {
          strong: 'Best practice: cover, do not polyfill, for a prefilter.',
          text: 'H3_PolyfillAsH3 returns only cells whose center is inside the polygon, so it misses points near an edge. In the reference run it left 20 meters out of their zone and put 42 in a wrong one.',
        },
        {
          strong: 'Best practice: pick the resolution by edge length.',
          text: 'Resolution 9 has an edge near 175 m, about a city block. Finer cells mean more rows per polygon and fewer false pairs. Test two resolutions on your data.',
        },
      ],
      diagram: {
        type: 'flow',
        title: 'H3 narrows the pairs, ST_ decides',
        description:
          'Zones are covered with H3 cells once. Meters carry an H3 cell. Joining on the cell ID gives candidate pairs. ST_Contains runs only on the candidates and produces the final zone membership.',
        nodes: [
          { id: 'zones', label: 'Zones', sub: 'polygons', col: 0, row: 0, kind: 'store' },
          { id: 'cover', label: 'H3 cover', sub: 'cells that touch a zone', col: 1, row: 0 },
          { id: 'meters', label: 'Meters', sub: 'point + H3 cell', col: 0, row: 1, kind: 'store' },
          { id: 'cand', label: 'Candidate pairs', sub: 'equal cell ID', col: 1, row: 1, kind: 'highlight' },
          { id: 'exact', label: 'ST_Contains', sub: 'exact test', col: 2, row: 1 },
          { id: 'out', label: 'Zone membership', col: 3, row: 1, kind: 'surface' },
        ],
        edges: [
          { from: 'zones', to: 'cover' },
          { from: 'cover', to: 'cand' },
          { from: 'meters', to: 'cand' },
          { from: 'cand', to: 'exact' },
          { from: 'exact', to: 'out' },
          { from: 'zones', to: 'exact', dashed: true },
        ],
        caption: 'The reference run tested 576 pairs instead of 1,936 and returned the same rows.',
      },
      options: {
        caption: 'Exact predicate, H3 alone, or both',
        rows: [
          {
            option: 'Exact ST_ predicate alone',
            when: 'Small or medium tables, or a one-off analysis.',
            tradeoffs:
              'Exact and simplest to read. Cost grows with both table sizes unless the engine uses its spatial join support; the release notes mention improved spatial join performance. Always correct.',
          },
          {
            option: 'H3 cells alone',
            when: 'Aggregation and heat maps, or when a cell is the answer you want (pattern 6).',
            tradeoffs:
              'Cheapest to compute and an ordinary equality join. Results are cell-shaped, so a point near an edge can land in the wrong zone. With polyfill, 20 meters were missed and 42 misplaced in the reference run.',
          },
          {
            option: 'H3 cover prefilter, then exact predicate',
            when: 'Large joins where you need exact answers.',
            tradeoffs:
              'Exact results and far fewer pairs to test (576 against 1,936 here). Two steps to maintain, and a cell resolution to choose.',
          },
        ],
        recommendation:
          'Start with the exact predicate. Add the H3 cover prefilter when the join is slow, and keep the exact test in it. Use H3 alone only when a cell-level answer is what you want. The speed-up at scale is practical guidance; the reference run is too small to time.',
      },
      examples: [
        {
          label: 'Prefilter with a cover, then test exactly',
          language: 'sql',
          code: `CREATE OR REPLACE TABLE zone_cells AS
SELECT zone_id, explode(h3_coverash3(st_astext(geom), 9)) AS cell FROM zones;

SELECT m.meter_id, z.zone_id
FROM meters m
JOIN zone_cells c ON m.h3_r9 = c.cell
JOIN zones z ON z.zone_id = c.zone_id AND st_contains(z.geom, m.geom);`,
        },
      ],
      links: [
        { label: 'H3_CoverAsH3', url: `${DOCS}/sql/language-manual/functions/h3_coverash3` },
        { label: 'H3_PolyfillAsH3', url: `${DOCS}/sql/language-manual/functions/h3_polyfillash3` },
        { label: 'H3_LongLatAsH3', url: `${DOCS}/sql/language-manual/functions/h3_longlatash3` },
        { label: 'H3_KRing', url: `${DOCS}/sql/language-manual/functions/h3_kring` },
      ],
    },
    {
      id: 'heat-map',
      heading: 'Pattern 6: aggregate events by H3 cell',
      points: [
        {
          strong: 'When to use it.',
          text: 'Complaints, outages, breaks, or calls for service by area; a hotspot view; a rate per meter by neighborhood.',
        },
        {
          strong: 'How it works.',
          text: 'Index each event with H3_LongLatAsH3 (or roll finer cells up with H3_ToParent), GROUP BY the cell, and add the cell center as longitude and latitude for the map. Divide by the meters per cell to get a rate. H3_KRing smooths a count with its neighbors.',
        },
        {
          strong: 'Best practice: choose the resolution for the question.',
          text: 'Resolution 8 (edge near 460 m) suits neighborhood hotspots. Too fine and most cells hold one event.',
        },
        {
          strong: 'Best practice: show rates, not just counts.',
          text: 'A dense district always has more complaints. Complaints per 100 meters shows where service is worse.',
        },
      ],
      examples: [
        {
          label: 'Complaints per cell, with a rate and neighbors',
          language: 'sql',
          code: `WITH complaints AS (
  SELECT h3_toparent(h3_r9, 8) AS cell, count(*) AS complaints
  FROM events WHERE event_type = 'low_pressure_complaint' GROUP BY 1)
SELECT h3_h3tostring(cell) AS cell_hex, complaints,
       st_x(st_geomfromtext(h3_centeraswkt(cell))) AS longitude,
       st_y(st_geomfromtext(h3_centeraswkt(cell))) AS latitude
FROM complaints;`,
          notes: ['The reference job adds meters per cell for the rate and a k-ring sum for smoothing.'],
        },
      ],
      links: [
        { label: 'H3_ToParent', url: `${DOCS}/sql/language-manual/functions/h3_toparent` },
        { label: 'H3 geospatial functions', url: `${DOCS}/sql/language-manual/sql-ref-h3-geospatial-functions` },
      ],
    },
    {
      id: 'documents',
      heading: 'Pattern 7: join documents to assets',
      points: [
        {
          strong: 'When to use it.',
          text: 'Inspection reports, permits, and work orders that name an asset but live in PDFs, and scanned maps that hold information not in the GIS.',
        },
        {
          strong: 'How it works.',
          text: 'Keep the files in a Unity Catalog volume. ai_parse_document reads each one, ai_extract pulls named fields into columns, and a normal join on the extracted asset ID attaches the geometry. Spatial functions then work on the report like any other row.',
        },
        {
          strong: 'Best practice: parse once, store the result.',
          text: 'Write the parsed output and the extracted fields to tables. Count entries in error_status to find failures; a VARIANT null is a value, so doc:error_status IS NULL never matches.',
        },
        {
          strong: 'Best practice: keep unmatched rows.',
          text: 'A report whose ID matches no asset keeps a row with a null pipe, so someone can review it. Score extraction against a labeled sample before trusting it. The reference run had three reports, so it shows the plumbing, not a model accuracy.',
        },
        {
          strong: 'Photos.',
          text: 'ai_query accepts JPEG or PNG input through its files argument on a multimodal endpoint. Which model reads a pipe photo well is something to test on your own labeled photos. A model reading a picture gives you no coordinate; the location comes from the asset ID or the photo metadata. This guide did not run images.',
        },
      ],
      options: {
        caption: 'Parse and extract, or tag by hand',
        rows: [
          {
            option: 'ai_parse_document and ai_extract',
            when: 'Many reports with a similar layout, and fields you can name in a schema.',
            tradeoffs:
              'Scales with a query and writes a table you can join. Billed per call, output can be wrong, and the functions have preview and Geo rules to check. Needs a labeled sample to measure.',
          },
          {
            option: 'Manual tagging',
            when: 'A handful of documents, or fields that need a human decision.',
            tradeoffs:
              'Most accurate for hard cases and costs no inference, but it is slow and does not scale. Practical guidance, not a docs statement.',
          },
        ],
        recommendation:
          'Extract automatically, keep a low-confidence or unmatched queue, and have a person review that queue. The first pass saves the typing; the review keeps the table trustworthy.',
      },
      examples: [
        {
          label: 'Parse, extract, and join to the pipe',
          language: 'sql',
          code: `CREATE OR REPLACE TABLE reports_parsed AS
SELECT path, ai_parse_document(content, map('version', '2.0')) AS doc
FROM read_files('/Volumes/main/gis/files/reports/', format => 'binaryFile', pathGlobFilter => '*.pdf');

-- text = the parsed elements joined into one string; schema = JSON of the fields you want
SELECT r:response:asset_id::STRING AS asset_id, r:response:condition::STRING AS condition
FROM (SELECT ai_extract(text, '{"asset_id": {"type": "string"}, "condition": {"type": "string"}}',
                        map('version', '2.0')) AS r FROM reports_text) x
JOIN pipes p ON p.pipe_id = x.asset_id;`,
        },
      ],
      links: [
        { label: 'ai_parse_document', url: `${DOCS}/sql/language-manual/functions/ai_parse_document` },
        { label: 'ai_extract', url: `${DOCS}/sql/language-manual/functions/ai_extract` },
        { label: 'ai_query (multimodal input)', url: `${DOCS}/sql/language-manual/functions/ai_query` },
      ],
    },
    {
      id: 'visualize',
      heading: 'Pattern 8: map it and export it',
      points: [
        {
          strong: 'When to use it.',
          text: 'Handing results to operations staff (a dashboard), to analysts (a notebook), or to GIS staff (a file or a connection).',
        },
        {
          strong: 'How it works.',
          text: 'AI/BI dashboards have a point map (latitude and longitude columns), a choropleth map (named regions such as countries or states), and a path map. Notebooks can use any mapping library on a pandas result. For QGIS or Esri, write GeoJSON or a CSV with a WKT column to a volume, or connect to a SQL warehouse over ODBC or JDBC.',
        },
        {
          strong: 'Best practice: map a small table.',
          text: 'Aggregate first and map the H3 cell centers, not every raw event. A map of every raw event is slow to draw and hard to read.',
        },
        {
          strong: 'Best practice: put the geometry in two forms.',
          text: 'Give the dashboard plain latitude and longitude columns. Give GIS tools WKT or GeoJSON.',
        },
      ],
      options: {
        caption: 'AI/BI map, notebook library, or GIS export',
        rows: [
          {
            option: 'AI/BI dashboard map',
            when: 'Shared, refreshing views for operations and managers.',
            tradeoffs:
              'Point map and path map take latitude and longitude columns; choropleth colors named administrative areas (country, state, county or district), not your own polygons. It displays results and does not edit geometry. Governed by dashboard and table permissions.',
          },
          {
            option: 'Notebook mapping library',
            when: 'Exploration, custom layers, or a polygon choropleth on your own boundaries.',
            tradeoffs:
              'Full control of layers and styling. The result is a one-off, a library to install, and the data is collected to the driver, so aggregate first. Practical guidance, not a docs statement.',
          },
          {
            option: 'Export to QGIS or Esri',
            when: 'GIS staff who edit, symbolize, or publish layers.',
            tradeoffs:
              'Full GIS tooling. Files go stale, so a warehouse connection is better for a live layer. Shapefile and GeoPackage export is not built in; GeoJSON and WKT are.',
          },
        ],
        recommendation:
          'Use an AI/BI dashboard for the shared view, a notebook for exploration, and an export or warehouse connection for GIS staff. All three read the same governed tables.',
      },
      links: [
        {
          label: 'AI/BI dashboard visualization types',
          url: `${DOCS}/dashboards/visualization-types`,
          note: 'Point map, choropleth map, and path map.',
        },
        { label: 'Map options for notebooks and the SQL editor', url: `${DOCS}/visualizations/maps` },
        { label: 'Connect with ODBC', url: `${DOCS}/integrations/odbc/` },
        { label: 'Connect with JDBC', url: `${DOCS}/integrations/jdbc/` },
      ],
    },
    {
      id: 'performance',
      heading: 'Performance',
      points: [
        {
          strong: 'Cluster on the H3 cell.',
          text: 'Add an H3 cell column to point tables and CLUSTER BY it, so files that hold nearby points sit together. The clustering docs do not mention spatial data; this is practical guidance, and the reference tables were too small to time it.',
        },
        {
          strong: 'Join on the cell first.',
          text: 'An equality join on the cell lets Spark shuffle and sort. Keep the exact predicate on what remains.',
        },
        {
          strong: 'Use the engine improvements.',
          text: 'The release notes list improved spatial join performance (shuffled spatial join) and Photon implementations of ST_IsValid, ST_MakeLine, ST_MakePolygon, ST_Difference, ST_Intersection, and ST_Union.',
        },
        {
          strong: 'Make geometry cheap to carry.',
          text: 'Use ST_Simplify for display layers, and select only the columns a step needs. GEOMETRY columns cannot be grouped, so group by an ID.',
        },
        {
          strong: 'Run on serverless.',
          text: 'Jobs, notebooks, and SQL warehouses ran the whole reference job without cluster setup. Classic SQL warehouses do not support the ST_ or H3 functions.',
        },
      ],
      links: [
        { label: 'Liquid clustering', url: `${DOCS}/delta/clustering` },
        { label: 'Serverless compute release notes', url: `${DOCS}/release-notes/serverless` },
      ],
    },
    {
      id: 'governance',
      heading: 'Governance',
      points: [
        {
          strong: 'Geometry is a column.',
          text: 'Grant USE CATALOG, USE SCHEMA, and SELECT to a group on the tables or the schema. Comments and tags work as for any column.',
        },
        {
          strong: 'Filter rows by district.',
          text: 'A row filter function maps the current user or group to a district. The reference job filters a copy of the meter table so a person sees only the districts mapped to them.',
        },
        {
          strong: 'Name the filter parameter carefully.',
          text: 'Inside a subquery, a bare column name that matches the parameter resolves to the table column, the test is always true, and every row passes. The first reference run did exactly this and showed all 400 meters. Name the parameter something no column uses.',
        },
        {
          strong: 'Files are governed too.',
          text: 'Raw GIS files and inspection PDFs sit in a volume, with grants of their own. Exports to a volume leave Unity Catalog row filters behind, so export only what the reader may see.',
        },
      ],
      examples: [
        {
          label: 'District row filter',
          language: 'sql',
          code: `CREATE FUNCTION geo_district_filter(row_district STRING)
RETURN EXISTS (SELECT 1 FROM geo_district_access a
               WHERE a.user_name = current_user() AND a.district = row_district);

ALTER TABLE meters_governed SET ROW FILTER geo_district_filter ON (district);`,
        },
      ],
      links: [
        { label: 'Row filters and column masks', url: `${DOCS}/data-governance/unity-catalog/filters-and-masks` },
        {
          label: 'Apply a filter or mask to a table',
          url: `${DOCS}/data-governance/unity-catalog/filters-and-masks/manually-apply`,
        },
      ],
    },
  ],
  related: [
    { slug: 'file-format-ingestion', title: 'File format ingestion' },
    { slug: 'ai-functions', title: 'AI Functions in SQL' },
    { slug: 'document-processing', title: 'Document processing' },
    { slug: 'in-platform-visualization', title: 'Charts and dashboards in the platform' },
  ],
};
