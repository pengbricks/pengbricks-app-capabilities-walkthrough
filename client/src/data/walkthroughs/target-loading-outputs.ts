import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'target-loading-outputs',
  area: 'Data Engineering Guides',
  title: 'Target loading and file outputs',
  intro:
    'Match the write pattern to the load: MERGE for batch upserts, AUTO CDC for ordered change feeds, and overwrite for whole partitions. Then deliver files from Unity Catalog volumes, and write them with Spark when they are large. This page covers when to use each, how to keep MERGE fast and repeatable, and how to deliver data to people and systems outside the lakehouse.',
  businessValue: {
    summary:
      'Data engineering owners need loads that can be rerun safely and files that reach other teams and systems under governance. This guide covers write patterns for batch and change loads, and file delivery from Unity Catalog volumes.',
    outcomes: [
      {
        title: 'Reruns that do no harm',
        body: 'A MERGE keyed on a stable business key gives the same result when a batch is rerun. A failed overnight load can be retried without duplicate or missing rows.',
      },
      {
        title: 'Right pattern for each load',
        body: 'MERGE for batch upserts, AUTO CDC for ordered feeds, and INSERT OVERWRITE or REPLACE WHERE for partitions each fit a load shape. Teams avoid full table rewrites.',
      },
      {
        title: 'Loads that stay fast',
        body: 'Liquid clustering on the merge key and deletion vectors let MERGE touch fewer files. Predictive optimization keeps the table healthy, so load windows hold as data grows.',
      },
      {
        title: 'Governed file delivery',
        body: 'Files for partners or legacy systems are written to a Unity Catalog volume, and volume privileges control who can read them. Access to outputs follows the same model as tables.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Pick the write pattern by the load.',
      body: 'MERGE upserts a batch. AUTO CDC applies an ordered, continuous change feed. INSERT OVERWRITE and REPLACE WHERE replace a partition or a predicate atomically.',
    },
    {
      title: 'One MERGE can insert, update, and delete.',
      body: 'A change type on each source row chooses the clause. Dedupe the source first, because several source rows matching one target row fail the statement.',
    },
    {
      title: 'Make the load repeatable.',
      body: 'Key the match on a stable business key, and use WITH SCHEMA EVOLUTION when the source adds columns. A rerun of the same batch should not change the result.',
    },
    {
      title: 'Cluster the target on the merge key.',
      body: 'Liquid clustering and deletion vectors let MERGE touch fewer files. Predictive optimization keeps the table healthy afterward.',
    },
    {
      title: 'Deliver files from a volume, with Spark at scale.',
      body: 'Write large outputs with Spark writers, grant access with volume privileges, and use pandas only for small formatted exports.',
    },
  ],
  sections: [
    {
      id: 'choose',
      heading: 'Choose the write pattern',
      options: {
        caption: 'Which write pattern to use',
        rows: [
          {
            option: 'MERGE INTO',
            when: 'A batch of inserts, updates, and deletes to a table.',
            tradeoffs:
              'Flexible matching and per-clause logic. Cost depends on how much of the target it must scan, so cluster or partition on the match keys. You write the ordering and delete handling yourself.',
          },
          {
            option: 'AUTO CDC in a Lakeflow Spark Declarative Pipeline',
            when: 'A continuous or ordered change feed, type 1 or type 2.',
            tradeoffs:
              'Handles sequencing, late data, deletes, and history for you. It runs inside a pipeline, so it fits only when the target is a pipeline-managed table.',
          },
          {
            option: 'REPLACE WHERE or INSERT OVERWRITE',
            when: 'Replace one day, region, or other slice.',
            tradeoffs:
              'Simple and repeatable for reruns, because the slice is rewritten whole. It rewrites everything in the slice, so it costs more than a merge for a few changed rows.',
          },
          {
            option: 'INSERT INTO or a streaming table',
            when: 'Append-only events.',
            tradeoffs:
              'Cheapest and simplest write. It cannot update or delete, and rerunning a load can create duplicates unless the load is idempotent.',
          },
        ],
        recommendation:
          'Match the pattern to the shape of the change. Use AUTO CDC for feeds, MERGE for batch changes, REPLACE WHERE for slice reloads, and append for events. For a derived table you can rebuild from its sources, use a materialized view instead of a hand-written load.',
      },
      links: [
        {
          label: 'Upsert into a Delta table with MERGE',
          url: 'https://docs.databricks.com/aws/en/delta/merge',
        },
        {
          label: 'Selective overwrite with REPLACE WHERE',
          url: 'https://docs.databricks.com/aws/en/delta/selective-overwrite',
        },
        { label: 'AUTO CDC in pipelines', url: 'https://docs.databricks.com/aws/en/ldp/cdc' },
      ],
    },
    {
      id: 'merge',
      heading: 'One MERGE, three clauses',
      prose:
        'Every source row carries a change type. The match condition is the business key. The change type decides which clause fires. List the delete clause first so a deleted row does not also update.',
      diagram: {
        type: 'matrix',
        title: 'MERGE clauses by change type',
        description:
          'A matched row with change type DELETE is deleted. A matched row with change type UPDATE is updated. A row with no match and change type INSERT is inserted.',
        corner: 'Change type ↓ · Detail →',
        columns: ['Clause', 'Fires when'],
        rows: [
          {
            label: 'DELETE',
            cells: [
              { state: 'own', text: 'WHEN MATCHED' },
              { state: 'own', text: 'key exists' },
            ],
          },
          {
            label: 'UPDATE',
            cells: [
              { state: 'own', text: 'WHEN MATCHED' },
              { state: 'own', text: 'key exists' },
            ],
          },
          {
            label: 'INSERT',
            cells: [
              { state: 'own', text: 'WHEN NOT MATCHED' },
              { state: 'own', text: 'key is new' },
            ],
          },
        ],
        legend: [{ state: 'own', label: 'Clause that applies' }],
      },
      points: [
        {
          strong: 'Dedupe the source.',
          text: 'Keep the latest row per key before the MERGE, for example with QUALIFY ROW_NUMBER() OVER (PARTITION BY key ORDER BY change_ts DESC) = 1.',
        },
        {
          strong: 'Read the metrics.',
          text: 'DESCRIBE HISTORY reports rows inserted, updated, and deleted for the MERGE version. Compare them with the batch you expected, and alert on a gap.',
        },
        {
          strong: 'Add new columns without a rewrite.',
          text: 'MERGE WITH SCHEMA EVOLUTION adds source columns the target lacks.',
        },
      ],
      examples: [
        {
          label: 'Merge a change batch with schema evolution',
          language: 'sql',
          code: "MERGE WITH SCHEMA EVOLUTION INTO accounts t\nUSING (\n  SELECT * FROM account_changes\n  QUALIFY ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY change_ts DESC) = 1\n) s\nON t.account_id = s.account_id\nWHEN MATCHED AND s.change_type = 'DELETE' THEN DELETE\nWHEN MATCHED THEN UPDATE SET *\nWHEN NOT MATCHED AND s.change_type <> 'DELETE' THEN INSERT *;",
          notes: ['The last clause skips a delete for a key the target never had, so the batch stays repeatable.'],
        },
      ],
    },
    {
      id: 'performance',
      heading: 'Keep MERGE fast',
      points: [
        {
          strong: 'Cluster on the merge key.',
          text: 'Liquid clustering on the join column lets MERGE skip files that cannot match. Use CLUSTER BY AUTO if you are unsure which columns to choose.',
        },
        {
          strong: 'Turn on deletion vectors.',
          text: 'They let UPDATE, DELETE, and MERGE mark rows instead of rewriting whole files.',
        },
        {
          strong: 'Leave maintenance to predictive optimization.',
          text: 'It compacts files and vacuums managed tables without a scheduled job.',
        },
        {
          strong: 'Narrow the match when you can.',
          text: 'Add a predicate on the clustering or partition column, such as the last seven days, to the ON clause so MERGE reads only the files it needs.',
        },
      ],
      links: [
        {
          label: 'Liquid clustering',
          url: 'https://docs.databricks.com/aws/en/delta/clustering',
        },
        {
          label: 'Deletion vectors',
          url: 'https://docs.databricks.com/aws/en/delta/deletion-vectors',
        },
      ],
    },
    {
      id: 'files',
      heading: 'Deliver files from a volume',
      prose:
        'Unity Catalog volumes hold files under the same governance as tables, so access is a grant instead of a shared link. Pick the format by the reader, and write it with the engine that fits the size.',
      table: {
        columns: ['Reader', 'Format and writer'],
        rows: [
          ['Another Spark or SQL system', 'Parquet or Delta, written with Spark'],
          [
            'A partner system or legacy loader',
            'CSV or pipe-delimited text, written with Spark (coalesce only if the consumer needs one file)',
          ],
          ['An API or event consumer', 'JSON lines, written with Spark'],
          ['A person opening it in Excel', 'XLSX, written with openpyxl for small extracts'],
        ],
      },
      points: [
        {
          strong: 'Write large files with Spark.',
          text: 'A pandas frame holds every row in driver memory. Use df.write to a volume path for anything large.',
        },
        {
          strong: 'Share with a grant.',
          text: 'GRANT READ VOLUME to a group. For partners outside the workspace, share the table with OpenSharing instead of copying files.',
        },
        {
          strong: 'Serve applications from Lakebase.',
          text: 'To feed an application with low-latency reads, sync the table to Lakebase Postgres instead of exporting files.',
        },
      ],
      links: [
        {
          label: 'Unity Catalog volumes',
          url: 'https://docs.databricks.com/aws/en/volumes/',
        },
        {
          label: 'Lakebase synced tables',
          url: 'https://docs.databricks.com/aws/en/oltp/projects/sync-tables',
        },
      ],
    },
    {
      id: 'workbook',
      heading: 'Small formatted workbooks',
      prose:
        'When a person will open the file, format it. Volumes do not support random writes, which Excel files need, so build the workbook in a local temporary folder and copy it to the volume.',
      steps: [
        {
          title: 'Header row',
          body: 'Style the header and freeze it so it stays visible while scrolling.',
        },
        {
          title: 'Column widths',
          body: 'Size each column to its longest value, with a minimum and a maximum width.',
        },
        {
          title: 'Number formats',
          body: 'Apply a format such as #,##0.00 to money columns so Excel does not guess.',
        },
      ],
    },
  ],
  related: [
    { slug: 'transformation-patterns', title: 'Transformation patterns' },
    { slug: 'scd-change-capture', title: 'SCD and change capture' },
  ],
};
