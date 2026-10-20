import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'medallion-architecture',
  area: 'Foundations',
  title: 'Medallion architecture',
  intro:
    'The medallion architecture organizes a lakehouse into three layers. Bronze keeps raw data as it arrived, silver cleans and joins it, and gold shapes it for the people and tools that use it. It is a naming and design pattern, not a product feature, and most of the other guides build on it.',
  shortVersion: [
    {
      title: 'Bronze is the raw record.',
      body: 'Data lands as-is, append-only, with load time and source file. If a later step has a bug, you can rebuild from bronze without going back to the source.',
    },
    {
      title: 'Silver is clean and conformed.',
      body: 'Types are cast, duplicates removed, bad rows dropped or routed to a quarantine table, and keys standardized. Silver is where tables from different sources join.',
    },
    {
      title: 'Gold is shaped for use.',
      body: 'Aggregates, dimensional models, and feature tables built for a dashboard, a report, or a model.',
    },
    {
      title: 'Quality improves at each hop.',
      body: 'Expectations between layers decide what moves forward. Choose an action per rule: warn keeps the row and records the metric, drop discards it, fail stops the update. Hold rows for review in a quarantine table.',
    },
    {
      title: 'Pick the gold object by how it is read.',
      body: 'Views for light logic, materialized views for precomputed aggregates, metric views for governed measures that many tools query by dimension.',
    },
    {
      title: 'Layers are schemas or catalogs.',
      body: 'A common layout is one schema per layer, such as sales_bronze, sales_silver, and sales_gold, each with its own grants.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'From source to gold',
      prose:
        'A Lakeflow Declarative Pipeline is the usual way to build the layers: streaming tables for bronze and silver, materialized views for gold. The pipeline tracks dependencies and only processes new data.',
      diagram: {
        type: 'flow',
        title: 'Bronze, silver, gold',
        description:
          'Files, databases, and APIs land in bronze tables as raw records with ingestion metadata, using Auto Loader or Lakeflow Connect. Expectations check the records; failing rows are dropped or, if they need review, written to a quarantine table, and the rest are typed, deduplicated, and joined into silver tables. Gold materialized views aggregate silver into tables read by dashboards, Genie, and ML models.',
        lanes: [
          { label: 'Sources', fromRow: 0, toRow: 0 },
          { label: 'Lakehouse', fromRow: 1, toRow: 2 },
          { label: 'Consumers', fromRow: 3, toRow: 3 },
        ],
        nodes: [
          {
            id: 'sources',
            label: 'Files, databases, APIs',
            sub: 'CSV, CDC, SaaS, REST',
            col: 0,
            row: 0,
            kind: 'surface',
          },
          { id: 'bronze', label: 'Bronze', sub: 'raw, append-only', col: 0, row: 1, kind: 'store' },
          { id: 'checks', label: 'Expectations', sub: 'types, keys, rules', col: 1, row: 1, kind: 'gate' },
          { id: 'silver', label: 'Silver', sub: 'clean, deduplicated', col: 2, row: 1, kind: 'store' },
          { id: 'gold', label: 'Gold', sub: 'aggregates, models', col: 3, row: 1, kind: 'highlight' },
          { id: 'quarantine', label: 'Quarantine', sub: 'optional, for review', col: 1, row: 2 },
          { id: 'use', label: 'Dashboards, Genie, ML', sub: 'read gold tables', col: 3, row: 3, kind: 'surface' },
        ],
        edges: [
          { from: 'sources', to: 'bronze', label: 'Auto Loader, Connect' },
          { from: 'bronze', to: 'checks' },
          { from: 'checks', to: 'silver', label: 'pass' },
          { from: 'checks', to: 'quarantine', label: 'fail', dashed: true },
          { from: 'silver', to: 'gold' },
          { from: 'gold', to: 'use' },
        ],
        legend: [
          { kind: 'store', label: 'Streaming table' },
          { kind: 'highlight', label: 'Materialized view' },
          { kind: 'gate', label: 'Quality check' },
        ],
      },
    },
    {
      id: 'layers',
      heading: 'What each layer holds',
      diagram: {
        type: 'matrix',
        title: 'Layers compared',
        description:
          'Bronze holds raw data, is read by data engineers, and keeps full history. Silver holds cleaned, typed, deduplicated data, is read by engineers and data scientists, and keeps current or full history. Gold holds business aggregates and models, is read by analysts, dashboards, and models, and keeps what the use case needs.',
        corner: 'Layer ↓ · Trait →',
        columns: ['Data', 'Main readers', 'History'],
        rows: [
          {
            label: 'Bronze',
            sub: 'sales_bronze',
            cells: [
              { state: 'own', text: 'Raw, as landed', sub: '+ source, load time' },
              { state: 'optional', text: 'Data engineers' },
              { state: 'own', text: 'Everything' },
            ],
          },
          {
            label: 'Silver',
            sub: 'sales_silver',
            cells: [
              { state: 'own', text: 'Typed, deduplicated', sub: 'joined across sources' },
              { state: 'optional', text: 'Engineers, scientists' },
              { state: 'optional', text: 'Current or SCD 2' },
            ],
          },
          {
            label: 'Gold',
            sub: 'sales_gold',
            cells: [
              { state: 'own', text: 'Aggregates, facts', sub: 'business names' },
              { state: 'own', text: 'Analysts, BI, models' },
              { state: 'optional', text: 'As the use needs' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Defining trait' },
          { state: 'optional', label: 'Varies by design' },
        ],
      },
    },
    {
      id: 'pipeline',
      heading: 'The three layers in SQL',
      prose:
        'Each layer is a few lines in a Lakeflow Declarative Pipeline. The pipeline reads the definitions, builds the graph, and refreshes only what changed.',
      examples: [
        {
          label: 'Bronze, silver, and gold in one pipeline',
          language: 'sql',
          code: `-- Bronze: raw files as they land, plus where they came from
CREATE OR REFRESH STREAMING TABLE orders_bronze AS
SELECT *, _metadata.file_path AS source_file, current_timestamp() AS loaded_at
FROM STREAM read_files('/Volumes/main/sales/landing/orders', format => 'json');

-- Silver: typed and checked; rows without an order_id are dropped (quarantine pattern below)
CREATE OR REFRESH STREAMING TABLE orders_silver (
  CONSTRAINT has_id EXPECT (order_id IS NOT NULL) ON VIOLATION DROP ROW
) AS
SELECT CAST(order_id AS BIGINT) AS order_id, CAST(amount AS DECIMAL(12, 2)) AS amount,
       to_date(order_ts) AS order_date, upper(trim(region)) AS region
FROM STREAM orders_bronze;

-- Gold: daily revenue by region for the dashboard
CREATE OR REFRESH MATERIALIZED VIEW revenue_by_day AS
SELECT order_date, region, sum(amount) AS revenue, count(*) AS orders
FROM orders_silver
GROUP BY order_date, region;`,
          notes: [
            'Deduplicate in silver with AUTO CDC when the source sends updates; see the SCD and CDC guides.',
            'Put each layer in its own schema when different teams own or read them.',
          ],
        },
      ],
    },
    {
      id: 'quality',
      heading: 'Choosing an expectation action',
      table: {
        caption: 'Expectation actions in Lakeflow Spark Declarative Pipelines',
        columns: ['Action', 'Use it when'],
        rows: [
          ['Warn (default)', 'The rule is advisory or you are still learning the data. Rows pass, and the violation count goes to the event log.'],
          ['DROP ROW', 'A bad row is safe to discard and nobody needs to see it. Dropped rows are counted but not stored.'],
          ['FAIL UPDATE', 'A violation means the source or the logic is broken, such as a null primary key. The update stops before bad data lands.'],
          ['Quarantine table', 'Someone must review or repair rejected rows. Write the inverse of the rule to a second table.'],
        ],
      },
      examples: [
        {
          label: 'Quarantine rows that fail a rule',
          language: 'sql',
          code: `CREATE OR REFRESH STREAMING TABLE orders_silver (
  CONSTRAINT has_id EXPECT (order_id IS NOT NULL) ON VIOLATION DROP ROW
) AS SELECT * FROM STREAM orders_bronze;

CREATE OR REFRESH STREAMING TABLE orders_quarantine AS
SELECT *, current_timestamp() AS quarantined_at
FROM STREAM orders_bronze
WHERE NOT (order_id IS NOT NULL);`,
          notes: [
            'Derive both predicates from one rule so the two tables never disagree. In Python, build the quarantine filter from the same expectations dictionary.',
          ],
        },
        {
          label: 'Apply updates with AUTO CDC',
          language: 'sql',
          code: `CREATE OR REFRESH STREAMING TABLE customers_silver;

CREATE FLOW customers_cdc AS AUTO CDC INTO customers_silver
FROM STREAM customers_bronze
KEYS (customer_id)
SEQUENCE BY updated_at
STORED AS SCD TYPE 1;`,
          notes: [
            'AUTO CDC handles out-of-order events and deletes. Use it instead of a hand-written MERGE or ROW_NUMBER dedupe in a pipeline.',
          ],
        },
      ],
      links: [
        { label: 'Manage data quality with pipeline expectations', url: 'https://docs.databricks.com/aws/en/ldp/expectations' },
        { label: 'AUTO CDC', url: 'https://docs.databricks.com/aws/en/ldp/cdc' },
      ],
    },
    {
      id: 'physical',
      heading: 'Layout and gold objects',
      points: [
        {
          strong: 'Liquid clustering.',
          text: 'Cluster large silver and gold tables with CLUSTER BY on the columns you filter and join on, or CLUSTER BY AUTO to let predictive optimization choose. It replaces partitioning and ZORDER for new tables.',
        },
        {
          strong: 'View.',
          text: 'Pick a view when the logic is cheap and the result must always be current. Nothing is stored.',
        },
        {
          strong: 'Materialized view.',
          text: 'Pick a materialized view for aggregates and joins that dashboards read often. The pipeline refreshes it incrementally where it can.',
        },
        {
          strong: 'Metric view.',
          text: 'Pick a metric view to define measures, dimensions, and filters once in Unity Catalog, so dashboards, Genie, and SQL return the same revenue number.',
        },
      ],
      links: [
        { label: 'Liquid clustering', url: 'https://docs.databricks.com/aws/en/delta/clustering' },
        { label: 'Unity Catalog metric views', url: 'https://docs.databricks.com/aws/en/metric-views/' },
      ],
    },
    {
      id: 'tips',
      heading: 'Rules of thumb',
      points: [
        {
          strong: 'Never edit bronze.',
          text: 'Fix problems in the silver logic and rebuild. Bronze is the record of what the source sent.',
        },
        {
          strong: 'Grant by layer.',
          text: 'Most users only need gold. Keep bronze to the engineers who run ingestion.',
        },
        {
          strong: 'Do not force three hops.',
          text: 'A clean source can go straight to silver, and a small use case can read silver directly. The layers are a guide, not a rule.',
        },
      ],
    },
  ],
  related: [
    { slug: 'how-databricks-works', title: 'How Databricks works' },
    { slug: 'unity-catalog-basics', title: 'Unity Catalog basics' },
    { slug: 'batch-real-time-ingestion', title: 'Batch and streaming ingestion' },
    { slug: 'transformation-patterns', title: 'Transformation patterns' },
    { slug: 'scd-change-capture', title: 'SCD and change capture' },
  ],
};
