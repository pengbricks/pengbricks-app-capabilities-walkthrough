import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'file-format-ingestion',
  area: 'Ingestion',
  title: 'File format ingestion',
  intro:
    'One job generates a file in each of five formats from the use-case spec, ingests them with one Lakeflow Declarative Pipeline, and checks every table against the spec. The files are chosen to be awkward on purpose: quoted delimiters, an extra Excel sheet, nested JSON, and XML with a repeating node and an optional node.',
  shortVersion: [
    {
      title: 'Five formats, one pipeline.',
      body: 'CSV, pipe-delimited text, Excel, nested JSON, and XML all use read_files with Auto Loader. Only the options differ.',
    },
    {
      title: 'Quotes protect delimiters.',
      body: 'In the pipe-delimited file, 301 of 1,000 notes contain a pipe inside double quotes. All 1,000 rows keep the same columns.',
    },
    {
      title: 'Excel reads one sheet.',
      body: 'dataAddress names the Orders sheet. The README and Products sheets in the same workbook add no rows or columns.',
    },
    {
      title: 'Nested and repeating data stays queryable.',
      body: 'JSON keeps a struct and an array, XML keeps repeating <line> nodes, and two materialized views explode them to rows.',
    },
    {
      title: 'Nothing is dropped silently.',
      body: 'The verify task checks counts, types, and rescued data for every table and fails the job on a mismatch.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'From spec to tables',
      prose:
        'The job generates sample rows from the spec with a fixed seed. Plain Python writers shape them into each format and copy the files to a volume. The pipeline reads each folder with the options its format needs.',
      diagram: {
        type: 'flow',
        title: 'The file format job',
        description:
          'generate_files writes customers.csv, orders.txt, orders_workbook.xlsx, customers_nested.json, and orders.xml into folders in the source_landing volume. The ingest_formats pipeline reads each folder with Auto Loader into fmt_customers_csv, fmt_orders_pipe, fmt_orders_excel, fmt_customers_json, and fmt_orders_xml. Two materialized views explode the JSON contacts and the XML lines. verify_tables compares every table with the spec and writes format_ingestion_checks.',
        lanes: [
          { label: 'Landing volume', fromRow: 0, toRow: 0 },
          { label: 'Lakeflow Declarative Pipeline', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'csv', label: 'csv/', mono: true, sub: 'customers.csv', col: 0, row: 0, kind: 'store' },
          { id: 'pipe', label: 'pipe/', mono: true, sub: 'orders.txt', col: 1, row: 0, kind: 'store' },
          { id: 'xlsx', label: 'excel/', mono: true, sub: '3-sheet workbook', col: 2, row: 0, kind: 'store' },
          { id: 'json', label: 'json/', mono: true, sub: 'nested documents', col: 3, row: 0, kind: 'store' },
          { id: 'xml', label: 'xml/', mono: true, sub: 'orders.xml', col: 4, row: 0, kind: 'store' },
          { id: 't1', label: 'fmt_customers_csv', mono: true, col: 0, row: 1 },
          { id: 't2', label: 'fmt_orders_pipe', mono: true, col: 1, row: 1 },
          { id: 't3', label: 'fmt_orders_excel', mono: true, col: 2, row: 1 },
          { id: 't4', label: 'fmt_customers_json', mono: true, col: 3, row: 1 },
          { id: 't5', label: 'fmt_orders_xml', mono: true, col: 4, row: 1 },
          { id: 'v4', label: 'fmt_json_contacts', mono: true, sub: 'one row per contact', col: 3, row: 2, kind: 'highlight' },
          { id: 'v5', label: 'fmt_xml_order_lines', mono: true, sub: 'one row per line', col: 4, row: 2, kind: 'highlight' },
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
        caption: 'Tables on row 1 are Auto Loader streaming tables.',
      },
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
      table: {
        caption: 'schemaEvolutionMode values for Auto Loader and read_files',
        columns: ['Mode', 'When a new column shows up'],
        rows: [
          ['addNewColumns', 'Default when you give no schema. The update stops once, the column is added to the stored schema, and the next attempt picks it up.'],
          ['rescue', 'The schema never changes. The new column lands as JSON in _rescued_data and the stream keeps running.'],
          ['failOnNewColumns', 'The update fails and stays failed until you change the schema or the files. Use it when a new column should block the load.'],
          ['none', 'Default when you give a schema. New columns are ignored, and nothing is rescued unless you set rescuedDataColumn. Excel requires this mode.'],
        ],
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
    },
    {
      id: 'state',
      heading: 'Where the schema location and checkpoint live',
      prose:
        'In a pipeline you do not set cloudFiles.schemaLocation or a checkpoint path. Each Auto Loader streaming table keeps its own checkpoint and inferred schema in storage the pipeline manages, and the pipeline definition only supplies parameters. That state is why a rerun reads only new files and why a changed schema survives restarts.',
      points: [
        {
          strong: 'Nothing to configure in the SQL.',
          text: 'The read_files calls above have no schema location and no checkpoint option. The pipeline creates both per table.',
        },
        {
          strong: 'Parameters, not paths to state.',
          text: 'The pipeline YAML passes formats_path and excel_sheet, and the SQL reads them as ${formats_path} and ${excel_sheet}. Changing them points the same tables at another folder or sheet.',
        },
        {
          strong: 'Full refresh resets it.',
          text: 'The job runs the pipeline with full_refresh. That clears each table\'s checkpoint and inferred schema, so the files are read again and the schema is inferred again. Drop it for files that arrive over time.',
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
      heading: 'What the checks found',
      prose:
        'Expected values come from the same rules that write the files, so a check compares the table with what the generator promised.',
      diagram: {
        type: 'matrix',
        title: 'Rows, types, and rescued data by format',
        description:
          'The CSV table has 200 rows, decimal and date types, and no rescued rows. The pipe-delimited table has 1000 rows, 301 notes with an embedded pipe, and no rescued rows. The Excel table has 1000 rows from the Orders sheet only. The JSON table has 200 documents, 267 contacts, and 40 loyalty structs, with no rescued rows. The XML table has 100 orders, 250 lines, and 25 coupons, with no rescued rows.',
        corner: 'Format ↓ · Result →',
        columns: ['Rows', 'Tricky part', 'Rescued rows'],
        rows: [
          {
            label: 'CSV',
            sub: 'fmt_customers_csv',
            cells: [
              { state: 'own', text: '200' },
              { state: 'own', text: 'decimal(12,2), date' },
              { state: 'none', text: '0' },
            ],
          },
          {
            label: 'Pipe-delimited',
            sub: 'fmt_orders_pipe',
            cells: [
              { state: 'own', text: '1,000' },
              { state: 'own', text: '301 quoted pipes' },
              { state: 'none', text: '0' },
            ],
          },
          {
            label: 'Excel',
            sub: 'fmt_orders_excel',
            cells: [
              { state: 'own', text: '1,000' },
              { state: 'own', text: 'Orders sheet only' },
              { state: 'optional', text: 'no column' },
            ],
          },
          {
            label: 'Nested JSON',
            sub: 'fmt_customers_json',
            cells: [
              { state: 'own', text: '200' },
              { state: 'own', text: '267 contacts, 40 loyalty' },
              { state: 'none', text: '0' },
            ],
          },
          {
            label: 'XML',
            sub: 'fmt_orders_xml',
            cells: [
              { state: 'own', text: '100' },
              { state: 'own', text: '250 lines, 25 coupons' },
              { state: 'none', text: '0' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Matches the spec' },
          { state: 'none', label: 'Zero rows rescued' },
          { state: 'optional', label: 'Excel has no rescued-data column' },
        ],
        caption: 'The Excel table has no _rescued_data column because Excel requires schemaEvolutionMode none. The type hints and the row count cover it instead.',
      },
    },
    {
      id: 'tricks',
      heading: 'Details that cost time',
      points: [
        {
          strong: 'Volumes and zip files.',
          text: 'An .xlsx file is a zip archive, and a volume path rejects the random-access writes a zip needs. The job writes the workbook to local disk and copies it.',
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
          text: 'The job rewrites the files and refreshes the pipeline fully, so counts stay the same. For files that arrive over time, drop the full refresh and Auto Loader reads only new files.',
        },
      ],
    },
  ],
  related: [
    { slug: 'sftp-ingestion', title: 'SFTP file retrieval' },
    { slug: 'multi-source-pipeline', title: 'Multi-source pipeline' },
  ],
};
