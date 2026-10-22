import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'data-validation-framework',
  area: 'Data Engineering Guides',
  title: 'Data validation framework',
  businessValue: {
    summary:
      'Teams find bad or missing data before a report shows it, and write each rule once. Source comparisons run from Databricks, row rules live in the pipeline, and one check spec feeds one results table.',
    outcomes: [
      {
        title: 'One definition per rule',
        body: 'A reconciliation query or quality rule is written once, in Databricks. The source stays the system of record, with no second copy of the logic to keep in step.',
      },
      {
        title: 'Rejected rows are kept',
        body: 'A quarantine table holds every row a drop rule removes, with the names of the rules it broke. Owners fix the source or the rule instead of guessing what vanished.',
      },
      {
        title: 'Failures reach the right people',
        body: 'One results table feeds a SQL alert and can stop downstream tasks. Lineage lists the tables and dashboards that a failed check puts at risk.',
      },
      {
        title: 'Metrics defined once',
        body: 'A metric view holds the definition of each business metric, so dashboards, Genie, and SQL return the same number. Pages (Beta) do the same for business terms.',
      },
    ],
  },
  intro:
    'A validation setup has to answer four questions. Does the Databricks copy match the source? Do the rows in each table follow the rules? Do all the checks run the same way every time? Who is affected when one fails? This page gives seven patterns that answer them. Each pattern says when to use it, how it works, the practices that keep it maintainable, and a short example. The reference job builds a stand-in source in Lakebase Postgres and runs the patterns end to end.',
  shortVersion: [
    {
      title: 'Write each rule once.',
      body: 'Put validation logic in Databricks only. A rule that exists in the source and again in Databricks drifts apart, and every difference then needs a person to explain it.',
    },
    {
      title: 'Query the source from Databricks.',
      body: 'Lakehouse Federation runs the aggregate inside the source and returns a few rows. Compare counts, sums, distinct keys, and per-day checksums with the Databricks copy.',
    },
    {
      title: 'Enforce row rules in the pipeline.',
      body: 'Expectations warn, drop, or fail. Invert the drop rules into a quarantine table so rejected rows stay visible, with a reason.',
    },
    {
      title: 'Run every other check from one spec.',
      body: 'Checks are rows of data with a type, a threshold, and a severity. One runner executes them the same way and writes one results table.',
    },
    {
      title: 'Alert, block, and trace the impact.',
      body: 'A SQL alert reads the results table, a failing task blocks downstream work, and lineage lists what a failure affects.',
    },
    {
      title: 'Define metrics and terms once.',
      body: 'Metric views hold metric definitions. Pages (Beta), comments, tags, and certification carry the business meaning.',
    },
  ],
  sections: [
    {
      id: 'overview',
      heading: 'The pitfall to avoid, and the shape to build',
      prose:
        'The common mistake is to write the same validation logic twice, once in the source database and once in Databricks, and compare the two outputs. It looks safe. In practice the two versions diverge on rounding, null handling, time zones, and filters, and each mismatch costs an investigation that finds a bug in the checker instead of the data. The patterns below avoid it. Databricks asks the source for small aggregates, applies each rule in one place, and records every outcome in one table.',
      diagram: {
        type: 'flow',
        title: 'One place for every rule',
        description:
          'The source system is read through remote_query into a bronze copy. A pipeline applies expectations to the copy, writes valid rows to silver and rejected rows to a quarantine table, and silver feeds a metric view. A check spec feeds one validation job. The job compares aggregates from the source and the copy, runs the other checks, and writes one results table, which drives an alert or a block on downstream tasks. Lineage shows what each failure affects.',
        nodes: [
          {
            id: 'src',
            label: 'Source system',
            sub: 'ERP or database',
            col: 0,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'neutral',
            detail:
              'The operational system of record, such as an ERP or database. It answers aggregate queries and holds no validation code.',
          },
          {
            id: 'bronze',
            label: 'Copy in Databricks',
            sub: 'faithful, no rules',
            col: 1,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail:
              'A faithful copy of the source in Databricks, loaded without rules so checks can compare it to the source.',
          },
          {
            id: 'pipe',
            label: 'Pipeline rules',
            sub: 'expectations',
            col: 2,
            row: 0,
            kind: 'box',
            icon: 'gear-teal',
            domain: 'data',
            detail:
              'The pipeline step that applies expectations to each row, passing good rows on and sending rejects to quarantine.',
          },
          {
            id: 'silver',
            label: 'Silver',
            sub: 'rows that pass',
            col: 3,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail: 'Holds the rows that pass every drop rule. Metric views and downstream users read from here.',
          },
          {
            id: 'metric',
            label: 'Metric view',
            sub: 'one definition',
            col: 4,
            row: 0,
            kind: 'surface',
            icon: 'data-model',
            domain: 'apps',
            detail:
              'A metric view holds each business metric once, so dashboards, Genie, and SQL return the same number.',
          },
          {
            id: 'spec',
            label: 'Check spec',
            sub: 'YAML or UC table',
            col: 0,
            row: 1,
            kind: 'store',
            icon: 'checklist',
            domain: 'governance',
            detail:
              'The check definitions as rows of data, each with a type, a threshold, and a severity. One runner reads them.',
          },
          {
            id: 'runner',
            label: 'Validation job',
            sub: 'one runner',
            col: 1,
            row: 1,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'orchestration',
            detail:
              'The single validation job. It runs every check from the spec the same way, including source aggregates, and writes one results table.',
          },
          {
            id: 'results',
            label: 'Results table',
            sub: 'one row per check',
            col: 2,
            row: 1,
            kind: 'store',
            icon: 'list',
            domain: 'governance',
            detail: 'One row per check. A SQL alert reads it, and a failing task can stop downstream work.',
          },
          {
            id: 'quar',
            label: 'Quarantine',
            sub: 'rejects with a reason',
            col: 3,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'governance',
            detail:
              'Keeps every row a drop rule removed, with the name of the rule it broke, so owners can fix the source or the rule.',
          },
          {
            id: 'gate',
            label: 'Alert or block',
            sub: 'SQL alert, failed task',
            col: 2,
            row: 2,
            kind: 'gate',
            domain: 'governance',
            detail:
              'A SQL alert reads the results table and tells the owner, and a failing task stops downstream work from using bad data.',
          },
          {
            id: 'lineage',
            label: 'Lineage',
            sub: 'what a failure affects',
            col: 3,
            row: 2,
            kind: 'surface',
            icon: 'data-search',
            domain: 'governance',
            detail: 'Lists the tables and dashboards a failed check puts at risk.',
          },
        ],
        edges: [
          { from: 'src', to: 'bronze', label: 'remote_query' },
          { from: 'bronze', to: 'pipe' },
          { from: 'pipe', to: 'silver', label: 'pass' },
          { from: 'silver', to: 'metric' },
          { from: 'pipe', to: 'quar', label: 'reject' },
          { from: 'spec', to: 'runner' },
          { from: 'runner', to: 'src', label: 'aggregates', dashed: true },
          { from: 'runner', to: 'results' },
          { from: 'results', to: 'gate' },
          { from: 'results', to: 'lineage', dashed: true },
        ],
        legend: [
          { kind: 'store', label: 'Unity Catalog table' },
          { kind: 'highlight', label: 'The one runner' },
          { kind: 'gate', label: 'Decision point' },
          { kind: 'dashed', label: 'Read, no copy' },
        ],
        caption:
          'Rules live in the pipeline and the spec. The source answers aggregate queries and holds no validation code.',
      },
      table: {
        caption: 'The seven patterns',
        columns: ['Pattern', 'Question it answers'],
        rows: [
          ['1. Source reconciliation', 'Does the copy match the source, and on which day does it not?'],
          ['2. Expectations with quarantine', 'Which rows break a row-level rule, and why?'],
          ['3. Spec-driven runner', 'Do all other checks run the same way, with one result format?'],
          ['4. Freshness and volume', 'Did the data arrive, and in the usual amount?'],
          ['5. Alert and block', 'Who hears about a failure, and does downstream work stop?'],
          ['6. Lineage impact', 'What does a failure touch downstream?'],
          ['7. Metric definitions and glossary', 'Where is each metric and business term defined?'],
        ],
      },
    },
    {
      id: 'reconcile',
      heading: 'Pattern 1: Reconcile with the source without duplicating logic',
      prose:
        'Use this when data is copied from an operational system and you need proof the copy is complete and unchanged. Databricks sends an aggregate query to the source through Lakehouse Federation (a foreign catalog or remote_query), runs the same aggregate on the Databricks copy, and compares the two small results. The source runs one GROUP BY. It holds no validation code, and the comparison is written once. Reconcile against the bronze copy, which should be faithful to the source. Silver differs from the source by design, and its rules belong to the pipeline (pattern 2).',
      options: {
        caption: 'Where the source-side numbers come from',
        rows: [
          {
            option: 'Live Federation aggregates',
            when: 'The source can take an occasional GROUP BY, and you want the answer as of now. Fits a nightly check after a load.',
            tradeoffs:
              'Docs: query federation pushes work to the source and the query runs on both sides. Practical guidance: a big scan hits the production database, so run it off-peak and keep aggregates narrow.',
          },
          {
            option: 'Scheduled snapshots of source aggregates',
            when: 'The source is busy or the aggregate is slow, or you need to know what the source held at a given time.',
            tradeoffs:
              'Practical guidance: the source is touched once per snapshot, and re-running a check costs nothing there. The snapshot can be stale, and one more table needs retention.',
          },
          {
            option: 'Lakeflow Connect bronze',
            when: 'The source is ingested with a managed connector. The bronze table is already a faithful copy.',
            tradeoffs:
              'Docs recommend Lakeflow Connect over Federation when volume and latency matter. Checks shift to bronze-to-source counts and bronze-to-silver rules. Practical guidance: still compare counts, because deletes and filters can differ.',
          },
          {
            option: 'Lakebridge Reconcile',
            when: 'A migration. It compares source and target at schema, row-hash, and column level.',
            tradeoffs:
              'Practical guidance: built for one-time migration validation, with its own config and job. It is a Databricks Labs project documented outside docs.databricks.com, so confirm its support level.',
          },
        ],
        recommendation:
          'Start with live Federation aggregates for the first checks. Add snapshots when the source cannot take the load or you need history. Use bronze-to-source counts once the table arrives through Lakeflow Connect.',
      },
      points: [
        {
          strong: 'Write the aggregate once.',
          text: 'Build the source SQL and the Databricks SQL from the same metric list. The reference runner turns row_count, sum:amount, distinct:order_id, and checksum into both dialects, so adding a metric is one line in the spec.',
        },
        {
          strong: 'Compare aggregates, not rows.',
          text: 'Counts, sums, distinct keys, and checksums cross the wire as a few rows. Do not pull a table through Federation to diff it.',
        },
        {
          strong: 'Keep one checksum recipe.',
          text: 'The checksum is the one place with two dialects (Postgres md5 and Spark md5). Generate both from one column list, with the same canonical string per row: columns joined with a pipe, decimals at two places, dates as yyyy-MM-dd.',
        },
        {
          strong: 'Compare closed slices.',
          text: 'A day that is still changing in the source will differ for a good reason. Compare days that have finished loading, or snapshot both sides at one cut-off.',
        },
        {
          strong: 'Know the limits.',
          text: 'Pushdown depends on the source and the query shape. Check the plan for an expensive query, and keep the remote aggregate to one table with a simple filter and GROUP BY.',
        },
      ],
      examples: [
        {
          label: 'Compare per-day counts and sums with the source',
          language: 'sql',
          code: "WITH src AS (\n  SELECT * FROM remote_query('erp_conn', database => 'erp',\n    query => 'SELECT CAST(order_date AS varchar) AS day, count(*) AS n, sum(amount) AS total FROM sales.orders GROUP BY 1')\n), tgt AS (\n  SELECT CAST(order_date AS STRING) AS day, count(*) AS n, sum(amount) AS total\n  FROM main.sales.bronze_orders GROUP BY 1\n)\nSELECT coalesce(s.day, t.day) AS day, s.n AS source_n, t.n AS target_n, s.total - t.total AS total_diff\nFROM src s FULL OUTER JOIN tgt t ON s.day = t.day\nWHERE s.n IS DISTINCT FROM t.n OR s.total IS DISTINCT FROM t.total;",
          notes: [
            'An empty result means the two sides agree. A foreign catalog gives the same reach with ordinary table names.',
          ],
        },
      ],
      links: [
        {
          label: 'Run queries on a remote database with remote_query',
          url: 'https://docs.databricks.com/aws/en/query-federation/remote-queries',
        },
        { label: 'Lakehouse Federation', url: 'https://docs.databricks.com/aws/en/query-federation/' },
        { label: 'Federation with SQL Server', url: 'https://docs.databricks.com/aws/en/query-federation/sql-server' },
        { label: 'Lakeflow Connect', url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/' },
        {
          label: 'Lakebridge Reconcile (Databricks Labs)',
          url: 'https://databrickslabs.github.io/lakebridge/docs/reconcile/',
        },
      ],
    },
    {
      id: 'recon-grain',
      heading: 'Pattern 1, continued: Compare at the right grain',
      prose:
        'Use this to decide how much detail a reconciliation needs. A total says that something is wrong. A slice says where. The reference job shows the gap: six orders move from one day to the previous day in the source after the copy. The whole-table count and sum still match, so the totals check passes. Only the per-day count, sum, and checksum see the two days that changed.',
      options: {
        caption: 'How much detail to compare',
        rows: [
          {
            option: 'Whole-table totals',
            when: 'A fast first check after every load: row count, sum of an amount, count of distinct keys.',
            tradeoffs:
              'Cheap on both sides. Practical guidance: offsetting errors cancel out, and a total cannot say where the drift is.',
          },
          {
            option: 'Per-partition aggregates',
            when: 'Tables with a natural slice such as order date, load date, or key range. Use them to find the drift.',
            tradeoffs:
              'One row per slice, still small. Practical guidance: a slice that is still loading will differ, so compare finished slices.',
          },
          {
            option: 'Per-partition checksums',
            when: 'A value can change without moving a count or a sum, such as a status, a date, or a key swap.',
            tradeoffs:
              'Reads every column in the checksum on both sides, so it costs more at the source. Needs one canonical row format on both sides.',
          },
          {
            option: 'Row-level hashes',
            when: 'A drill-down on a slice already known to differ, to list the rows that changed.',
            tradeoffs:
              'Pulls one hash per row across the connection. Practical guidance: run it only on the slices that failed, not as a routine check.',
          },
        ],
        recommendation:
          'Run whole-table totals on every load and per-day counts, sums, and a checksum on a schedule. Use row-level hashes only to investigate a slice that failed.',
      },
      points: [
        {
          strong: 'Report the slices that differ.',
          text: 'The result should name the days and the deltas (source 40 rows, target 34), so the first look tells the owner where to start.',
        },
        {
          strong: 'Set a tolerance only where the source rounds.',
          text: 'Counts should match exactly. Allow a small tolerance on sums only when the two systems store decimals differently.',
        },
      ],
      links: [
        {
          label: 'Run queries on a remote database with remote_query',
          url: 'https://docs.databricks.com/aws/en/query-federation/remote-queries',
        },
      ],
    },
    {
      id: 'quarantine',
      heading: 'Pattern 2: Expectations with a quarantine table',
      prose:
        'Use this for rules that look at one row at a time: a required column is present, an amount is positive, a status is one of a known set. Lakeflow Spark Declarative Pipelines expectations check each row as it flows through the pipeline and decide what happens to a row that fails. To keep the rejected rows, add a second table that selects the inverse of the drop rules and records which rule each row broke. Define the rules once as a dictionary, then use it in both places.',
      diagram: {
        type: 'flow',
        title: 'One rule set, two outputs',
        description:
          'The landed copy feeds a silver table, which keeps rows that pass every drop rule. The same copy feeds a quarantine table, which keeps the rows that failed a drop rule, with the rule names and a timestamp. Each expectation also writes pass and fail counts to the pipeline event log.',
        nodes: [
          {
            id: 'landed',
            label: 'Landed copy',
            sub: 'dv_orders_landed',
            mono: true,
            col: 0,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail: 'The landed copy of the orders data. Both silver and quarantine are built from it.',
          },
          {
            id: 'silver',
            label: 'Silver',
            sub: 'drop and warn rules',
            col: 1,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail: 'Keeps rows that pass every drop rule. Warn rules also apply here.',
          },
          {
            id: 'quar',
            label: 'Quarantine',
            sub: 'inverse of drop rules',
            col: 1,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'governance',
            detail:
              'Holds the rows that failed a drop rule, with the rule names and a timestamp. It selects the inverse of the drop rules.',
          },
          {
            id: 'log',
            label: 'Event log',
            sub: 'passed, failed counts',
            col: 2,
            row: 0,
            kind: 'surface',
            icon: 'list',
            domain: 'governance',
            detail: 'The pipeline event log. Each expectation writes its pass and fail counts here.',
          },
        ],
        edges: [
          { from: 'landed', to: 'silver', label: 'rules pass' },
          { from: 'landed', to: 'quar', label: 'rules fail' },
          { from: 'silver', to: 'log', dashed: true },
        ],
        legend: [
          { kind: 'store', label: 'Table' },
          { kind: 'surface', label: 'Metrics' },
        ],
        caption: 'Silver plus quarantine equals the landed copy, which makes a good completeness check.',
      },
      options: {
        caption: 'What to do with a row that fails a rule',
        rows: [
          {
            option: 'Warn (expect)',
            when: 'The rule is advisory, or you are learning how often it fails before enforcing it.',
            tradeoffs:
              'Docs: invalid rows are written to the target and the failure is counted. Bad rows reach consumers, so use it only when that is acceptable.',
          },
          {
            option: 'Drop (expect_or_drop)',
            when: 'The row is unusable and consumers should never see it, but the update should go on.',
            tradeoffs:
              'Docs: invalid rows are removed before the write and the dropped count is logged. Practical guidance: on its own it loses the rows, so pair it with quarantine.',
          },
          {
            option: 'Fail (expect_or_fail)',
            when: 'One bad row means the load is wrong, such as a missing primary key. Use it sparingly.',
            tradeoffs:
              'Docs: the update fails and needs manual action, and metrics are not recorded for a fail action. In a triggered pipeline only that flow rolls back.',
          },
          {
            option: 'Quarantine table',
            when: 'You need the rejected rows to investigate, fix, and replay.',
            tradeoffs:
              'Docs describe this advanced pattern. Practical guidance: one more table to store and secure, and the rules must stay in step in both places, so define them once.',
          },
        ],
        recommendation:
          'Drop plus a quarantine table for rules on data you can repair, warn while you tune a new rule, and fail only for conditions that make the whole load meaningless.',
      },
      points: [
        {
          strong: 'Keep the reason with the row.',
          text: 'The quarantine table adds a quarantine_reasons column listing every drop rule the row broke, and a quarantined_at timestamp.',
        },
        {
          strong: 'Treat NULL as a failure on both sides.',
          text: 'An expectation that evaluates to NULL fails. Wrap each rule in coalesce(rule, false) when you invert it, so the row lands in quarantine instead of nowhere.',
        },
        {
          strong: 'Read metrics from the event log.',
          text: 'Query event_log() for flow_progress events and read the data_quality expectations, which hold passed and failed counts per expectation. The reference job stores them by run.',
        },
        {
          strong: 'Keep rules out of the transformation code.',
          text: 'The docs recommend storing expectation definitions separately, in a Delta table or a module, and tagging groups of rules. Loading rules from a file works in Python, not in SQL.',
        },
        {
          strong: 'Do not use a validation table as a gate.',
          text: 'A pipeline dataset that fails does not stop other datasets from updating. To block downstream work, run the validation in its own pipeline or task and make the next task depend on it (pattern 5).',
        },
      ],
      links: [
        {
          label: 'Manage data quality with pipeline expectations',
          url: 'https://docs.databricks.com/aws/en/ldp/expectations',
        },
        {
          label: 'Expectation recommendations and advanced patterns',
          url: 'https://docs.databricks.com/aws/en/ldp/expectation-patterns',
        },
        {
          label: 'Monitor pipelines with the event log',
          url: 'https://docs.databricks.com/aws/en/ldp/monitor-event-logs',
        },
      ],
    },
    {
      id: 'runner',
      heading: 'Pattern 3: A spec-driven validation runner',
      prose:
        'Use this for every check that is not a row-level rule: counts, uniqueness, null rates, referential integrity, freshness, reconciliation, and custom SQL. Describe each check as data (a name, a dataset, a type, a threshold, and a severity) in a YAML file in Git or a Unity Catalog table. One job reads the list, builds the SQL for each type, measures one number, compares it with the threshold, and writes a row to one results table. Adding a check is a new entry. No new code, no new job.',
      table: {
        caption: 'Check types in the reference runner',
        columns: ['Type', 'Observed value, and the default pass rule'],
        rows: [
          ['reconciliation', 'Slices that differ from the source. Passes at or below the threshold, usually 0.'],
          ['row_count', 'Rows in the dataset. Passes at or above the threshold.'],
          ['unique', 'Key values that appear more than once. Passes at or below the threshold.'],
          ['null_rate', 'Share of NULLs in a column. Passes at or below the threshold.'],
          ['referential', 'Rows with no match in the reference table. Passes at or below the threshold.'],
          ['freshness', 'Hours since the newest value in a timestamp column. Passes at or below the threshold.'],
          ['custom_sql', 'The single value a SQL statement returns. Compared with the op in the spec.'],
        ],
      },
      options: {
        caption: 'Where to put a validation rule',
        rows: [
          {
            option: 'Pipeline expectations',
            when: 'Row-level rules that decide whether a row enters a table.',
            tradeoffs:
              'Docs: a constraint cannot call custom Python functions or external services, or use subqueries on other tables. Metrics land in the event log, not in a table you design.',
          },
          {
            option: 'A spec-driven validation job',
            when: 'Table-level and cross-system checks, such as counts, uniqueness, reconciliation, and freshness.',
            tradeoffs:
              'Practical guidance: you own a small runner and a results table. In return every check has one format and a severity that can block work.',
          },
          {
            option: 'Data quality monitoring',
            when: 'Anomaly detection for freshness and completeness across a schema, and profiling for statistics and drift, on top of explicit rules.',
            tradeoffs:
              'Docs: anomaly detection is Public Preview and learns from history, so it needs time and can flag changes that are real. It flags that something moved and does not say which rule broke.',
          },
        ],
        recommendation:
          'Use all three for different jobs. Pipeline expectations for row rules, the spec-driven job for table and cross-system checks, and data quality monitoring as a safety net for what no rule anticipates.',
      },
      points: [
        {
          strong: 'Give every check a severity.',
          text: 'error blocks the next task. warn is recorded and alerted but lets the run continue. A new check can start as warn and move to error once it is stable.',
        },
        {
          strong: 'Record a check that cannot run.',
          text: 'A broken query gets status error with the message, not silence. One bad check must not hide the others.',
        },
        {
          strong: 'Validate the spec first.',
          text: 'Unknown types, missing thresholds, and bad severities fail before any check runs. Only plain identifiers are allowed for table and column names.',
        },
        {
          strong: 'Keep run history.',
          text: 'Write run_id, a timestamp, the observed value, the expected value, the status, and the details. A rerun replaces its own run_id and leaves other runs, so the table is the trend.',
        },
      ],
      examples: [
        {
          label: 'Two checks in the spec',
          language: 'yaml',
          code: 'checks:\n  - name: orders_daily_vs_source\n    type: reconciliation\n    dataset: bronze_orders\n    severity: warn\n    source: live            # or snapshot\n    source_table: orders\n    grain: order_date\n    metrics: [row_count, "sum:amount", checksum]\n    threshold: 0            # slices allowed to differ\n\n  - name: silver_customer_exists\n    type: referential\n    dataset: silver_orders\n    column: customer_id\n    ref_dataset: customers\n    ref_column: customer_id\n    severity: error\n    threshold: 0            # orphan rows allowed',
        },
        {
          label: 'The results table',
          language: 'sql',
          code: 'CREATE TABLE IF NOT EXISTS main.quality.check_results (\n  run_id STRING, checked_at TIMESTAMP, check_name STRING, check_type STRING,\n  dataset STRING, severity STRING, observed DOUBLE, operator STRING,\n  expected DOUBLE, status STRING, details STRING\n);',
        },
      ],
      links: [
        {
          label: 'Data quality monitoring',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/',
        },
        {
          label: 'Expectation recommendations and advanced patterns',
          url: 'https://docs.databricks.com/aws/en/ldp/expectation-patterns',
        },
        { label: 'Lakeflow Jobs', url: 'https://docs.databricks.com/aws/en/jobs/' },
      ],
    },
    {
      id: 'freshness',
      heading: 'Pattern 4: Freshness and volume checks',
      prose:
        'Use this to catch data that is late, missing, or oddly small. Two tools cover it. Explicit checks in the spec cover the deadlines you know: the table must hold a load from the last 24 hours, and today must have at least half the usual rows. Data quality monitoring covers what you did not think to write down. Anomaly detection learns the usual commit time and daily row count of each table in a schema and marks a table stale or incomplete when it falls outside the range. Data profiling (formerly Lakehouse Monitoring) tracks column statistics and drift over time.',
      points: [
        {
          strong: 'Check freshness on a load timestamp.',
          text: 'Measure the newest _loaded_at or event time against the clock. A business date can look fresh while the load itself stalled.',
        },
        {
          strong: 'Check volume against a baseline.',
          text: 'Compare a load date with its trailing average, not a fixed number. A fixed count breaks on seasonal tables.',
        },
        {
          strong: 'Turn on anomaly detection per schema.',
          text: 'The docs describe one setting per schema, a model per table, and results in Catalog Explorer and a system table. It needs history before its range is useful, and it is Public Preview, so check the release stage before depending on it.',
        },
        {
          strong: 'Use profiling where drift matters.',
          text: 'A profiling monitor writes metrics tables you can query, chart, and alert on. The data observability guide shows a scheduled monitor.',
        },
        {
          strong: 'Keep explicit checks for deadlines.',
          text: 'A learned range tells you something is unusual. A threshold in the spec says the table is late for a stated reason, and it can block work.',
        },
      ],
      examples: [
        {
          label: 'Volume against the trailing average',
          language: 'yaml',
          code: "  - name: daily_volume_not_collapsed\n    type: custom_sql\n    dataset: bronze_orders\n    severity: warn\n    op: ge\n    threshold: 0.5          # today's rows / average of the previous 7 days\n    sql: >-\n      SELECT count_if(load_date = current_date())\n             / nullif(count_if(load_date < current_date()) / 7.0, 0) AS observed\n      FROM {ns}.bronze_orders\n      WHERE load_date >= current_date() - 7",
          notes: ['{ns} is replaced with catalog.schema when the runner builds the statement.'],
        },
      ],
      links: [
        {
          label: 'Data quality monitoring',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/',
        },
        {
          label: 'Anomaly detection',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/anomaly-detection/',
        },
        {
          label: 'Data profiling',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/data-profiling/',
        },
      ],
    },
    {
      id: 'alerts',
      heading: 'Pattern 5: Alert and block downstream',
      prose:
        'Use this to turn a failed check into a message to a person and, for serious failures, a stop. Two mechanisms do different jobs. The runner task fails when a blocking check fails, so every task that depends on it is skipped. A SQL alert on a view over the results table tells the owner about warnings and trends without stopping anything. A task that must run after a failure, such as impact analysis, uses a Run if condition of All done.',
      options: {
        caption: 'How a failure reaches people and pipelines',
        rows: [
          {
            option: 'Fail the runner task',
            when: 'An error-severity check failed and downstream tasks must not run on this data.',
            tradeoffs:
              'Docs: downstream tasks run only when their Run if condition holds, and the default is that all upstream tasks succeeded. Blocks reliably, but it is all or nothing for that task.',
          },
          {
            option: 'Job failure notifications',
            when: 'Someone must hear that a run stopped, with no extra objects to maintain.',
            tradeoffs:
              'Docs list failure, success, and duration notifications on jobs. Practical guidance: the message says which task failed, not which check, so the results table is still where you look.',
          },
          {
            option: 'SQL alert on the results view',
            when: 'Warnings, trends, and failures from more than one job, sent to a team on a schedule.',
            tradeoffs:
              'Needs a SQL warehouse and a schedule. Practical guidance: it reports after the fact and cannot stop a run on its own.',
          },
        ],
        recommendation:
          'Fail the runner for error severity so bad data never moves on, and put a SQL alert on a failures view for warnings and for a team-wide view. Add job notifications for the owner of the job.',
      },
      points: [
        {
          strong: 'Make blocking a parameter.',
          text: 'The reference job takes block_on with error (default), warn, or none, so the same job can run in a strict or a report-only mode.',
        },
        {
          strong: 'Alert from one view.',
          text: "A view of the latest run's non-passing checks gives the alert one stable query, whatever checks the spec holds.",
        },
        {
          strong: 'Run impact analysis even after a failure.',
          text: 'Give the lineage task a Run if of All done, so it still lists what the failure affects.',
        },
        {
          strong: 'Ship alerts paused.',
          text: 'The bundle creates the alert in a paused state, so deploying never sends mail. Unpause it when the owner is ready.',
        },
      ],
      examples: [
        {
          label: 'Block one task, run another regardless',
          language: 'yaml',
          code: 'tasks:\n  - task_key: run_validations\n    notebook_task: {notebook_path: ../run_validations.py}\n  - task_key: publish_metric_view      # skipped when run_validations fails\n    depends_on: [{task_key: run_validations}]\n    notebook_task: {notebook_path: ../publish.py}\n  - task_key: read_lineage             # runs after success or failure\n    depends_on: [{task_key: publish_metric_view}]\n    run_if: ALL_DONE\n    notebook_task: {notebook_path: ../lineage.py}',
        },
        {
          label: 'The view an alert reads',
          language: 'sql',
          code: "CREATE OR REPLACE VIEW main.quality.latest_failures AS\nSELECT * FROM main.quality.check_results\nWHERE status <> 'pass'\n  AND run_id = (SELECT run_id FROM main.quality.check_results ORDER BY checked_at DESC LIMIT 1);",
        },
      ],
      links: [
        { label: 'Configure task dependencies and Run if', url: 'https://docs.databricks.com/aws/en/jobs/run-if' },
        { label: 'Add notifications to a job', url: 'https://docs.databricks.com/aws/en/jobs/notifications' },
        { label: 'SQL alerts', url: 'https://docs.databricks.com/aws/en/sql/user/alerts/' },
      ],
    },
    {
      id: 'lineage',
      heading: 'Pattern 6: Lineage-based impact analysis',
      prose:
        'Use this when a check fails and someone asks what it affects. Unity Catalog records lineage from queries and pipelines, and system.access.table_lineage holds it as rows. Starting from the dataset of a failed check, walk downstream a few hops to list the tables and views built from it. Rows with no target table are reads, so they identify, by entity type and id, the jobs, notebooks, queries, and dashboards that consumed the table. The result is a short list a person can act on: who to warn, and which jobs to hold.',
      points: [
        {
          strong: 'Walk a bounded number of hops.',
          text: 'Three hops covers most chains. Track tables already seen so a cycle cannot loop.',
        },
        {
          strong: 'Expect a delay.',
          text: 'Lineage reaches the system tables some minutes after the write, so read it on a schedule or poll. The reference job polls for up to 30 minutes.',
        },
        {
          strong: 'Store the list with the run.',
          text: 'Writing the affected assets next to the check results lets an alert include them and lets you see what a past failure touched.',
        },
        {
          strong: 'Use column lineage for narrow checks.',
          text: 'When a check is about one column, system.access.column_lineage shows only the tables that carry that column.',
        },
      ],
      examples: [
        {
          label: 'Tables and readers downstream of a dataset',
          language: 'sql',
          code: "SELECT target_table_full_name, entity_type, MAX(event_time) AS last_seen\nFROM system.access.table_lineage\nWHERE source_table_full_name = 'main.sales.bronze_orders'\n  AND event_date >= current_date() - 30\nGROUP BY 1, 2\nORDER BY last_seen DESC;\n-- A NULL target_table_full_name is a read: a dashboard, notebook, or query.",
        },
      ],
      links: [
        {
          label: 'View data lineage in Unity Catalog',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage',
        },
        {
          label: 'Lineage system tables reference',
          url: 'https://docs.databricks.com/aws/en/admin/system-tables/lineage',
        },
      ],
    },
    {
      id: 'metrics',
      heading: 'Pattern 7: Metric views as the one definition of a metric',
      prose:
        'Use this when the same metric appears in dashboards, Genie, and ad hoc SQL, and the numbers disagree. A metric view is a Unity Catalog object that holds dimensions and measures in YAML. Each measure is defined once, and every consumer queries it with MEASURE(), so they all get the same expression and the same filters. Publish the view after validation passes, so a definition never sits on data that failed an error-severity check, and check the measure against a direct query.',
      options: {
        caption: 'Where a metric definition lives',
        rows: [
          {
            option: 'Metric view',
            when: 'A KPI used by more than one dashboard, Genie space, or query, or one that needs governance.',
            tradeoffs:
              'Docs: a Unity Catalog securable with standard privileges, queried with MEASURE(). Consumers must use the metric syntax. A change is one edit, reviewed in one place.',
          },
          {
            option: 'Regular view',
            when: 'A fixed result set or a join that everyone reads as columns.',
            tradeoffs:
              'Practical guidance: it fixes the grouping, so a ratio or distinct count has to be recalculated at each new grain, and each consumer can compute it differently.',
          },
          {
            option: 'Dashboard-level definition',
            when: 'A one-off number used on one dashboard.',
            tradeoffs:
              'Fast to build. Practical guidance: the definition sits inside one dashboard, so other tools and Genie cannot reuse it, and copies drift.',
          },
        ],
        recommendation:
          'Use a metric view for any metric that more than one place reports, and keep dashboard-level definitions for throwaway numbers.',
      },
      points: [
        {
          strong: 'Check the view against the table.',
          text: 'The reference job queries net_revenue through MEASURE() and compares it with the same aggregate written in SQL on the silver table. A mismatch fails the task.',
        },
        {
          strong: 'Describe every measure.',
          text: 'Add comment text to dimensions and measures. Genie and the catalog use it to explain what a number means.',
        },
        {
          strong: 'Certify after validation.',
          text: 'The reference job tries to set the system.certification_status tag to certified once the checks pass. That needs ASSIGN on the governed tag, so it reports the outcome.',
        },
      ],
      examples: [
        {
          label: 'A metric view with one filtered measure',
          language: 'sql',
          code: "CREATE OR REPLACE VIEW main.sales.orders_metrics\nWITH METRICS LANGUAGE YAML AS $$\n  version: 1.1\n  source: main.sales.silver_orders\n  dimensions:\n    - name: order_date\n      expr: order_date\n  measures:\n    - name: order_count\n      expr: COUNT(1)\n    - name: net_revenue\n      expr: SUM(amount) FILTER (WHERE status <> 'cancelled')\n      comment: Sum of order amount, excluding cancelled orders\n$$;\n\nSELECT order_date, MEASURE(net_revenue) FROM main.sales.orders_metrics GROUP BY ALL;",
        },
      ],
      links: [
        { label: 'Unity Catalog metric views', url: 'https://docs.databricks.com/aws/en/metric-views/' },
        {
          label: 'Semantic metadata in metric views',
          url: 'https://docs.databricks.com/aws/en/metric-views/data-modeling/semantic-metadata',
        },
      ],
    },
    {
      id: 'glossary',
      heading: 'Pattern 7, continued: A shared business glossary',
      prose:
        'Use this when teams use the same word for different things, or when new people cannot tell which table to trust. Databricks has a glossary-style feature called Pages. A Page is a governed definition of a business concept, such as a term, an entity, or an acronym. It has a domain, an owner, synonyms, a description, a body, related assets, and sources. Pages are part of Unity Catalog semantics, which also holds metric views, domains, and certification. The docs mark Pages as Beta, and account admins control access from the Previews page, so confirm with the account team that it is available and suitable before you plan around it.',
      options: {
        caption: 'Carrying business meaning in Unity Catalog',
        rows: [
          {
            option: 'Pages (Beta)',
            when: 'Terms, acronyms, and KPIs that need one authoritative definition, owned by a domain.',
            tradeoffs:
              'Docs: Pages sit in the Discover page, inherit access from the domain, and Genie One uses them and cites them in answers. Beta, so stage and availability may change.',
          },
          {
            option: 'Comments and governed tags',
            when: 'Meaning that belongs next to one table or column, such as a description, a sensitivity label, or an owner.',
            tradeoffs:
              'Generally available. Practical guidance: good for objects, weak for a concept that spans many tables, and tags need a naming standard.',
          },
          {
            option: 'Certification status tag',
            when: 'Marking which tables, views, and metric views the organization trusts, and which are deprecated.',
            tradeoffs:
              'Docs: a system tag with the values certified and deprecated, applied with ASSIGN on the tag. It signals trust and defines nothing, so pair it with a description.',
          },
        ],
        recommendation:
          'Put definitions of metrics in metric views, descriptions on objects in comments and governed tags, and trust signals in certification. Add Pages for shared terms if your account team confirms the Beta fits.',
      },
      points: [
        {
          strong: 'Link, do not copy.',
          text: 'A Page can reference the metric view and tables that implement its concept. The definition stays in one place, with links.',
        },
        {
          strong: 'Give each term one owner.',
          text: 'An owner and a domain keep a definition current. Unowned glossary entries go stale.',
        },
      ],
      examples: [
        {
          label: 'Certify a metric view and describe a column',
          language: 'sql',
          code: "SET TAG ON VIEW main.sales.orders_metrics `system.certification_status` = `certified`;\n\nCOMMENT ON COLUMN main.sales.silver_orders.amount IS 'Order total in USD, before tax. Always positive after validation.';",
        },
      ],
      links: [
        { label: 'Pages (Beta)', url: 'https://docs.databricks.com/aws/en/uc-semantics/pages' },
        { label: 'Unity Catalog semantics', url: 'https://docs.databricks.com/aws/en/uc-semantics' },
        {
          label: 'Certification and deprecation',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/certify-deprecate-data',
        },
        { label: 'Governed tags', url: 'https://docs.databricks.com/aws/en/admin/governed-tags' },
      ],
    },
    {
      id: 'adopt',
      heading: 'Adopt the patterns in this order',
      steps: [
        {
          title: 'Add totals checks against the source',
          body: 'Write the first reconciliation entries: row count, a sum, and distinct keys, from Databricks through Federation. Run them after each load.',
        },
        {
          title: 'Move row rules into expectations',
          body: 'Start every new rule as warn, watch the counts in the event log, then promote to drop with a quarantine table.',
        },
        {
          title: 'Put the rest in the spec',
          body: 'Add uniqueness, null rate, referential, and freshness checks as entries. Start at warn severity and promote the stable ones to error.',
        },
        {
          title: 'Wire alerts and a block',
          body: 'Make the runner fail on error severity, and point a SQL alert at the failures view.',
        },
        {
          title: 'Add per-day slices and lineage',
          body: 'Add per-day checksums for tables where a silent change would hurt, and store the lineage impact list with each run.',
        },
        {
          title: 'Publish metric views',
          body: 'Move each shared metric into a metric view after validation passes, then certify it.',
        },
      ],
    },
  ],
  related: [
    { slug: 'data-observability', title: 'Lineage and drift detection' },
    { slug: 'transformation-patterns', title: 'Transformation patterns' },
    { slug: 'relational-db-ingestion', title: 'Relational database extracts' },
    { slug: 'ontology', title: 'Ontology' },
  ],
};
