import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'medallion-architecture',
  area: 'Foundations',
  title: 'Medallion architecture',
  intro:
    'The medallion architecture organizes a lakehouse into three layers. Bronze keeps raw data as it arrived, silver cleans and joins it, and gold shapes it for the people and tools that use it. It is a naming and design pattern, not a product feature, and most of the other guides build on it.',
  businessValue: {
    summary:
      'A shared bronze, silver, and gold layout gives every team a raw record, a cleaned layer, and business-ready tables. Data leaders get predictable quality and a known home for each dataset.',
    outcomes: [
      {
        title: 'Rebuild without re-extracting',
        body: 'Bronze keeps raw data as it arrived. When a transformation bug turns up, the team rebuilds silver and gold from bronze instead of asking the source system for the data again.',
      },
      {
        title: 'Quality gates before reports',
        body: 'Expectations between layers warn, drop, or fail on bad rows, and a quarantine table holds rejects for review. Report readers see data that passed checks.',
      },
      {
        title: 'Access set per layer',
        body: 'Each layer is its own schema with its own grants. Analysts read gold while only the data engineering team touches raw data.',
      },
      {
        title: 'One definition of each metric',
        body: 'Metric views define governed measures once, so every tool that queries them by dimension reports the same figure.',
      },
    ],
  },
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
        'A Lakeflow Spark Declarative Pipeline is the usual way to build the layers: streaming tables for bronze and silver, materialized views for gold. The pipeline tracks dependencies and only processes new data.',
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
            icon: 'network',
            domain: 'neutral',
            detail:
              'Where the data starts. Auto Loader or Lakeflow Connect bring files, database changes, and API data into bronze.',
          },
          {
            id: 'bronze',
            label: 'Bronze',
            sub: 'raw, append-only',
            col: 0,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail:
              'Raw records as they arrived, append-only, with load time and source file. If a later step has a bug, the team rebuilds from bronze instead of re-extracting.',
          },
          {
            id: 'checks',
            label: 'Expectations',
            sub: 'types, keys, rules',
            col: 1,
            row: 1,
            kind: 'gate',
            domain: 'governance',
            detail:
              'Expectations check types, keys, and rules between layers. Each rule chooses warn, drop, or fail, so bad rows do not move forward unnoticed.',
          },
          {
            id: 'silver',
            label: 'Silver',
            sub: 'clean, deduplicated',
            col: 2,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail:
              'Cleaned and conformed data: types cast, duplicates removed, keys standardized. Tables from different sources join here.',
          },
          {
            id: 'gold',
            label: 'Gold',
            sub: 'aggregates, models',
            col: 3,
            row: 1,
            kind: 'highlight',
            icon: 'database',
            domain: 'data',
            detail:
              'Materialized views that aggregate silver into tables shaped for a dashboard, a report, or a model.',
          },
          {
            id: 'quarantine',
            label: 'Quarantine',
            sub: 'optional, for review',
            col: 1,
            row: 2,
            icon: 'list',
            domain: 'data',
            detail:
              'Holds rows that fail a rule so someone can review or repair them. It is optional and needs a second predicate that mirrors the rule.',
          },
          {
            id: 'use',
            label: 'Dashboards, Genie, ML',
            sub: 'read gold tables',
            col: 3,
            row: 3,
            kind: 'surface',
            icon: 'dashboard',
            domain: 'apps',
            detail: 'Dashboards, Genie, and ML models read the gold tables. Most users only need gold.',
          },
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
      id: 'reference-architecture',
      heading: 'Reference architecture: sources to consumers',
      prose:
        'The same three layers sit between any set of sources and any set of consumers. Each band is a stage, each card is a typical object in it, and the dashed line marks what Unity Catalog governs. Hover or focus a stage, a card, or the line for detail.',
      diagram: {
        type: 'flow',
        title: 'Sources to consumers through bronze, silver, and gold',
        description:
          'Five stages from top to bottom. Sources are an operational database, a SaaS application, and files and events. Each lands in one raw bronze table per source. Silver holds conformed entities and validated facts. Gold holds metric views and aggregates, and feature and serving tables. Consumers are dashboards and Genie Agents, ML models and serving, and an operational app on Lakebase. A dashed edge returns the app writes to bronze through Lakebase Change Data Feed. A dashed line around bronze, silver, and gold marks what Unity Catalog governs.',
        lanes: [
          {
            label: 'Sources',
            fromRow: 0,
            toRow: 0,
            detail:
              'The systems that create data, left where they are. Lakeflow Connect, Auto Loader, and streaming bring it into bronze.',
          },
          {
            label: 'Bronze',
            fromRow: 1,
            toRow: 1,
            detail: 'Raw copies of each source, append-only, so you can replay and audit.',
          },
          {
            label: 'Silver',
            fromRow: 2,
            toRow: 2,
            detail:
              'Conformed, validated records. Identities are resolved, quality and privacy rules are enforced, and history stays point-in-time.',
          },
          {
            label: 'Gold',
            fromRow: 3,
            toRow: 3,
            detail:
              'Tables built for one decision grain, with governed measures, a stated freshness, and lineage back to silver.',
          },
          {
            label: 'Consumers',
            fromRow: 4,
            toRow: 4,
            detail: 'Dashboards, models, and apps that read gold through Unity Catalog with their own permissions.',
          },
        ],
        boundaries: [
          {
            label: 'Unity Catalog',
            fromRow: 1,
            toRow: 3,
            detail:
              'Unity Catalog governs every table, view, and metric view inside the line, so grants, governed tags, row filters and column masks, lineage, and audit apply the same way at each layer. Consumers read through it with their own permissions.',
          },
        ],
        nodes: [
          {
            id: 'ops',
            label: 'Operational database',
            sub: 'ERP or line-of-business',
            col: 0,
            row: 0,
            kind: 'surface',
            icon: 'database',
            domain: 'neutral',
            detail:
              'A system of record such as an ERP or a line-of-business database. Lakeflow Connect captures its changes (CDC) and lands them in bronze.',
          },
          {
            id: 'saas',
            label: 'SaaS application',
            sub: 'managed connector or API',
            col: 1,
            row: 0,
            kind: 'surface',
            icon: 'saas',
            domain: 'neutral',
            detail:
              'A business application such as a CRM or a ticketing tool. A Lakeflow Connect managed connector or the application API brings its records into bronze.',
          },
          {
            id: 'files',
            label: 'Files and events',
            sub: 'Auto Loader or streaming',
            col: 2,
            row: 0,
            kind: 'surface',
            icon: 'event-stream',
            domain: 'neutral',
            detail:
              'Files in cloud storage and event streams. Auto Loader picks up new files incrementally, and Structured Streaming reads event sources such as Kafka.',
          },
          {
            id: 'raw',
            label: 'Raw table per source',
            sub: 'append-only, as received',
            col: 1,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail:
              'One append-only table for each source. Every row keeps the source payload, the source key, event time and ingestion time, a schema version, and any rescued data that did not fit the schema.',
          },
          {
            id: 'entities',
            label: 'Conformed entities',
            sub: 'identities, SCD Type 2',
            col: 0,
            row: 2,
            kind: 'store',
            icon: 'data-model',
            domain: 'data',
            detail:
              'One table per business entity, merged from all sources. Identities are resolved, source precedence settles conflicts, and SCD Type 2 keeps the history of each change.',
          },
          {
            id: 'facts',
            label: 'Validated facts',
            sub: 'quality and privacy rules',
            col: 2,
            row: 2,
            kind: 'store',
            icon: 'checklist',
            domain: 'data',
            detail:
              'Event-level records that pass expectations. Rows that fail are dropped, stop the update, or go to quarantine, and privacy rules such as column masks and row filters apply before data moves on.',
          },
          {
            id: 'metrics',
            label: 'Metric views, aggregates',
            sub: 'one grain, shared measures',
            col: 0,
            row: 3,
            kind: 'highlight',
            icon: 'warehouse',
            domain: 'data',
            detail:
              'Metric views and aggregates built at one declared grain. Measures are defined once in Unity Catalog, so every tool that queries them reports the same figure.',
          },
          {
            id: 'features',
            label: 'Feature, serving tables',
            sub: 'keyed for lookup',
            col: 2,
            row: 3,
            kind: 'highlight',
            icon: 'data-file',
            domain: 'data',
            detail:
              'Tables keyed for fast lookup by models and apps, such as features per customer. They are built from silver and refresh on a schedule or incrementally.',
          },
          {
            id: 'bi',
            label: 'AI/BI and Genie',
            sub: 'dashboards, Genie Agents',
            col: 0,
            row: 4,
            kind: 'surface',
            icon: 'dashboard',
            domain: 'apps',
            detail:
              'AI/BI dashboards and Genie Agents read the metric views through Unity Catalog, each person with their own permissions.',
          },
          {
            id: 'ml',
            label: 'ML and model serving',
            sub: 'train and score',
            col: 2,
            row: 4,
            kind: 'surface',
            icon: 'gear-maroon',
            domain: 'ai',
            detail:
              'Models train on the feature tables and then score in batch or answer requests through a serving endpoint.',
          },
          {
            id: 'app',
            label: 'App on Lakebase',
            sub: 'serves users, syncs out',
            col: 1,
            row: 4,
            kind: 'surface',
            icon: 'cloud-database',
            domain: 'apps',
            detail:
              'A transactional app on Lakebase, the managed Postgres service. It reads tables synced from gold, and its writes return to Delta through Lakebase Change Data Feed (Public Preview).',
          },
        ],
        edges: [
          { from: 'ops', to: 'raw' },
          { from: 'saas', to: 'raw' },
          { from: 'files', to: 'raw' },
          { from: 'raw', to: 'entities' },
          { from: 'raw', to: 'facts' },
          { from: 'entities', to: 'metrics' },
          { from: 'facts', to: 'features' },
          { from: 'metrics', to: 'bi' },
          { from: 'features', to: 'ml' },
          { from: 'features', to: 'app' },
          { from: 'app', to: 'raw', label: 'Change Data Feed', dashed: true },
        ],
        legend: [
          { kind: 'surface', label: 'Source or consumer' },
          { kind: 'store', label: 'Delta table' },
          { kind: 'highlight', label: 'Gold table' },
          { kind: 'dashed', label: 'App writes returning to bronze' },
        ],
      },
      points: [
        {
          strong: 'Bronze preserves the source.',
          text: 'Keep the source payload, the source key, event time and ingestion time, the schema version, and rescued data. Nothing is cleaned here, so every later layer can be rebuilt.',
        },
        {
          strong: 'Silver decides what is true.',
          text: 'Resolve identities, apply source precedence, enforce quality and privacy rules, and keep point-in-time history so a past report can be reproduced.',
        },
        {
          strong: 'Gold serves one decision.',
          text: 'Declare one grain per table, define each measure once, state how fresh the data is, and keep lineage back to the silver tables it reads.',
        },
        {
          strong: 'App writes can return to the lakehouse.',
          text: 'Lakebase Change Data Feed (Public Preview) records the app changes as Delta history tables. Treat that history as one more bronze source, then run it through silver and gold like the rest.',
        },
      ],
      links: [
        { label: 'Medallion architecture', url: 'https://docs.databricks.com/aws/en/lakehouse/medallion' },
        { label: 'Lakebase Change Data Feed', url: 'https://docs.databricks.com/aws/en/oltp/projects/lakebase-cdf' },
      ],
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
              { state: 'optional', text: 'Data engineers', detail: 'Keep bronze to the engineers who run ingestion.' },
              {
                state: 'own',
                text: 'Everything',
                detail:
                  'Bronze is the record of what the source sent, so the team can rebuild silver and gold from it.',
              },
            ],
          },
          {
            label: 'Silver',
            sub: 'sales_silver',
            cells: [
              { state: 'own', text: 'Typed, deduplicated', sub: 'joined across sources' },
              { state: 'optional', text: 'Engineers, scientists' },
              {
                state: 'optional',
                text: 'Current or SCD 2',
                detail:
                  'Deduplicate with AUTO CDC when the source sends updates. The table keeps either the current row or SCD type 2 history.',
              },
            ],
          },
          {
            label: 'Gold',
            sub: 'sales_gold',
            cells: [
              { state: 'own', text: 'Aggregates, facts', sub: 'business names' },
              {
                state: 'own',
                text: 'Analysts, BI, models',
                detail: 'Most users only need gold, so grants by layer point analysts here.',
              },
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
        'Each layer is a few lines in a Lakeflow Spark Declarative Pipeline. The pipeline reads the definitions, builds the graph, and refreshes only what changed.',
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
      options: {
        caption: 'Expectation actions in Lakeflow Spark Declarative Pipelines',
        rows: [
          {
            option: 'Warn (default)',
            when: 'The rule is advisory or you are still learning the data. Rows pass, and the violation count goes to the event log.',
            tradeoffs:
              'The pipeline never stops, but bad rows reach downstream tables, so consumers may see them. Good for profiling a new source before you enforce anything.',
          },
          {
            option: 'DROP ROW',
            when: 'A bad row is safe to discard and nobody needs to see it.',
            tradeoffs:
              'Dropped rows are counted but not stored, so you cannot repair them later. A rule that is too strict loses data quietly, so watch the drop counts in the event log.',
          },
          {
            option: 'FAIL UPDATE',
            when: 'A violation means the source or the logic is broken, such as a null primary key.',
            tradeoffs:
              'The update stops before bad data lands, which protects gold and everything after it. The cost is an outage until someone fixes the cause, so pair it with alerting and an owner.',
          },
          {
            option: 'Quarantine table',
            when: 'Someone must review or repair rejected rows. Write the inverse of the rule to a second table.',
            tradeoffs:
              'Keeps every rejected row for repair and replay. It adds a table, a review process, and a second predicate to keep in sync with the rule, so derive both from one definition.',
          },
        ],
        recommendation:
          'Start with warn while you learn a source. Move key and contract rules to FAIL UPDATE, use a quarantine table where rejected rows have business value, and drop only when discarding is safe.',
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
        {
          label: 'Manage data quality with pipeline expectations',
          url: 'https://docs.databricks.com/aws/en/ldp/expectations',
        },
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
      options: {
        caption: 'How to publish a gold object',
        rows: [
          {
            option: 'View',
            when: 'The logic is cheap and the result must always be current.',
            tradeoffs:
              'Nothing is stored and nothing needs a refresh. Every query reruns the logic, so cost and latency grow with the number of readers and the size of the inputs.',
          },
          {
            option: 'Materialized view',
            when: 'Dashboards or apps read an aggregate or join often.',
            tradeoffs:
              'Results are cached, so reads are fast. The pipeline refreshes the view incrementally where it can and falls back to a full recompute otherwise, so data is as fresh as the last refresh and you pay for refresh compute. Plan the refresh schedule to match the freshness the business needs.',
          },
          {
            option: 'Metric view',
            when: 'Several tools must report the same measures, such as revenue, from one definition.',
            tradeoffs:
              'Measures, dimensions, and filters are defined once in Unity Catalog, so dashboards, Genie, and SQL agree. A metric view does not store results by default, so put it over a materialized view or a well-clustered table when dashboards are heavy.',
          },
        ],
        recommendation:
          'Use a materialized view for the heavy aggregates that dashboards read, and add a metric view on top when several tools need one definition of a measure. Use a plain view only for cheap logic that must be live.',
      },
      links: [
        { label: 'Liquid clustering', url: 'https://docs.databricks.com/aws/en/delta/clustering' },
        { label: 'Materialized views', url: 'https://docs.databricks.com/aws/en/ldp/materialized-views' },
        { label: 'Views', url: 'https://docs.databricks.com/aws/en/views/' },
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
