import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Should I store GEOMETRY or GEOGRAPHY?',
    answer:
      'Store GEOMETRY(4326) for interchange and add a projected GEOMETRY column for distances and buffers. GEOMETRY is generally available. GEOGRAPHY is Public Preview with SRID 4326 only, and in the reference workspace ST_Contains, ST_Distance, and ST_Buffer rejected a GEOGRAPHY argument. This is practical guidance from those tests; the docs set no rule.',
    links: [
      {
        label: 'GEOMETRY type',
        url: 'https://docs.databricks.com/aws/en/sql/language-manual/data-types/geometry-type',
      },
    ],
  },
  {
    question: 'Why keep a second, projected geometry column?',
    answer:
      'ST_Distance, ST_DWithin, and ST_Area use the unit of the SRID, which is degrees on 4326. A projected SRID such as UTM gives meters. Use ST_EstimateSRID to pick one for your area.',
    links: [
      {
        label: 'ST_EstimateSRID',
        url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/st_estimatesrid',
      },
    ],
  },
  {
    question: 'Does it run on classic SQL warehouses?',
    answer:
      'No. The ST_ functions need Databricks Runtime 17.1 or above or Databricks SQL, and H3 functions need Runtime 17.0 or above on every compute type except classic SQL warehouses. The reference job ran on serverless compute and SQL warehouses.',
  },
  {
    question: 'Can I read shapefiles, GeoPackage, or KML directly?',
    answer:
      'No. read_files lists no reader for them. Use GDAL (here pyogrio) to decode them to WKB, then ST_GeomFromWKB. GeoJSON, WKT, EWKT, and WKB are built in. GeoParquet has no documented reader, but it is Parquet with a WKB column, so read_files with parquet plus ST_GeomFromWKB reads it.',
    links: [
      {
        label: 'ST_GeomFromWKB',
        url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geomfromwkb',
      },
    ],
  },
  {
    question: 'Do I need H3 if I already have ST_ functions?',
    answer:
      'Start with the exact ST_ predicate and add an H3 cover prefilter when a large join is slow. Join on the cell ID, then run the exact test on the pairs that remain. Use H3_CoverAsH3, not polyfill, because polyfill left 20 meters out of their zone and put 42 in a wrong one in the reference run.',
    links: [
      { label: 'H3_CoverAsH3', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_coverash3' },
    ],
  },
  {
    question: 'How do I restrict who sees which locations?',
    answer:
      'Geometry is an ordinary column, so grant on the table and use a row filter that maps users or groups to districts. Name the filter parameter something no column uses, because a matching name makes the test always true and every row passes. Exports to a volume leave row filters behind.',
    links: [
      {
        label: 'Row filters and column masks',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks',
      },
    ],
  },
];
