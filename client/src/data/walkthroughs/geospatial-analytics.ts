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
      id: 'gis-concepts',
      heading: 'How GIS data is grouped, and where it lands in Unity Catalog',
      prose:
        'GIS tools organize data in a hierarchy that is close to a catalog, a schema, and a table. Keeping that shape in Unity Catalog means GIS staff recognize the layout and data engineers can govern it with the usual grants.',
      table: {
        caption: 'GIS concept to Unity Catalog object (practical mapping, not a docs rule)',
        columns: ['GIS concept', 'In Unity Catalog'],
        rows: [
          ['Feature: one geometry plus its attributes', 'One row: a GEOMETRY column and ordinary attribute columns'],
          [
            'Layer or feature class: features of one kind, such as pipes',
            'One Delta table, for example pipes, meters, zones',
          ],
          [
            'Dataset or geodatabase: layers that belong together',
            'A schema per domain, such as water_network, inside a catalog per environment',
          ],
          [
            'Layer CRS',
            'The SRID in the column type, GEOMETRY(4326), plus a column comment naming the source CRS and units',
          ],
          [
            'Raw delivery: shapefile set, .gdb folder, GeoPackage',
            'A file in a volume, kept next to the tables it fed',
          ],
          ['Tiling or spatial index', 'An H3 cell column, used as a join key and a liquid clustering key'],
          ['Symbology and map projects', 'Not stored. Dashboards and GIS projects read the tables'],
        ],
      },
      points: [
        {
          strong: 'Geometry types.',
          text: 'POINT, LINESTRING, and POLYGON are the base types. MULTIPOINT, MULTILINESTRING, and MULTIPOLYGON hold several parts as one feature, such as a parcel split by a road. A GEOMETRYCOLLECTION mixes types, and ST_Contains returns an error for it, so split collections with ST_Dump first. ST_Multi promotes a single geometry to its multi form, which lets one column hold polygons and multipolygons.',
        },
        {
          strong: 'Coordinate reference systems and SRIDs.',
          text: 'A CRS says how coordinates map to the earth. An SRID is its numeric code, such as 4326 for longitude and latitude in degrees or 32610 for UTM zone 10N in meters. GEOMETRY(srid) fixes the SRID for the column. GEOMETRY(ANY) can hold mixed SRIDs but cannot be saved to a table, so normalize before you write.',
        },
        {
          strong: 'Topology.',
          text: 'A geodatabase can enforce rules such as no gaps between parcels or no overlaps between zones. The docs describe no topology rule engine. Shared boundaries are stored once per feature, so check them yourself with ST_IsValid, ST_Intersects, and ST_Touches, and keep the failures in a quarantine table.',
        },
        {
          strong: 'Spatial indexing and tiling.',
          text: 'H3 divides the earth into hexagonal cells at 16 resolutions. Store the cell ID of each feature as a BIGINT column and use it three ways: as the equality key for a prefilter join, as the GROUP BY key for counts, and as the CLUSTER BY key so nearby rows share files. The resolution table in the function reference shows the cell size at each level. Clustering on a cell is practical guidance; the clustering docs do not mention spatial data.',
        },
      ],
      links: [
        { label: 'GEOMETRY type', url: `${DOCS}/sql/language-manual/data-types/geometry-type` },
        { label: 'ST_Dump', url: `${DOCS}/sql/language-manual/functions/st_dump` },
        { label: 'ST_Multi', url: `${DOCS}/sql/language-manual/functions/st_multi` },
        { label: 'Unity Catalog best practices', url: `${DOCS}/data-governance/unity-catalog/best-practices` },
        { label: 'Liquid clustering', url: `${DOCS}/delta/clustering` },
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
      id: 'file-formats',
      heading: 'Common GIS file formats',
      prose:
        'Built in means a Databricks SQL function or reader named in the docs. read_files lists no GIS container format, and the ST_ functions import GeoJSON, WKT, EWKT, and WKB. Everything else needs a library such as GDAL. The format facts (sidecar files, size limits) come from the format specifications, not from Databricks docs. The "ran" notes say what the reference job did; "not run" means the route comes from the docs or general GIS practice.',
      options: {
        caption: 'Format, how to read it on Databricks, and what to watch for',
        rows: [
          {
            option: 'Shapefile (vector, Esri; the most common exchange format)',
            when: 'Not built in. Convert with GDAL (pyogrio) to WKB, then ST_GeomFromWKB. Ran: read back four zones equal to the GeoJSON load.',
            tradeoffs:
              'A set of files: .shp, .shx, and .dbf are required and .prj holds the CRS, so copy them together. Field names are limited to 10 characters, each file to 2 GB, and one geometry type per file. A missing .prj leaves the SRID unknown.',
          },
          {
            option: 'GeoJSON and newline-delimited GeoJSON (vector; web services and open data portals)',
            when: 'Built in. read_files as text, then ST_GeomFromGeoJSON, which returns SRID 4326. Newline-delimited files have one Feature per line, so read as text and parse each line the same way. Ran for GeoJSON; the line-delimited form was not run.',
            tradeoffs:
              'Coordinates are longitude then latitude in WGS 84. A single large FeatureCollection is one document to parse, so prefer the line-delimited form or split files for big layers.',
          },
          {
            option: 'GeoPackage (vector, optionally raster; an SQLite file with several layers)',
            when: 'Not built in. pyogrio reads one layer at a time to WKB. Ran: read back equal to the GeoJSON load.',
            tradeoffs:
              'Name the layer you want. SQLite needs local disk: writing a GeoPackage straight to a volume path failed in the reference run, so work in a temp folder and copy. Each layer has its own CRS.',
          },
          {
            option: 'KML and KMZ (vector; Google Earth and field apps)',
            when: 'Not built in. pyogrio reads KML to WKB. Ran for KML. KMZ is a zipped KML: unzip it first (not run).',
            tradeoffs:
              'Always longitude and latitude. Styles, folders, and descriptions are not attributes, and extended data may need extra parsing.',
          },
          {
            option: 'GeoParquet (vector; columnar, for large layers)',
            when: 'No GeoParquet reader is described in the docs or release notes. A GeoParquet file is Parquet with a WKB binary column, so read_files with parquet should return bytes that ST_GeomFromWKB converts. Not run here.',
            tradeoffs:
              'The geo metadata (CRS, geometry types) would not be applied for you, so set the SRID yourself. Test a file before relying on this route; it is practical guidance, not a docs statement.',
          },
          {
            option: 'Esri File Geodatabase, .gdb (vector and raster; ArcGIS)',
            when: 'Not built in. GDAL can read it through its OpenFileGDB driver. Not run here.',
            tradeoffs:
              'It is a folder of many files, so copy the whole folder. Domains, relationships, and topology rules do not come across as tables. Ask the GIS team to export layers to GeoPackage or GeoParquet when they can.',
          },
          {
            option: 'CSV with longitude and latitude, or a WKT column (tabular)',
            when: 'Built in. read_files csv, then ST_Point(lon, lat, srid) or ST_GeomFromText(wkt, srid). Ran for both.',
            tradeoffs:
              'Nothing in the file states the CRS, and latitude and longitude are often swapped. WKT contains commas, so the column must be quoted.',
          },
          {
            option: 'WKT and WKB columns (geometry as text or bytes inside another source)',
            when: 'Built in. ST_GeomFromText, ST_GeomFromWKB, and the EWKT and EWKB forms, which can carry an SRID. Ran.',
            tradeoffs: 'Plain WKT and WKB carry no SRID. Invalid shapes load without error, so run ST_IsValid after.',
          },
          {
            option: 'Raster: GeoTIFF and cloud optimized GeoTIFF (satellite, aerial, elevation)',
            when: 'No native raster decoding or raster functions are documented; the ST_ functions work on vector values. read_files with binaryFile loads the bytes. Decode pixels with Rasterio or GDAL, or a Spark raster library such as Apache Sedona. Databricks Labs has had raster projects; check their current status. None of this was run.',
            tradeoffs:
              'Files are large, so keep them in a volume and store the path, footprint polygon, and CRS in a Delta table. Derive vector results (zonal statistics, extracted features) and join those like any other layer.',
          },
        ],
        recommendation:
          'Land the raw files in a Unity Catalog volume and keep them. Convert each layer to a Delta table with a GEOMETRY column of one explicit SRID plus attribute columns, validate it, and add a metric copy. Treat the volume as the source of record and the table as the working copy.',
      },
      links: [
        {
          label: 'read_files',
          url: `${DOCS}/sql/language-manual/functions/read_files`,
          note: 'The supported file formats.',
        },
        {
          label: 'Binary file format',
          url: `${DOCS}/query/formats/binary`,
          note: 'How raster and other files load as bytes.',
        },
        { label: 'Parquet files', url: `${DOCS}/query/formats/parquet` },
        { label: 'ST_GeomFromWKB', url: `${DOCS}/sql/language-manual/functions/st_geomfromwkb` },
        { label: 'ST_GeomFromGeoJSON', url: `${DOCS}/sql/language-manual/functions/st_geomfromgeojson` },
        { label: 'ST_GeomFromEWKT', url: `${DOCS}/sql/language-manual/functions/st_geomfromewkt` },
      ],
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
          text: 'Resolution 9 has an an average edge near 200 m, about a city block. Finer cells mean more rows per polygon and fewer false pairs. Test two resolutions on your data.',
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
          text: 'Resolution 8 (average edge near 530 m) suits neighborhood hotspots. Too fine and most cells hold one event.',
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
      id: 'functions-st',
      heading: 'ST_ function reference',
      prose:
        'Functions grouped by what they do. (run) means the reference job ran it on serverless compute. (run*) means it ran in a spot check on a SQL warehouse while building this guide. (docs) means it appears in the docs list and was not run. GEOMETRY is generally available; GEOGRAPHY is in Public Preview with SRID 4326 only, and the predicates and measures below took GEOMETRY in the reference workspace. None of these run on classic SQL warehouses. For Python or Scala, import them with `from pyspark.databricks.sql import functions as dbf` or `import com.databricks.sql.functions._`.',
      points: [
        {
          strong: 'Constructors and import.',
          text: 'ST_Point (run), ST_GeomFromText (run), ST_GeomFromWKB (run), ST_GeomFromGeoJSON (run), ST_GeomFromEWKT (run*), ST_GeogFromText (run*), ST_MakeLine (run*), ST_Multi (run*), ST_SetSRID (run), ST_MakePolygon (docs), ST_MakeEnvelope (docs), ST_GeomFromGeoHash (docs).',
        },
        {
          strong: 'Accessors and validation.',
          text: 'ST_X (run), ST_Y (run), ST_SRID (run), ST_GeometryType (run), ST_NPoints (run), ST_IsValid (run), ST_IsEmpty (run), ST_Envelope (run*), ST_Dimension (docs), ST_NumGeometries (docs), ST_StartPoint and ST_EndPoint (docs), ST_XMin, ST_XMax, ST_YMin, ST_YMax (docs).',
        },
        {
          strong: 'Predicates.',
          text: 'ST_Contains (run), ST_Intersects (run), ST_DWithin (run), ST_Within (run*), ST_Covers (run*), ST_Touches (docs), ST_Disjoint (docs), ST_Equals (docs). ST_Contains excludes the boundary; ST_Covers includes it.',
        },
        {
          strong: 'Measurements.',
          text: 'ST_Distance (run), ST_Area (run), ST_Length (run), ST_DistanceSpheroid (run), ST_DistanceSphere (run*), ST_Perimeter (docs), ST_Azimuth (docs). Planar measures use the unit of the SRID, so use a projected SRID for meters. The spheroid and sphere distances return meters between point geometries.',
        },
        {
          strong: 'Transformations.',
          text: 'ST_Transform (run), ST_Buffer (run), ST_Centroid (run), ST_EstimateSRID (run), ST_Simplify (run*), ST_Union (run*), ST_ClosestPoint (run*), ST_Intersection (docs), ST_Difference (docs), ST_ConvexHull (docs), ST_Force2D (docs), ST_FlipCoordinates (docs).',
        },
        {
          strong: 'Aggregates.',
          text: 'ST_Union_Agg (run), ST_Envelope_Agg (docs), ST_Collect (docs).',
        },
        {
          strong: 'Output and export.',
          text: 'ST_AsText (run), ST_AsGeoJSON (run), ST_AsBinary (run), ST_AsWKB (run*), ST_AsEWKT (run*), ST_AsEWKB (docs), ST_GeoHash (docs).',
        },
      ],
      links: [
        {
          label: 'ST geospatial functions (full list)',
          url: `${DOCS}/sql/language-manual/sql-ref-st-geospatial-functions`,
        },
        { label: 'ST_Point', url: `${DOCS}/sql/language-manual/functions/st_point` },
        { label: 'ST_GeomFromText', url: `${DOCS}/sql/language-manual/functions/st_geomfromtext` },
        { label: 'ST_SetSRID', url: `${DOCS}/sql/language-manual/functions/st_setsrid` },
        { label: 'ST_IsValid', url: `${DOCS}/sql/language-manual/functions/st_isvalid` },
        { label: 'ST_Within', url: `${DOCS}/sql/language-manual/functions/st_within` },
        { label: 'ST_Covers', url: `${DOCS}/sql/language-manual/functions/st_covers` },
        { label: 'ST_Area', url: `${DOCS}/sql/language-manual/functions/st_area` },
        { label: 'ST_Length', url: `${DOCS}/sql/language-manual/functions/st_length` },
        { label: 'ST_DistanceSphere', url: `${DOCS}/sql/language-manual/functions/st_distancesphere` },
        { label: 'ST_Simplify', url: `${DOCS}/sql/language-manual/functions/st_simplify` },
        { label: 'ST_Centroid', url: `${DOCS}/sql/language-manual/functions/st_centroid` },
        { label: 'ST_Union', url: `${DOCS}/sql/language-manual/functions/st_union` },
        { label: 'ST_Union_Agg', url: `${DOCS}/sql/language-manual/functions/st_union_agg` },
        { label: 'ST_EstimateSRID', url: `${DOCS}/sql/language-manual/functions/st_estimatesrid` },
        { label: 'ST_AsText', url: `${DOCS}/sql/language-manual/functions/st_astext` },
        { label: 'ST_AsGeoJSON', url: `${DOCS}/sql/language-manual/functions/st_asgeojson` },
      ],
    },
    {
      id: 'functions-h3',
      heading: 'H3 function reference and resolution guide',
      prose:
        'Same key as above. H3 functions work on Databricks Runtime 17.0 and above on every compute type except classic SQL warehouses, including non-Photon clusters. They take longitude and latitude, or WKT, WKB, or GeoJSON text or bytes, not a GEOMETRY value: pass ST_AsText(geom) to H3_PointAsH3 or H3_CoverAsH3.',
      points: [
        {
          strong: 'Indexing.',
          text: 'H3_LongLatAsH3 (run), H3_LongLatAsH3String (run*), H3_PointAsH3 (run*), H3_PolyfillAsH3 (run), H3_CoverAsH3 (run), H3_CoverAsH3String (docs), H3_PolyfillAsH3String (docs).',
        },
        {
          strong: 'Traversal.',
          text: 'H3_KRing (run), H3_Distance (run*), H3_HexRing (docs), H3_KRingDistances (docs).',
        },
        {
          strong: 'Hierarchy.',
          text: 'H3_ToParent (run), H3_ToChildren (run*), H3_Resolution (run*), H3_Compact (docs), H3_Uncompact (docs).',
        },
        {
          strong: 'Conversion.',
          text: 'H3_H3ToString (run), H3_StringToH3 (run*), H3_CenterAsWKT (run), H3_BoundaryAsWKT (run*), H3_BoundaryAsGeoJSON (docs).',
        },
        {
          strong: 'Validation.',
          text: 'H3_IsValid (run*), H3_IsPentagon (run*), H3_Validate (docs).',
        },
      ],
      table: {
        caption:
          'Average cell size by resolution, from the H3 reference tables (spherical model). Fit is practical guidance.',
        columns: ['Resolution: average edge and area', 'Suits'],
        rows: [
          ['5: 9.85 km, 253 km²', 'Metro areas and regional summaries'],
          ['6: 3.72 km, 36.1 km²', 'City-wide summaries by district'],
          ['7: 1.41 km, 5.16 km²', 'Districts and service areas'],
          ['8: 531 m, 0.74 km²', 'Neighborhood heat maps (the reference run)'],
          ['9: 201 m, 0.105 km²', 'City blocks and prefilters for zone joins (the reference run)'],
          ['10: 75.9 m, 15,048 m²', 'Street-level grouping, hydrant and valve density'],
          ['11: 28.7 m, 2,150 m²', 'Large parcels and sites'],
          ['12: 10.8 m, 307 m²', 'Individual lots and buildings'],
          ['13: 4.1 m, 43.9 m²', 'Asset-scale work; rows per polygon grow quickly'],
        ],
      },
      links: [
        {
          label: 'H3 geospatial functions (full list)',
          url: `${DOCS}/sql/language-manual/sql-ref-h3-geospatial-functions`,
        },
        {
          label: 'H3 cell sizes by resolution',
          url: 'https://h3geo.org/docs/core-library/restable/',
          note: 'Source of the table above.',
        },
        { label: 'H3_PointAsH3', url: `${DOCS}/sql/language-manual/functions/h3_pointash3` },
        { label: 'H3_Distance', url: `${DOCS}/sql/language-manual/functions/h3_distance` },
        { label: 'H3_ToChildren', url: `${DOCS}/sql/language-manual/functions/h3_tochildren` },
        { label: 'H3_Resolution', url: `${DOCS}/sql/language-manual/functions/h3_resolution` },
        { label: 'H3_StringToH3', url: `${DOCS}/sql/language-manual/functions/h3_stringtoh3` },
        { label: 'H3_BoundaryAsWKT', url: `${DOCS}/sql/language-manual/functions/h3_boundaryaswkt` },
        { label: 'H3_IsValid', url: `${DOCS}/sql/language-manual/functions/h3_isvalid` },
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
    {
      id: 'best-practices',
      heading: 'Best practices for GIS data',
      prose:
        'A checklist for any spatial table. Items marked (docs) rest on a docs statement; the rest are practical guidance from building the reference job.',
      points: [
        {
          strong: 'Store GEOMETRY with an explicit SRID, one SRID per column.',
          text: '(docs) GEOMETRY(srid) fixes the SRID, and GEOMETRY(ANY) cannot be persisted. Predicates return ST_DIFFERENT_SRID_VALUES when the two inputs differ.',
        },
        {
          strong: 'Record the source CRS and reproject once, at silver.',
          text: 'Keep the delivered CRS in the bronze table or a column comment. Reproject with ST_Transform in the step that builds the silver table, so no query repeats it.',
        },
        {
          strong: 'Keep a metric or projected copy for distance and area.',
          text: '(docs) ST_Distance, ST_DWithin, and ST_Area use the unit of the SRID, which is degrees on 4326. Add a geom_m column in a local projected SRID and use ST_EstimateSRID to pick one.',
        },
        {
          strong: 'Validate with ST_IsValid and quarantine the failures.',
          text: 'Write invalid rows to a separate table with the reason, and join only valid geometry. The reference job counts invalid, empty, and mixed-SRID rows on every load.',
        },
        {
          strong: 'Simplify very detailed polygons for display.',
          text: 'ST_Simplify gives a lighter layer for dashboards and exports. Keep the full-detail column for analysis.',
        },
        {
          strong: 'Use the H3 prefilter for large joins, and choose the resolution from the question.',
          text: 'Cover the polygons, join on the cell, then run the exact predicate. Pick a resolution whose cell is a little smaller than the feature you ask about; the resolution table above gives the sizes.',
        },
        {
          strong: 'Cluster on an H3 cell or a region key.',
          text: 'CLUSTER BY the cell so nearby rows share files. The clustering docs do not discuss spatial data, and the reference tables were too small to time it.',
        },
        {
          strong: 'Keep the raw files in Unity Catalog volumes.',
          text: 'The delivered shapefile, GeoPackage, or PDF stays beside the tables built from it, with volume grants and lineage.',
        },
        {
          strong: 'Document CRS and units in comments.',
          text: 'Put the SRID, unit, and source in the column comment, for example "UTM 10N, meters, from the 2026 survey". COMMENT ON TABLE and COLUMN work as for any data.',
        },
        {
          strong: 'Govern location-sensitive data with row filters or masks.',
          text: 'Filter by district or role, and mask or generalize exact coordinates for readers who need only an area. Add a coarse H3 cell as the shareable column.',
        },
        {
          strong: 'Avoid GROUP BY on GEOMETRY.',
          text: '(docs, and seen in the run) GEOMETRY cannot be grouped. Group by an ID, an H3 cell, or ST_AsWKB(geom) when you must deduplicate shapes.',
        },
        {
          strong: 'Prefer GEOMETRY over GEOGRAPHY while GEOGRAPHY is in preview.',
          text: '(docs) GEOGRAPHY is Public Preview and SRID 4326 only. Use it when you need geodesic results and have confirmed the functions you need accept it. ST_DistanceSpheroid already gives geodesic point distances on GEOMETRY.',
        },
      ],
      links: [
        { label: 'GEOMETRY type', url: `${DOCS}/sql/language-manual/data-types/geometry-type` },
        { label: 'GEOGRAPHY type', url: `${DOCS}/sql/language-manual/data-types/geography-type` },
        { label: 'ST_IsValid', url: `${DOCS}/sql/language-manual/functions/st_isvalid` },
        { label: 'ST_EstimateSRID', url: `${DOCS}/sql/language-manual/functions/st_estimatesrid` },
        { label: 'ST_Simplify', url: `${DOCS}/sql/language-manual/functions/st_simplify` },
        { label: 'Liquid clustering', url: `${DOCS}/delta/clustering` },
        { label: 'Unity Catalog volumes', url: `${DOCS}/volumes/` },
        { label: 'Row filters and column masks', url: `${DOCS}/data-governance/unity-catalog/filters-and-masks` },
        { label: 'COMMENT ON', url: `${DOCS}/sql/language-manual/sql-ref-syntax-ddl-comment` },
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
