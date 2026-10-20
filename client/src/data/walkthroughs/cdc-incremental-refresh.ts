import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'cdc-incremental-refresh',
  area: 'Data Engineering Guides',
  title: 'CDC and incremental refresh in pipelines',
  intro:
    'Lakeflow Spark Declarative Pipelines load change data with AUTO CDC from three kinds of source: Debezium-style change files, the Delta change data feed of an operational table, and periodic snapshots. After the first load, run normal incremental updates. Use a full refresh only when logic or history needs rebuilding. This page covers how each source tracks what is new, what a refresh clears, and how to choose.',
  businessValue: {
    summary:
      'Data platform owners need operational data to reach analytics quickly without reloading whole tables. This guide covers incremental change capture in Lakeflow Spark Declarative Pipelines and the protections to set before a full refresh is run.',
    outcomes: [
      {
        title: 'Fresher data, less reprocessing',
        body:
          'After the first load, each update reads only new input and resumes from its checkpoint. Reports reflect recent changes without rereading the whole source.',
      },
      {
        title: 'Lower compute for large tables',
        body:
          'Serverless materialized views refresh only what changed when the query supports it. Compute spend follows the change volume, not the table size.',
      },
      {
        title: 'Protection for irreplaceable data',
        body:
          'Setting pipelines.reset.allowed to false on raw tables stops a full refresh from truncating data you cannot rebuild. Selective refresh limits the rest to one table.',
      },
      {
        title: 'Bad feeds stopped early',
        body:
          'Expectations on bronze catch null keys and missing sequence values before they reach downstream tables. For databases, Lakeflow Connect provides managed CDC ingestion.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Match the source to the flow.',
      body: 'Change files go through Auto Loader to a type 1 table. A Delta change data feed feeds a type 2 table. A snapshot table feeds AUTO CDC FROM SNAPSHOT.',
    },
    {
      title: 'Each part tracks "new" its own way.',
      body: 'Auto Loader remembers files, Delta streams remember a table version, AUTO CDC uses keys and a sequence column, and snapshots are compared by key.',
    },
    {
      title: 'Incremental is the default.',
      body: 'An incremental update reads only new input, and each flow resumes from its checkpoint. Run it on serverless so materialized views can refresh incrementally too.',
    },
    {
      title: 'A full refresh clears state, so protect what you cannot rebuild.',
      body: 'It truncates streaming tables and resets checkpoints. Set pipelines.reset.allowed = false on raw tables such as bronze, and prefer a selective refresh of one table.',
    },
    {
      title: 'Validate the feed before you apply it.',
      body: 'Expectations on bronze catch null keys and missing sequence values. For databases, Lakeflow Connect gives you managed CDC ingestion instead of a hand-built feed.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'Three sources, one pipeline',
      prose:
        'Each source needs a different way to read changes. All three end in an AUTO CDC target, and a materialized view can sit on the result.',
      diagram: {
        type: 'flow',
        title: 'Sources, flows, and targets',
        description:
          'Debezium JSON files in a volume are read by Auto Loader into cdc_orders_bronze and applied to cdc_orders_scd1. The Delta table cdc_orders_source is read as a change data feed and applied to cdc_orders_from_cdf. The table cdc_orders_snapshot is compared with its previous snapshot and applied to cdc_orders_snapshot_scd2. The materialized view cdc_orders_daily reads cdc_orders_scd1.',
        nodes: [
          { id: 'files', label: 'Change files', sub: 'Debezium JSON, volume', col: 0, row: 0, kind: 'store' },
          { id: 'src', label: 'cdc_orders_source', mono: true, sub: 'Delta, row tracking', col: 0, row: 1, kind: 'store' },
          { id: 'snap', label: 'cdc_orders_snapshot', mono: true, sub: 'replaced each run', col: 0, row: 2, kind: 'store' },
          { id: 'bronze', label: 'cdc_orders_bronze', mono: true, sub: 'Auto Loader, kept', col: 1, row: 0, kind: 'highlight' },
          { id: 'feed', label: 'readChangeFeed', mono: true, sub: 'drop update_preimage', col: 1, row: 1, kind: 'highlight' },
          { id: 'cmp', label: 'Snapshot flow', sub: 'compare with previous', col: 1, row: 2, kind: 'highlight' },
          { id: 's1', label: 'cdc_orders_scd1', mono: true, sub: 'SCD 1, by LSN', col: 2, row: 0, kind: 'store' },
          { id: 's2', label: 'cdc_orders_from_cdf', mono: true, sub: 'SCD 2, status, amount', col: 2, row: 1, kind: 'store' },
          { id: 's3', label: 'cdc_orders_snapshot_scd2', mono: true, sub: 'SCD 2', col: 2, row: 2, kind: 'store' },
          { id: 'mv', label: 'cdc_orders_daily', mono: true, sub: 'materialized view', col: 3, row: 0, kind: 'surface' },
        ],
        edges: [
          { from: 'files', to: 'bronze' },
          { from: 'src', to: 'feed' },
          { from: 'snap', to: 'cmp' },
          { from: 'bronze', to: 's1', label: 'AUTO CDC' },
          { from: 'feed', to: 's2', label: 'AUTO CDC' },
          { from: 'cmp', to: 's3', label: 'AUTO CDC' },
          { from: 's1', to: 'mv' },
        ],
        legend: [
          { kind: 'highlight', label: 'Read step' },
          { kind: 'store', label: 'Table' },
          { kind: 'surface', label: 'Materialized view' },
        ],
      },
    },
    {
      id: 'autoloader',
      heading: 'Auto Loader: files it has already seen',
      prose:
        'Auto Loader records the files it has processed in the flow checkpoint. The pipeline manages the checkpoint and schema locations, so you set neither. A file with a new name is read once. A file rewritten under a name it already processed is not read again, unless cloudFiles.allowOverwrites is on, so give each batch a new file name.',
      diagram: {
        type: 'flow',
        title: 'How Auto Loader finds new files',
        description:
          'Auto Loader lists the landing folder and compares it with the files recorded in its checkpoint. Files already recorded, such as batch1_part_000.json, are skipped. New files, such as batch2_part_000.json, are read and appended to cdc_orders_bronze, and the checkpoint is updated.',
        nodes: [
          { id: 'old', label: 'batch1_part_000.json', mono: true, sub: 'already processed', col: 0, row: 0, kind: 'box' },
          { id: 'new', label: 'batch2_part_000.json', mono: true, sub: 'new file', col: 0, row: 1, kind: 'box' },
          { id: 'cp', label: 'Flow checkpoint', sub: 'files processed so far', col: 1, row: 0, kind: 'store' },
          { id: 'al', label: 'Auto Loader', sub: 'lists the folder', col: 1, row: 1, kind: 'highlight' },
          { id: 'br', label: 'cdc_orders_bronze', mono: true, sub: 'appends new rows only', col: 2, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'old', to: 'cp', label: 'recorded' },
          { from: 'cp', to: 'al', label: 'skip seen' },
          { from: 'new', to: 'al' },
          { from: 'al', to: 'br' },
          { from: 'al', to: 'cp', label: 'update', dashed: true },
        ],
      },
      examples: [
        {
          label: 'File events instead of directory listing',
          language: 'py',
          code: '# Directory listing is the default. File events scale better for large folders.\n# Needs file events enabled on the external location.\n(spark.readStream.format("cloudFiles")\n  .option("cloudFiles.format", "json")\n  .option("cloudFiles.useManagedFileEvents", "true")\n  .load(LANDING_PATH))',
          notes: ['Do not set cloudFiles.useNotifications together with file events.'],
        },
        {
          label: 'Rewritten files and new columns',
          language: 'py',
          code: '(spark.readStream.format("cloudFiles")\n  .option("cloudFiles.format", "json")\n  # Read a file again when it is overwritten in place (default: false)\n  .option("cloudFiles.allowOverwrites", "true")\n  # New columns go to _rescued_data instead of changing the schema\n  .option("cloudFiles.schemaEvolutionMode", "rescue")\n  .load(LANDING_PATH))',
        },
      ],
    },
    {
      id: 'delta-feed',
      heading: 'Delta streams and the change data feed',
      prose:
        'A streaming read of a Delta table stores the last table version it processed in the flow checkpoint. With readChangeFeed each row also carries _change_type, _commit_version and _commit_timestamp. With row tracking on, Automatic change data feed computes them at query time. With row tracking on the source table, Automatic change data feed works on serverless without delta.enableChangeDataFeed.',
      diagram: {
        type: 'flow',
        title: 'How a Delta stream finds new changes',
        description:
          'Each MERGE on cdc_orders_source creates a Delta table version. The streaming read starts after the version stored in its checkpoint, adds the change columns, and drops update_preimage rows. After the batch it stores the new version.',
        nodes: [
          { id: 'tbl', label: 'cdc_orders_source', mono: true, sub: 'one version per MERGE', col: 0, row: 0, kind: 'store' },
          { id: 'rt', label: 'Row tracking', sub: 'row ids across versions', col: 0, row: 1, kind: 'box' },
          { id: 'rd', label: 'readChangeFeed', mono: true, sub: 'versions after the last', col: 1, row: 0, kind: 'highlight' },
          { id: 'cp', label: 'Flow checkpoint', sub: 'last version processed', col: 1, row: 1, kind: 'store' },
          { id: 'out', label: 'Change rows', sub: 'with change columns', col: 2, row: 0, kind: 'box' },
        ],
        edges: [
          { from: 'tbl', to: 'rd' },
          { from: 'rt', to: 'rd', label: 'computes changes' },
          { from: 'cp', to: 'rd', label: 'start after' },
          { from: 'rd', to: 'out' },
          { from: 'rd', to: 'cp', label: 'store new', dashed: true },
        ],
      },
      examples: [
        {
          label: 'Classic change data feed on a table',
          language: 'sql',
          code: "-- Needed on tables without row tracking, or on engines without Automatic change data feed\nALTER TABLE main.cdc.cdc_orders_source SET TBLPROPERTIES (delta.enableChangeDataFeed = true);\n\n-- Read the changes between two versions\nSELECT * FROM table_changes('main.cdc.cdc_orders_source', 2, 4);",
        },
        {
          label: 'Start a batch read at a version',
          language: 'py',
          code: '(spark.read\n  .option("readChangeFeed", "true")\n  .option("startingVersion", 2)\n  .table("main.cdc.cdc_orders_source"))',
        },
      ],
    },
    {
      id: 'autocdc',
      heading: 'AUTO CDC: key, order, and deletes',
      prose:
        'keys identify the row. sequence_by orders the events, so a late event with a lower LSN loses to one already applied. apply_as_deletes marks the delete events. The flow name is its checkpoint identity: rename a flow or its table and it starts from a fresh checkpoint.',
      diagram: {
        type: 'flow',
        title: 'What each AUTO CDC argument decides',
        description:
          'A change event arrives with an order id, an LSN and an operation. keys picks the target row. sequence_by keeps the event with the highest LSN. apply_as_deletes removes the row when op is d. The result is the latest state in cdc_orders_scd1.',
        nodes: [
          { id: 'ev', label: 'Change event', sub: 'op c, u, d, plus LSN', col: 0, row: 1, kind: 'box' },
          { id: 'k', label: 'keys', mono: true, sub: 'order_id picks the row', col: 1, row: 0, kind: 'highlight' },
          { id: 'sq', label: 'sequence_by', mono: true, sub: 'highest LSN wins', col: 1, row: 1, kind: 'highlight' },
          { id: 'dl', label: 'apply_as_deletes', mono: true, sub: "op = 'd' removes it", col: 1, row: 2, kind: 'highlight' },
          { id: 'tg', label: 'cdc_orders_scd1', mono: true, sub: 'latest state per order', col: 2, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'ev', to: 'k' },
          { from: 'ev', to: 'sq' },
          { from: 'ev', to: 'dl' },
          { from: 'k', to: 'tg' },
          { from: 'sq', to: 'tg' },
          { from: 'dl', to: 'tg' },
        ],
      },
      examples: [
        {
          label: 'Same flow in SQL, with truncates and a tie-breaker',
          language: 'sql',
          code: "CREATE FLOW orders_flow AS AUTO CDC INTO orders_scd1\nFROM STREAM(orders_feed)\nKEYS (order_id)\nAPPLY AS DELETE WHEN op = 'd'\nAPPLY AS TRUNCATE WHEN op = 't'   -- SCD type 1 only\nSEQUENCE BY STRUCT(lsn, source_ts)\nCOLUMNS * EXCEPT (op, lsn)\nSTORED AS SCD TYPE 1;",
        },
        {
          label: 'Type 2 with history on every column except some',
          language: 'py',
          code: 'dp.create_auto_cdc_flow(\n    target="orders_scd2",\n    source="orders_feed",\n    keys=["order_id"],\n    sequence_by="lsn",\n    stored_as_scd_type=2,\n    track_history_except_column_list=["channel", "updated_at"],\n)',
        },
      ],
    },
    {
      id: 'snapshot',
      heading: 'Snapshot CDC: compare with the last snapshot',
      prose:
        'A snapshot has no change column. create_auto_cdc_from_snapshot_flow compares each new snapshot with the previous one by key and derives the inserts, updates and deletes. It reports no row metrics, so check its duration and final counts.',
      diagram: {
        type: 'flow',
        title: 'How the snapshot flow finds changes',
        description:
          'The flow keeps the previous snapshot. Each update it compares the new snapshot with the previous one by order_id, derives inserts, updates and deletes, and applies them to cdc_orders_snapshot_scd2 as type 2 versions.',
        nodes: [
          { id: 'prev', label: 'Previous snapshot', sub: 'kept by the flow', col: 0, row: 0, kind: 'store' },
          { id: 'cur', label: 'cdc_orders_snapshot', mono: true, sub: 'replaced each run', col: 0, row: 1, kind: 'store' },
          { id: 'cmp', label: 'Compare by key', sub: 'order_id', col: 1, row: 0, kind: 'highlight' },
          { id: 'chg', label: 'Derived changes', sub: 'inserts, updates, deletes', col: 2, row: 0, kind: 'box' },
          { id: 'tg', label: 'cdc_orders_snapshot_scd2', mono: true, sub: 'SCD 2 versions', col: 2, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'prev', to: 'cmp' },
          { from: 'cur', to: 'cmp' },
          { from: 'cmp', to: 'chg' },
          { from: 'chg', to: 'tg' },
        ],
      },
      examples: [
        {
          label: 'Replay historical snapshots with a version',
          language: 'py',
          code: 'def next_snapshot_and_version(latest_version):\n    # latest_version is None on the first run\n    if latest_version is None:\n        return (spark.read.load("/Volumes/main/cdc/dumps/orders_v1.parquet"), 1)\n    return None  # caught up\n\ndp.create_auto_cdc_from_snapshot_flow(\n    target="orders_scd2",\n    source=next_snapshot_and_version,\n    keys=["order_id"],\n    stored_as_scd_type=2,\n)',
        },
      ],
    },
    {
      id: 'matview',
      heading: 'Materialized view: refresh only what changed',
      prose:
        'cdc_orders_daily aggregates the type 1 table. On serverless, with row tracking on its source, each update plans how to refresh it and picks incremental maintenance when it can. The planning_information event records the choice. When the update is a full refresh, or the query is not supported, it recomputes completely.',
      diagram: {
        type: 'flow',
        title: 'How a materialized view picks its refresh',
        description:
          'The planner reads the changed rows of cdc_orders_scd1 from the Delta log and row tracking. If the query supports it, it refreshes incrementally with GROUP_AGGREGATE. After a full refresh, or if it cannot tell what changed, it chooses COMPLETE_RECOMPUTE.',
        nodes: [
          { id: 'src', label: 'cdc_orders_scd1', mono: true, sub: 'row tracking on', col: 0, row: 0, kind: 'store' },
          { id: 'log', label: 'Delta log', sub: 'which rows changed', col: 0, row: 1, kind: 'box' },
          { id: 'pl', label: 'Planner', sub: 'chooses how to refresh', col: 1, row: 0, kind: 'highlight' },
          { id: 'inc', label: 'GROUP_AGGREGATE', mono: true, sub: 'incremental', col: 2, row: 0, kind: 'surface' },
          { id: 'full', label: 'COMPLETE_RECOMPUTE', mono: true, sub: 'full refresh or no plan', col: 2, row: 1, kind: 'gate' },
        ],
        edges: [
          { from: 'src', to: 'pl' },
          { from: 'log', to: 'pl' },
          { from: 'pl', to: 'inc', label: 'when it can' },
          { from: 'pl', to: 'full', label: 'otherwise', dashed: true },
        ],
      },
    },
    {
      id: 'full-refresh',
      heading: 'Full refresh: clear and reprocess',
      prose:
        'A full refresh recomputes materialized views, clears streaming tables, clears the flow checkpoints, and reprocesses whatever the source still holds. A table with pipelines.reset.allowed = false is skipped. Two cheaper options exist: a selective full refresh of named tables, and a checkpoint reset that keeps the data. Rebuilding an SCD type 2 target this way recreates history only from what the source holds.',
      diagram: {
        type: 'flow',
        title: 'What a full refresh does',
        description:
          'A full refresh truncates streaming tables and recomputes materialized views, clears every flow checkpoint, then reprocesses what the sources still hold. cdc_orders_bronze has pipelines.reset.allowed false, so it is skipped and keeps its rows.',
        nodes: [
          { id: 'fr', label: 'Full refresh', sub: 'run on purpose', col: 0, row: 1, kind: 'highlight' },
          { id: 'tr', label: 'Clear tables', sub: 'streaming tables and MVs', col: 1, row: 0, kind: 'box' },
          { id: 'ck', label: 'Clear checkpoints', sub: 'every flow', col: 1, row: 1, kind: 'box' },
          { id: 'br', label: 'cdc_orders_bronze', mono: true, sub: 'reset.allowed = false', col: 1, row: 2, kind: 'gate' },
          { id: 're', label: 'Reprocess the source', sub: 'only what it still holds', col: 2, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'fr', to: 'tr' },
          { from: 'fr', to: 'ck' },
          { from: 'fr', to: 'br', label: 'skipped', dashed: true },
          { from: 'tr', to: 're' },
          { from: 'ck', to: 're' },
        ],
      },
      examples: [
        {
          label: 'Reset a flow checkpoint but keep its data',
          language: 'yml',
          code: 'pipeline_task:\n  pipeline_id: ${resources.pipelines.capability_guides_cdc_pipeline.id}\n  reset_checkpoint_selection:\n    - ${var.catalog}.${var.schema}.cdc_orders_scd1_flow',
          notes: ['Flow names must be fully qualified. The table keeps its rows and the flow reads the source again.'],
        },
        {
          label: 'Refresh named tables from a notebook',
          language: 'py',
          code: 'w.pipelines.start_update(\n    pipeline_id=pipeline_id,\n    refresh_selection=["cdc_orders_scd1"],              # normal refresh\n    full_refresh_selection=["cdc_orders_daily"],       # full refresh\n)',
        },
      ],
    },
    {
      id: 'eventlog',
      heading: 'How the second update knew where to start',
      prose:
        'The pipeline event log shows it. Each streaming flow resumes at the offset where its previous update ended: the file-queue position for Auto Loader, the table version for a Delta source. Query the log to confirm an update read only new input and to see which refresh technique a materialized view used.',
      steps: [
        {
          title: 'Read the events',
          body: 'Query event_log for the pipeline. flow_progress carries rows written and expectation counts, and planning_information carries the refresh technique of a materialized view.',
        },
        {
          title: 'Read the offsets',
          body: 'stream_progress shows where each streaming flow started and stopped: table versions for Delta sources, a file-queue position for Auto Loader.',
        },
      ],
      examples: [
        {
          label: 'Maintenance type of a materialized view update',
          language: 'sql',
          code: "SELECT origin.update_id, timestamp,\n       details:planning_information.technique_information\nFROM event_log(TABLE(main.cdc.cdc_orders_daily))\nWHERE event_type = 'planning_information'\nORDER BY timestamp DESC;",
        },
      ],
    },
    {
      id: 'defaults',
      heading: 'Production defaults',
      points: [
        {
          strong: 'Validate bronze with expectations.',
          text: 'A null key or a null sequence value breaks ordering. Drop or fail those rows before AUTO CDC sees them.',
        },
        {
          strong: 'Ingest databases with Lakeflow Connect.',
          text: 'Managed connectors read change data from supported databases, such as SQL Server, into streaming tables, so you skip the Debezium and file landing layer.',
        },
        {
          strong: 'Use serverless pipelines.',
          text: 'Serverless is required for incremental materialized view refresh and removes autoscaling tuning. Use enhanced autoscaling only if you must stay on classic compute.',
        },
        {
          strong: 'Cluster and maintain the targets.',
          text: 'Use CLUSTER BY AUTO on large AUTO CDC targets and leave maintenance to predictive optimization.',
        },
        {
          strong: 'Use file events for large landing folders.',
          text: 'cloudFiles.useManagedFileEvents avoids listing the whole folder on every update.',
        },
      ],
      links: [
        {
          label: 'AUTO CDC in Lakeflow Spark Declarative Pipelines',
          url: 'https://docs.databricks.com/aws/en/ldp/cdc',
        },
        {
          label: 'Auto Loader',
          url: 'https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/',
        },
        {
          label: 'Pipeline event log',
          url: 'https://docs.databricks.com/aws/en/ldp/monitor-event-logs',
        },
      ],
    },
    {
      id: 'choose',
      heading: 'Choosing a refresh mode',
      table: {
        caption: 'When to use each',
        columns: ['Situation', 'Use'],
        rows: [
          ['New data arrived', 'An incremental update, the default.'],
          ['Streaming logic changed and old rows are wrong', 'A full refresh of that table, if its source still holds all the history. Otherwise reset the checkpoint or backfill, and keep the data.'],
          ['A schema change the table cannot absorb', 'A full refresh of the affected tables.'],
          ['Backfill a type 1 target', 'A one-time AUTO CDC backfill flow, not a full refresh.'],
          ['A materialized view is stale or its logic changed', 'A selective full refresh of that view.'],
          ['A table must never be cleared', 'pipelines.reset.allowed = false.'],
        ],
      },
    },
  ],
  related: [
    { slug: 'scd-change-capture', title: 'SCD and change capture' },
    { slug: 'transformation-patterns', title: 'Transformation patterns' },
  ],
};
