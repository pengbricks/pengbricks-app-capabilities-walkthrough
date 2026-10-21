import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'file-format-ingestion',
  area: 'Ingestion',
  title: 'File format ingestion',
  intro:
    'Files arrive as CSV, delimited text, Excel, JSON, XML, and PDFs, and each needs a few format options. Land them with Auto Loader or read_files into Delta tables, keep the schema flexible without losing data, and verify what landed. This page covers the options per format, how schemas and state are managed, how to discover new files, and when to use JSON as a Variant or parse documents with ai_parse_document.',
  businessValue: {
    summary:
      'Files from partners and internal systems land in governed Delta tables without custom parsers. Analysts can query CSV, Excel, JSON, XML, and PDF content as tables.',
    outcomes: [
      {
        title: 'New files load on their own',
        body: 'Auto Loader tracks which files it has read and ingests each once, so no one writes or watches a file tracker.',
      },
      {
        title: 'Schema surprises do not lose data',
        body: 'When a partner adds a column or sends a value that does not fit, it lands in _rescued_data for review instead of being dropped.',
      },
      {
        title: 'Documents become queryable',
        body: 'ai_parse_document turns PDFs and scans into structured text that lands in tables, so staff stop retyping content from documents.',
      },
      {
        title: 'Cheaper file discovery',
        body: 'With file events on the external location, Auto Loader learns of new files from storage events instead of listing the directory, which is cheaper on large landing zones.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'One pattern, different options.',
      body: 'CSV, delimited text, Excel, JSON, and XML all load with read_files in a streaming table, which uses Auto Loader. Only the format options differ.',
    },
    {
      title: 'Choose read_files or Auto Loader by control.',
      body: 'Use read_files in SQL for pipelines, ad hoc queries, and simple streaming tables. Use the cloudFiles reader in Python when you need foreachBatch, custom state handling, or options read_files does not expose.',
    },
    {
      title: 'Discover files with file events.',
      body: 'Enable file events on the external location and Auto Loader finds new files from storage events instead of listing the directory.',
    },
    {
      title: 'Keep schema drift safe.',
      body: 'Pin the types you care about with schemaHints, choose a schemaEvolutionMode, and let anything that does not fit land in _rescued_data.',
    },
    {
      title: 'Use Variant for volatile JSON and ai_parse_document for documents.',
      body: 'Land JSON whose shape changes as a VARIANT column and shred stable fields later. Turn PDFs and scans into structured text with ai_parse_document.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'From landing folder to tables',
      prose:
        'Put each format in its own folder in a Unity Catalog volume or external location. One streaming table per folder reads with the options its format needs. Materialized views then explode arrays and repeating nodes into rows.',
      diagram: {
        type: 'flow',
        title: 'File formats into Delta',
        description:
          'Files in CSV, pipe-delimited, Excel, nested JSON, and XML formats sit in separate folders of a landing volume. A Lakeflow Spark Declarative Pipeline reads each folder with Auto Loader into a streaming table. Materialized views explode the JSON arrays and the XML repeating nodes into one row per element.',
        lanes: [
          { label: 'Landing volume', fromRow: 0, toRow: 0 },
          { label: 'Lakeflow pipeline', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'csv', label: 'csv/', mono: true, sub: 'header, typed columns', col: 0, row: 0, kind: 'store' },
          { id: 'pipe', label: 'delimited/', mono: true, sub: 'custom delimiter', col: 1, row: 0, kind: 'store' },
          { id: 'xlsx', label: 'excel/', mono: true, sub: 'workbooks', col: 2, row: 0, kind: 'store' },
          { id: 'json', label: 'json/', mono: true, sub: 'nested documents', col: 3, row: 0, kind: 'store' },
          { id: 'xml', label: 'xml/', mono: true, sub: 'repeating nodes', col: 4, row: 0, kind: 'store' },
          { id: 't1', label: 'CSV table', col: 0, row: 1 },
          { id: 't2', label: 'Delimited table', col: 1, row: 1 },
          { id: 't3', label: 'Excel table', col: 2, row: 1 },
          { id: 't4', label: 'JSON table', col: 3, row: 1 },
          { id: 't5', label: 'XML table', col: 4, row: 1 },
          { id: 'v4', label: 'Contacts view', sub: 'one row per element', col: 3, row: 2, kind: 'highlight' },
          { id: 'v5', label: 'Order lines view', sub: 'one row per element', col: 4, row: 2, kind: 'highlight' },
        ],
        edges: [
          { from: 'csv', to: 't1' },
          { from: 'pipe', to: 't2' },
          { from: 'xlsx', to: 't3' },
          { from: 'json', to: 't4' },
          { from: 'xml', to: 't5' },
          { from: 't4', to: 'v4' },
          { from: 't5', to: 'v5' },
        ],
        legend: [
          { kind: 'store', label: 'Folder in the volume' },
          { kind: 'highlight', label: 'Materialized view that explodes an array' },
        ],
        caption: 'Tables on the middle row are Auto Loader streaming tables.',
      },
    },
    {
      id: 'discovery',
      heading: 'Finding files and choosing a reader',
      points: [
        {
          strong: 'File events.',
          text: 'For a path on a Unity Catalog external location with file events enabled, Auto Loader reads change notifications instead of listing the directory. Set cloudFiles.useManagedFileEvents to true, or rely on the if_available default. Discovery stays fast as the folder grows.',
        },
        {
          strong: 'read_files.',
          text: 'A SQL table-valued function. With STREAM in a streaming table it runs on Auto Loader and keeps a checkpoint. Without STREAM it is a one-time batch read, good for exploring a folder or a one-off load.',
        },
        {
          strong: 'Auto Loader (cloudFiles) in Python.',
          text: 'The same engine with the full option set. Choose it for foreachBatch writes, custom post-processing, or when you manage the checkpoint and schema location yourself outside a pipeline.',
        },
        {
          strong: 'Variant for JSON that changes shape.',
          text: 'Parse the document into a VARIANT column with parse_json and read fields with the : path syntax. New keys and type changes do not break the load. Promote stable fields to typed columns in silver.',
        },
        {
          strong: 'ai_parse_document for PDFs, scans, and Office files.',
          text: 'Read binary files from a volume and parse them to structured text and layout in SQL. Store the parsed output in a table, then extract fields from it. See the AI Functions guide.',
        },
      ],
      examples: [
        {
          label: 'JSON as Variant, then parse documents',
          language: 'sql',
          code: `-- Raw JSON Lines kept intact as a VARIANT
CREATE OR REFRESH STREAMING TABLE events_raw AS
SELECT parse_json(value) AS payload, _metadata.file_path AS source_file
FROM STREAM read_files('/Volumes/main/ingest/landing/events/', format => 'text');

SELECT payload:customer.id::INT AS customer_id, payload:items[0].sku::STRING AS first_sku
FROM events_raw;

-- Documents in a volume parsed to structured content
SELECT path, ai_parse_document(content) AS parsed
FROM read_files('/Volumes/main/ingest/docs/', format => 'binaryFile');`,
          notes: ['Use ai_parse_document output as input to ai_extract or AI Search indexing.'],
        },
      ],
      options: {
        caption: 'How Auto Loader finds new files',
        rows: [
          {
            option: 'File events on a Unity Catalog external location',
            when: 'The path is on a Unity Catalog external location, or a volume on one, where you can enable file events.',
            tradeoffs:
              'Learns about new files from storage events instead of listing, so discovery stays fast as the folder grows. The docs describe it as more performant and scalable than listing and recommend it for most workloads. It needs file events enabled on the external location, a one-time admin step.',
          },
          {
            option: 'Directory listing',
            when: 'Quick start, a small folder, or a path where file events are not available.',
            tradeoffs:
              'Needs no permissions beyond read access to the data. Each run lists the input directory, so cost and time grow with the number of files and folders. Auto Loader reduces listing calls when files arrive in lexical order.',
          },
          {
            option: 'File notification mode without file events',
            when: 'Legacy streams that already run on queue services you set up in your own cloud account.',
            tradeoffs:
              'Scales better than listing, but Auto Loader creates and manages notification and queue resources in your cloud account, which needs extra permissions. It is not supported for Unity Catalog volumes, so prefer file events for new work.',
          },
        ],
        recommendation:
          'Enable file events on the external location and use them. Fall back to directory listing for small folders or paths where file events are unavailable.',
      },
      links: [
        { label: 'Auto Loader file events', url: 'https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/file-events-explained' },
        { label: 'Auto Loader file detection modes', url: 'https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/file-detection-modes' },
        { label: 'Query variant data', url: 'https://docs.databricks.com/aws/en/semi-structured/variant' },
        { label: 'read_files table-valued function', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/read_files' },
      ],
    },
    {
      id: 'options',
      heading: 'What each format needed',
      prose: 'The default settings cover CSV. The other four formats each needed one or two options.',
      table: {
        columns: ['Format', 'read_files options and why'],
        rows: [
          ['CSV', "header; schemaHints for DECIMAL(12,2) and DATE columns"],
          ['Pipe-delimited', "delimiter '|' and quote '\"' so a pipe inside quotes stays in its field"],
          ['Excel', "dataAddress 'Orders' picks the sheet; schemaEvolutionMode 'none' (required for Excel); schemaHints keep dates as DATE"],
          ['Nested JSON', 'multiLine for a pretty-printed array; struct and array columns arrive as written'],
          ['XML', "rowTag 'order'; attributes arrive with an underscore prefix; a missing <coupon> is NULL"],
        ],
      },
    },
    {
      id: 'schemas',
      heading: 'How schemas are managed',
      prose:
        'Three settings decide a table\'s columns. Inference reads a sample of the files and guesses names and types. schemaHints pins the types you care about and leaves the rest to inference. schemaEvolutionMode decides what happens when a later file brings a column the table does not have. Anything that does not fit lands in _rescued_data instead of being dropped.',
      options: {
        caption: 'schemaEvolutionMode values for Auto Loader and read_files',
        rows: [
          {
            option: 'addNewColumns',
            when: 'Default when you give no schema. The source adds columns over time and you want them as real columns.',
            tradeoffs:
              'The update stops once, the column is added to the stored schema, and the next attempt picks it up, so a pipeline with retries recovers on its own. Downstream tables that select columns by name will not see the new column until you change them.',
          },
          {
            option: 'rescue',
            when: 'The schema must stay fixed, and the stream must keep running when the source changes.',
            tradeoffs:
              'The new column lands as JSON in _rescued_data and the stream keeps running, so there is no outage. Someone must watch _rescued_data and decide when to widen the schema, or the data stays buried in JSON.',
          },
          {
            option: 'failOnNewColumns',
            when: 'A new column should block the load until someone reviews it.',
            tradeoffs:
              'The update fails and stays failed until you change the schema or the files. The strictest control, at the cost of an outage whenever a sender changes a file.',
          },
          {
            option: 'none',
            when: 'Default when you give a schema. Also required for Excel.',
            tradeoffs:
              'New columns are ignored, and nothing is rescued unless you set rescuedDataColumn. Predictable, but data in new columns is lost unless you capture it.',
          },
        ],
        recommendation:
          'Use addNewColumns for trusted internal sources, and rescue for partner files where the stream must not stop. Use failOnNewColumns where schema changes need approval. Set rescuedDataColumn whenever you use none.',
      },
      points: [
        {
          strong: 'Hints, not a full schema.',
          text: 'Every format here except XML uses schemaHints for the columns that must be DECIMAL(12,2), DATE, or INT. Inference still finds the other columns, so a new optional column does not need a code change.',
        },
        {
          strong: 'Rescued data is a column, not a log.',
          text: 'A value that cannot be cast, or a column the schema does not have, is written to _rescued_data as JSON next to the rest of the row. The verify task counts rows where it is not null and expects zero.',
        },
        {
          strong: 'Excel is the exception.',
          text: 'The Excel reader does not evolve or rescue, so the table sets schemaEvolutionMode to none and relies on hints and the row-count check.',
        },
      ],
      examples: [
        {
          label: 'Keep the stream running and park surprises in _rescued_data',
          language: 'sql',
          code: `CREATE OR REFRESH STREAMING TABLE fmt_customers_csv AS
SELECT * FROM STREAM read_files(
  '\${formats_path}/csv/',
  format => 'csv',
  header => true,
  schemaHints => 'customer_id INT, credit_limit DECIMAL(12,2)',
  schemaEvolutionMode => 'rescue',
  rescuedDataColumn => '_rescued_data'
);

-- Rows that carried a new column or a value that would not cast
SELECT customer_id, _rescued_data
FROM fmt_customers_csv
WHERE _rescued_data IS NOT NULL;`,
          notes: ['rescue freezes the schema. A column added upstream shows up as a key inside the JSON in _rescued_data.'],
        },
        {
          label: 'Add new columns automatically, or fail on them',
          language: 'sql',
          code: `-- addNewColumns: the default when no schema is given
FROM STREAM read_files('\${formats_path}/json/', format => 'json', multiLine => true,
  schemaEvolutionMode => 'addNewColumns')

-- failOnNewColumns: stop the update when a column appears
FROM STREAM read_files('\${formats_path}/json/', format => 'json', multiLine => true,
  schemaEvolutionMode => 'failOnNewColumns')`,
          notes: ['These are two alternatives for the FROM clause of fmt_customers_json. Pick one.'],
        },
        {
          label: 'Fix the whole schema, or turn inference off',
          language: 'sql',
          code: `-- A full schema: schemaEvolutionMode defaults to none
FROM STREAM read_files('\${formats_path}/csv/', format => 'csv', header => true,
  schema => 'customer_id INT, name STRING, credit_limit DECIMAL(12,2), created_date DATE')

-- No type inference: every CSV or JSON column arrives as STRING
FROM STREAM read_files('\${formats_path}/csv/', format => 'csv', header => true,
  inferColumnTypes => false)`,
        },
      ],
      links: [
        { label: 'Configure schema inference and evolution in Auto Loader', url: 'https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/schema' },
      ],
    },
    {
      id: 'state',
      heading: 'Where the schema location and checkpoint live',
      prose:
        'In a pipeline you do not set cloudFiles.schemaLocation or a checkpoint path. Each Auto Loader streaming table keeps its own checkpoint and inferred schema in storage the pipeline manages, and the pipeline definition only supplies parameters. That state is why a rerun reads only new files and why a changed schema survives restarts.',
      points: [
        {
          strong: 'Nothing to configure in the SQL.',
          text: 'The read_files calls on this page have no schema location and no checkpoint option. The pipeline creates both per table.',
        },
        {
          strong: 'Parameters, not paths to state.',
          text: 'Pass the folder and sheet as pipeline configuration values and read them in SQL as ${formats_path}. Changing the value points the same tables at another folder or sheet, per environment.',
        },
        {
          strong: 'Full refresh resets it.',
          text: 'A full refresh clears each table\'s checkpoint and inferred schema, so the files are read again and the schema is inferred again. Use it deliberately, and protect tables whose source files expire.',
        },
      ],
      examples: [
        {
          label: 'The same read in Python, still without a schema location',
          language: 'py',
          code: `from pyspark import pipelines as dp

@dp.table(name="fmt_customers_csv")
def fmt_customers_csv():
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "csv")
        .option("header", "true")
        .option("cloudFiles.schemaHints", "customer_id INT, credit_limit DECIMAL(12,2)")
        .option("cloudFiles.schemaEvolutionMode", "rescue")
        .load(spark.conf.get("formats_path") + "/csv/")
    )`,
          notes: ['Outside a pipeline, set cloudFiles.schemaLocation and checkpointLocation yourself.'],
        },
      ],
    },
    {
      id: 'checks',
      heading: 'Verify what landed',
      prose:
        'Check each table against what the source promised, and fail the load on a mismatch. Silent loss is the failure to rule out.',
      points: [
        {
          strong: 'Row counts.',
          text: 'Compare rows loaded with rows in the source files, or with a control total the sender provides.',
        },
        {
          strong: 'Types.',
          text: 'Assert the key columns have the types you pinned with schemaHints, so a drifting source does not turn a DECIMAL into a STRING.',
        },
        {
          strong: 'Rescued data.',
          text: 'Count rows where _rescued_data is not null. A non-zero count means the file had values or columns the schema did not expect. Decide whether to alert, quarantine, or widen the schema.',
        },
        {
          strong: 'Format-specific traps.',
          text: 'Check that embedded delimiters stayed in their field, that only the intended Excel sheet loaded, and that optional XML nodes are null instead of shifting columns.',
        },
        {
          strong: 'Excel has no rescued column.',
          text: 'The Excel reader requires schemaEvolutionMode none, so rely on type hints and the row-count check.',
        },
      ],
    },
    {
      id: 'tricks',
      heading: 'Details that cost time',
      points: [
        {
          strong: 'Volumes and zip files.',
          text: 'An .xlsx file is a zip archive, and a volume path rejects the random-access writes a zip needs. Write a workbook to local disk first, then copy it to the volume.',
        },
        {
          strong: 'Single-cell Excel ranges.',
          text: "dataAddress accepts 'Orders' or 'Orders!A1:G1001'. 'Orders!A1' is read as a sheet name and fails.",
        },
        {
          strong: 'Excel types.',
          text: 'Without hints, the sheet infers bigint and timestamp_ntz. The hints make the table match the other formats.',
        },
        {
          strong: 'Reruns.',
          text: 'For files that arrive over time, run normal updates and Auto Loader reads only new files. Use a full refresh only to rebuild a table from scratch.',
        },
      ],
    },
  ],
  related: [
    { slug: 'sftp-ingestion', title: 'SFTP file retrieval' },
    { slug: 'multi-source-pipeline', title: 'Multi-source pipeline' },
    { slug: 'ai-functions', title: 'AI Functions in SQL' },
  ],
};
