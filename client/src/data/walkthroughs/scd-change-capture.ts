import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'scd-change-capture',
  area: 'Data Engineering Guides',
  title: 'SCD and change capture',
  intro:
    'AUTO CDC in Lakeflow Spark Declarative Pipelines applies a feed of inserts, updates, and deletes to a streaming table. SCD type 1 keeps the latest row per key. SCD type 2 keeps every version with start and end timestamps. This page covers which type to pick, how ordering and deletes work, how to keep history on the right columns, and how to query the result.',
  businessValue: {
    summary:
      'Analytics and compliance owners often need both the current state of a record and its history. AUTO CDC in Lakeflow Spark Declarative Pipelines keeps either, so reports and audits can say what was true on a given date.',
    outcomes: [
      {
        title: 'History for audits',
        body:
          'SCD type 2 keeps every version of a row with start and end timestamps. Auditors and analysts can see what a customer record looked like on a past date.',
      },
      {
        title: 'Out-of-order events handled',
        body:
          'SEQUENCE BY applies the event with the highest sequence value per key. Late or duplicated events do not overwrite newer data and quietly corrupt reports.',
      },
      {
        title: 'Deletes handled by design',
        body:
          'APPLY AS DELETE WHEN removes the row in type 1 and closes the current version in type 2, so deleted source records do not linger in reporting tables.',
      },
      {
        title: 'Controlled table growth',
        body:
          'TRACK HISTORY ON limits new versions to meaningful columns. A last-login timestamp does not create a new row and inflate storage and query cost.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Pick the type by the question you answer.',
      body: 'Use type 1 for current state. Use type 2 when reports, audits, or point-in-time joins need what a row looked like before.',
    },
    {
      title: 'Order events with SEQUENCE BY.',
      body: 'AUTO CDC applies the event with the highest sequence value per key, so late and out-of-order events do not overwrite newer data.',
    },
    {
      title: 'Declare deletes in the flow.',
      body: 'APPLY AS DELETE WHEN removes the row from type 1 and closes the current version in type 2.',
    },
    {
      title: 'Track history only on columns that matter.',
      body: 'TRACK HISTORY ON limits new versions to meaningful changes, so a last-login timestamp does not bloat the table.',
    },
    {
      title: 'Run normal updates, not full reloads.',
      body: 'The flow keeps a checkpoint, so each update reads only new feed rows. Use AUTO CDC FROM SNAPSHOT when the source gives full extracts.',
    },
  ],
  sections: [
    {
      id: 'choose',
      heading: 'Type 1 or type 2',
      prose: 'Both read the same feed with the same key, delete rule, and sequence. Only the STORED AS clause differs.',
      table: {
        columns: ['Question', 'Use'],
        rows: [
          ['What is the customer’s current address?', 'Type 1: one row per key, overwritten on update'],
          ['What was the address when the order shipped?', 'Type 2: one row per version, with __START_AT and __END_AT'],
          ['Do you need to audit who changed what and when?', 'Type 2, plus the change feed in bronze'],
          ['Is the table large and history rarely read?', 'Type 1, and keep history in the bronze feed'],
        ],
      },
    },
    {
      id: 'types',
      heading: 'How each change lands',
      prose: 'The same three change types produce different results in each table.',
      diagram: {
        type: 'matrix',
        title: 'Change type by table',
        description:
          'An insert adds a row to both tables. An update overwrites the row in type 1 and closes the current version and adds a new one in type 2. A delete removes the row in type 1 and closes the current version in type 2 with no new row.',
        corner: 'Change ↓ · Table →',
        columns: ['SCD type 1', 'SCD type 2'],
        rows: [
          { label: 'INSERT', cells: [{ state: 'own', text: 'new row' }, { state: 'own', text: 'new current row' }] },
          { label: 'UPDATE', cells: [{ state: 'own', text: 'row overwritten' }, { state: 'own', text: 'old closed, new added' }] },
          { label: 'DELETE', cells: [{ state: 'own', text: 'row removed' }, { state: 'own', text: 'current row closed' }] },
        ],
        legend: [{ state: 'own', label: 'Result in this table' }],
      },
    },
    {
      id: 'ordering',
      heading: 'Order events and handle late data',
      prose:
        'SEQUENCE BY names the column that orders events for a key. AUTO CDC keeps the row with the highest value, so an event that arrives late and carries an older value loses to one already applied. The column must come from the source and only move forward for a key, such as a log sequence number or a source commit timestamp. Do not use the arrival time.',
      points: [
        {
          strong: 'Break ties with a struct.',
          text: 'SEQUENCE BY STRUCT(commit_ts, event_id) orders by the first field and falls back to the second.',
        },
        {
          strong: 'Keep the raw feed.',
          text: 'Store the feed in an append-only bronze table. If a rule changes, you can replay history from it.',
        },
        {
          strong: 'Add expectations on the feed.',
          text: 'Drop or flag events with a null key or a null sequence before they reach AUTO CDC.',
        },
      ],
      examples: [
        {
          label: 'Order by commit time, then event id',
          language: 'sql',
          code: "CREATE FLOW accounts_scd1_flow AS AUTO CDC INTO accounts_scd1\nFROM STREAM(accounts_changes)\nKEYS (account_id)\nAPPLY AS DELETE WHEN change_type = 'DELETE'\nSEQUENCE BY STRUCT(commit_ts, event_id)\nCOLUMNS * EXCEPT (change_type, commit_ts, event_id)\nSTORED AS SCD TYPE 1;",
        },
      ],
    },
    {
      id: 'sql',
      heading: 'The pipeline code',
      prose: 'Both flows can live in one SQL file. Create the target streaming tables empty, and the flows fill them.',
      steps: [
        {
          title: 'Type 1',
          body: 'Deletes come from the change_type column. Columns that only drive the flow are excluded from the target.',
        },
        {
          title: 'Type 2',
          body: 'STORED AS SCD TYPE 2 adds __START_AT and __END_AT. TRACK HISTORY ON limits which column changes create a new version.',
          code: "CREATE FLOW accounts_scd2_flow AS AUTO CDC INTO accounts_scd2\nFROM STREAM(accounts_changes)\nKEYS (account_id)\nAPPLY AS DELETE WHEN change_type = 'DELETE'\nSEQUENCE BY change_seq\nCOLUMNS * EXCEPT (change_type, change_seq)\nSTORED AS SCD TYPE 2\nTRACK HISTORY ON * EXCEPT (last_login_at);",
        },
        {
          title: 'Why track history selectively',
          body: 'A change to last_login_at overwrites the current row instead of adding a version. Without TRACK HISTORY, every column change adds a version.',
        },
      ],
    },
    {
      id: 'query',
      heading: 'Query a type 2 table',
      prose:
        'Current rows have a null __END_AT. For a point-in-time join, match the event date to the version whose range contains it. Cluster the table on the key, or use CLUSTER BY AUTO, so these lookups skip files.',
      examples: [
        {
          label: 'Current rows and a point-in-time join',
          language: 'sql',
          code: '-- Current state\nSELECT * FROM accounts_scd2 WHERE __END_AT IS NULL;\n\n-- Account tier as of each order date\nSELECT o.order_id, a.tier\nFROM orders o\nJOIN accounts_scd2 a\n  ON o.account_id = a.account_id\n AND o.order_ts >= a.__START_AT\n AND (o.order_ts < a.__END_AT OR a.__END_AT IS NULL);',
        },
      ],
    },
    {
      id: 'sources',
      heading: 'Where the feed comes from',
      points: [
        {
          strong: 'Databases.',
          text: 'Lakeflow Connect ingests change data from supported databases into Unity Catalog, so you do not build the capture yourself.',
        },
        {
          strong: 'Files or a Delta change feed.',
          text: 'Read Debezium-style files with Auto Loader, or read a Delta table’s change data feed, then apply it with AUTO CDC. The CDC and incremental refresh guide covers both.',
        },
        {
          strong: 'Full extracts.',
          text: 'When the source only gives a snapshot, AUTO CDC FROM SNAPSHOT compares each snapshot with the last and derives the inserts, updates, and deletes. It is available in Python.',
        },
      ],
      links: [
        {
          label: 'AUTO CDC in Lakeflow Spark Declarative Pipelines',
          url: 'https://docs.databricks.com/aws/en/ldp/cdc',
          note: 'Type 1 and type 2 flows, ordering, deletes, and snapshots.',
        },
      ],
    },
  ],
  related: [
    { slug: 'cdc-incremental-refresh', title: 'CDC and incremental refresh in pipelines' },
    { slug: 'transformation-patterns', title: 'Transformation patterns' },
    { slug: 'target-loading-outputs', title: 'Target loading and file outputs' },
  ],
};
