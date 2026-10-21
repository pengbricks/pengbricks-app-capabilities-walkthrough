import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'batch-real-time-ingestion',
  area: 'Ingestion',
  title: 'Batch and streaming ingestion',
  intro:
    'The same streaming table definition can run as a scheduled batch, continuously, or in real-time mode. The choice is a trigger setting that trades latency against cost. This page covers how to pick the trigger, how to discover new files and read from message buses, and how checkpoints, watermarks, and backfills keep the result correct.',
  businessValue: {
    summary:
      'Data freshness is a cost choice, set by a trigger on the same pipeline definition. Business owners pay for the latency they need and no more.',
    outcomes: [
      {
        title: 'Pay only for needed speed',
        body: 'A triggered pipeline starts compute, processes new data, and stops. A continuous pipeline keeps compute running around the clock for second-level latency. Pick from the business target.',
      },
      {
        title: 'Tighten freshness later',
        body: 'The same streaming table runs as scheduled batch or continuously. A new latency requirement becomes a setting change, so teams can start cheap without a rewrite.',
      },
      {
        title: 'Reruns do not duplicate data',
        body: 'Checkpoints track progress and keyed MERGE or AUTO CDC let a reprocessed record overwrite itself. A failed run costs a rerun, not a manual cleanup.',
      },
      {
        title: 'Sub-second paths when justified',
        body: 'Real-time mode serves operational uses such as fraud checks or personalization. Most analytics does not need it, and the guide says to leave it off there.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Start triggered; move only when a latency target requires it.',
      body: 'A triggered pipeline or job starts compute, processes what is new, and stops. That is the lowest cost, and its latency is the schedule interval plus startup time.',
    },
    {
      title: 'Continuous trades cost for seconds.',
      body: 'A continuous pipeline keeps compute running and processes data as it arrives, so latency is seconds. You pay for the compute around the clock.',
    },
    {
      title: 'Real-time mode is for sub-second operational paths.',
      body: 'Real-time mode keeps long-running batches and passes data between stages as soon as it is produced. Use it for fraud checks or personalization, not analytics.',
    },
    {
      title: 'Discover files with file events.',
      body: 'Auto Loader with managed file events finds new files from storage events instead of listing the directory. It is faster and cheaper on large landing zones.',
    },
    {
      title: 'Make every rerun safe.',
      body: 'Checkpoints track progress, watermarks bound state, and keyed MERGE or AUTO CDC make a reprocessed record overwrite itself. Backfill with a one-time flow, not by deleting a checkpoint.',
    },
  ],
  sections: [
    {
      id: 'triggers',
      heading: 'Pick the trigger mode',
      prose:
        'Decide from the business latency target, then pay for no more speed than that. Most analytics ETL sits in the first row.',
      diagram: {
        type: 'matrix',
        title: 'Trigger modes compared',
        description:
          'Triggered mode runs on a schedule, has latency of minutes or more, and costs the least because compute stops between runs. Continuous mode keeps a pipeline running, has latency of seconds, and costs a running cluster all day. Real-time mode targets sub-second latency, keeps compute running with enough task slots for every stage, and suits operational decisions.',
        corner: 'Mode ↓ · Trait →',
        columns: ['Latency', 'Compute cost', 'Pick it for'],
        rows: [
          {
            label: 'Triggered',
            sub: 'schedule or file arrival',
            cells: [
              { state: 'optional', text: 'Minutes or more', sub: 'interval plus startup' },
              { state: 'own', text: 'Lowest', sub: 'runs, then stops' },
              { state: 'own', text: 'Analytics ETL', sub: 'hourly, daily, on arrival' },
            ],
          },
          {
            label: 'Continuous',
            sub: 'micro-batch, always on',
            cells: [
              { state: 'own', text: 'Seconds' },
              { state: 'optional', text: 'Always running' },
              { state: 'own', text: 'Fresh dashboards', sub: 'near-real-time views' },
            ],
          },
          {
            label: 'Real-time mode',
            sub: 'long-running batches',
            cells: [
              { state: 'own', text: 'Sub-second to ms' },
              { state: 'none', text: 'Highest', sub: 'dedicated task slots' },
              { state: 'own', text: 'Operational actions', sub: 'fraud, personalization' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Strength' },
          { state: 'optional', label: 'Acceptable trade-off' },
          { state: 'none', label: 'Costly' },
        ],
        caption:
          'Real-time mode needs enough task slots for every stage at once and supports a defined set of sources and sinks. Check the docs for the current release stage.',
      },
      points: [
        {
          strong: 'Triggered.',
          text: 'Set the pipeline to triggered and schedule it with Lakeflow Jobs, or let a file arrival trigger run it. In plain Structured Streaming this is Trigger.AvailableNow.',
        },
        {
          strong: 'Continuous.',
          text: 'Set continuous: true on the pipeline. Latency is the micro-batch interval, and the compute stays on. Pair it with serverless autoscaling so idle periods cost less.',
        },
        {
          strong: 'Real-time mode.',
          text: 'Set the real-time trigger on a Structured Streaming query or enable it in a pipeline. Benchmark the batch duration: longer batches checkpoint less often, so recovery replays more.',
        },
        {
          strong: 'Batch is still a choice.',
          text: 'For a bounded table-to-table load, a scheduled job or a materialized view is simpler than a stream. Use streaming tables when the input is append-only and you want incremental reads.',
        },
      ],
      options: {
        caption: 'What kind of object loads the table',
        rows: [
          {
            option: 'Streaming table',
            when: 'The input is append-only (files, a message bus, or change events) and each row should be processed once.',
            tradeoffs:
              'Reads only new data on each update, so cost tracks the volume of new rows. It does not revisit rows that changed upstream, so updates need AUTO CDC. A full refresh reprocesses the whole source, which matters when the source keeps only recent data.',
          },
          {
            option: 'Materialized view',
            when: 'A bounded table-to-table transformation, such as joins or aggregates, where the result should always match the source.',
            tradeoffs:
              'Written as a query, and results stay correct even when data arrives late or out of order. Databricks refreshes it incrementally when it can and recomputes otherwise, so the cost varies with the query shape. Freshness is the refresh interval.',
          },
          {
            option: 'Scheduled batch job',
            when: 'The logic does not fit a declarative query, such as custom MERGE steps or calls to outside systems.',
            tradeoffs:
              'Most control, since you write the load logic in a Lakeflow Job. You also own the incremental logic, state, and tests, so more code to maintain.',
          },
        ],
        recommendation:
          'Use a streaming table for append-only ingestion and a materialized view for transformations over bounded tables. Write a batch job only when the logic cannot be expressed declaratively.',
      },
      links: [
        { label: 'Real-time mode concepts', url: 'https://docs.databricks.com/aws/en/structured-streaming/real-time/concepts' },
        { label: 'Triggered vs continuous pipeline mode', url: 'https://docs.databricks.com/aws/en/ldp/pipeline-mode' },
        { label: 'Streaming tables', url: 'https://docs.databricks.com/aws/en/ldp/streaming-tables' },
        { label: 'Materialized views', url: 'https://docs.databricks.com/aws/en/ldp/materialized-views' },
      ],
    },
    {
      id: 'stream',
      heading: 'Sources: files, message buses, and direct writes',
      points: [
        {
          strong: 'Files: Auto Loader with file events.',
          text: 'Read from a Unity Catalog external location with file events enabled and set cloudFiles.useManagedFileEvents to true. Auto Loader then learns about new files from storage events instead of listing directories, which cuts discovery time and listing cost. Where file events are available, the default is already if_available. Read with STREAM read_files in SQL or spark.readStream.format("cloudFiles") in Python.',
        },
        {
          strong: 'Message buses: Kafka, Kinesis, Event Hubs.',
          text: 'Read them as streaming sources in a streaming table or Structured Streaming query: format("kafka") for Kafka and for Event Hubs through its Kafka endpoint, and format("kinesis") for Kinesis. Keep credentials in Unity Catalog service credentials or secrets, and land the raw payload in bronze before parsing.',
        },
        {
          strong: 'Direct writes: Zerobus Ingest.',
          text: 'When the producer is your own application or device fleet, Zerobus Ingest in Lakeflow Connect writes records straight to a Unity Catalog Delta table over gRPC with an SDK, with no message bus in between. Pick it when you do not need a bus for fan-out or replay.',
        },
        {
          strong: 'Batch tables.',
          text: 'Incremental loads from tables use change data capture or Lakeflow Connect. See the relational database and SQL Server guides.',
        },
      ],
      examples: [
        {
          label: 'Auto Loader streaming table with expectations',
          language: 'sql',
          code: `CREATE OR REFRESH STREAMING TABLE events_bronze
AS SELECT *, _metadata.file_path AS source_file, current_timestamp() AS ingested_at
FROM STREAM read_files(
  '/Volumes/main/ingest/landing/events',
  format => 'json',
  \`cloudFiles.useManagedFileEvents\` => 'true'
);

CREATE OR REFRESH STREAMING TABLE events_silver (
  CONSTRAINT valid_amount EXPECT (amount >= 0) ON VIOLATION DROP ROW
) AS SELECT * FROM STREAM events_bronze;`,
          notes: [
            'Each update reads only files it has not seen.',
            'Store ingested_at on every row so you can measure end-to-end latency later.',
          ],
        },
        {
          label: 'Read a Kafka topic',
          language: 'python',
          code: `from pyspark import pipelines as dp

@dp.table(name="orders_bronze")
def orders_bronze():
    return (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", spark.conf.get("kafka_servers"))
        .option("subscribe", "orders")
        .option("startingOffsets", "earliest")
        .load()
        .selectExpr("CAST(key AS STRING) AS key", "CAST(value AS STRING) AS value", "timestamp")
    )`,
          notes: ['Add authentication options for your broker. Event Hubs uses its Kafka-compatible endpoint with SASL.'],
        },
      ],
      options: {
        caption: 'How events reach Databricks',
        rows: [
          {
            option: 'Files landed in cloud storage, read with Auto Loader',
            when: 'Producers can write files, and minutes of latency are acceptable.',
            tradeoffs:
              'Cheap, replayable, and easy to debug, since the raw files stay as a record. Latency includes the time producers take to close a file. With file events, discovery stays fast as the folder grows.',
          },
          {
            option: 'A message bus (Kafka, Kinesis, Event Hubs)',
            when: 'Several consumers need the same events, you need replay from offsets, or the bus already exists.',
            tradeoffs:
              'Gives seconds-level latency in practice and supports fan-out and replay within topic retention. You run, size, and secure the bus, and manage offsets and retention.',
          },
          {
            option: 'Zerobus Ingest',
            when: 'Your own application or device fleet is the producer, and you do not need a bus for fan-out or replay.',
            tradeoffs:
              'Writes records straight to a Unity Catalog Delta table over gRPC with an SDK, so there is no bus to run. With no bus, there is no replay buffer, so producers must handle retries. Check the docs for the release stage of each SDK.',
          },
        ],
        recommendation:
          'Use Auto Loader on files when minutes of latency are fine. Use a message bus when it already exists or several consumers need the events. Use Zerobus Ingest for direct application writes with no bus.',
      },
      links: [
        { label: 'Auto Loader file events', url: 'https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/file-events-explained' },
        { label: 'Stream processing with Apache Kafka', url: 'https://docs.databricks.com/aws/en/connect/streaming/kafka' },
        { label: 'Zerobus Ingest', url: 'https://docs.databricks.com/aws/en/ingestion/zerobus-ingest' },
      ],
    },
    {
      id: 'correctness',
      heading: 'Checkpoints, watermarks, and backfills',
      points: [
        {
          strong: 'Checkpoints.',
          text: 'Each streaming table flow and each Structured Streaming query stores its progress in a checkpoint. A restart resumes from it, so you get exactly-once results for Delta sinks. Do not delete a checkpoint to fix a problem; you reprocess everything or lose position.',
        },
        {
          strong: 'Watermarks.',
          text: 'Stateful work such as windowed aggregates, stream-stream joins, and deduplication keeps state per key. Set withWatermark on the event-time column to bound that state and to decide how late a record can arrive before it is dropped. Pick the delay from the observed lateness of your source, not a guess.',
        },
        {
          strong: 'Idempotent writes.',
          text: 'Make a reprocessed record overwrite itself. Use AUTO CDC or MERGE on a business key for upserts, and keep a unique key or load identifier on append-only tables so you can detect duplicates.',
        },
        {
          strong: 'Backfill with a one-time flow.',
          text: 'To load history into a streaming table, add an append flow that runs once (INSERT INTO ... ONCE in SQL, or once=True in Python). It runs next to the live flow without resetting its checkpoint.',
        },
        {
          strong: 'Protect bronze from full refresh.',
          text: 'A full refresh clears the table and reprocesses the source. Set pipelines.reset.allowed to false on bronze tables whose source files or topic retention no longer hold the full history.',
        },
        {
          strong: 'Schema changes.',
          text: 'Auto Loader records new columns and keeps unexpected values in _rescued_data. Choose addNewColumns or rescue mode explicitly for each source.',
        },
      ],
      examples: [
        {
          label: 'One-time backfill flow',
          language: 'sql',
          code: `CREATE STREAMING TABLE events_bronze;

CREATE FLOW live AS INSERT INTO events_bronze BY NAME
SELECT * FROM STREAM read_files('/Volumes/main/ingest/landing/events', format => 'json');

CREATE FLOW history AS INSERT INTO ONCE events_bronze BY NAME
SELECT * FROM read_files('/Volumes/main/ingest/archive/events', format => 'json');`,
          notes: ['The history flow runs once. Keep it in the pipeline source so a full refresh rebuilds the table the same way.'],
        },
      ],
      links: [
        { label: 'Backfill historical data with pipelines', url: 'https://docs.databricks.com/aws/en/ldp/flows-backfill' },
        { label: 'Watermarks in Structured Streaming', url: 'https://docs.databricks.com/aws/en/structured-streaming/watermarks' },
      ],
    },
    {
      id: 'monitor',
      heading: 'Measure what you promised',
      points: [
        {
          strong: 'Latency per row.',
          text: 'Store event time and ingestion time, then compute p50 and p95 of the difference. Judge latency against the target from the first section, not an average.',
        },
        {
          strong: 'Pipeline event log.',
          text: 'The event log records expectation pass and fail counts, throughput, and backlog. Query it to alert on stalled flows.',
        },
        {
          strong: 'Cost.',
          text: 'Tag pipelines and jobs and use a serverless usage policy. Compare the cost per million rows of triggered and continuous modes before you commit to the faster one.',
        },
      ],
    },
  ],
  related: [
    { slug: 'medallion-architecture', title: 'Medallion architecture' },
    { slug: 'scd-change-capture', title: 'SCD and change capture' },
    { slug: 'file-format-ingestion', title: 'File format ingestion' },
    { slug: 'reusability-templatization', title: 'Reusable ingestion templates' },
  ],
};
