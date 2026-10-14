import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'target-loading-outputs',
  area: 'Data Engineering Guides',
  title: 'Target loading and file outputs',
  intro:
    'A job applies 60 inserts, 150 updates, and 40 deletes to a Delta target with one MERGE, records the operation metrics, and writes the result to a Unity Catalog volume as CSV, pipe-delimited text, an Excel workbook, and JSON.',
  shortVersion: [
    {
      title: 'One MERGE does three jobs.',
      body: 'A change type on each source row picks the delete, update, or insert clause.',
    },
    {
      title: 'Metrics come from Delta history.',
      body: 'The job reads numTargetRowsInserted, Updated, and Deleted from the MERGE version and stores them.',
    },
    {
      title: 'The job checks itself.',
      body: 'It fails if the metrics differ from the change batch or the final row count is not 1,020.',
    },
    {
      title: 'Four files, one volume.',
      body: 'Each file holds the same 1,020 rows. File names and sizes are recorded in a table.',
    },
    {
      title: 'The workbook is formatted.',
      body: 'Bold white header on a dark fill, column widths from the data, frozen header row, and a number format on balance.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'From source batch to files',
      prose: 'Three tasks run in order. The first builds the data, the second merges, and the third writes the files.',
      diagram: {
        type: 'flow',
        title: 'Target loading job',
        description:
          'prepare_target creates accounts_target with 1,000 rows and accounts_source_batch with 250 change rows. merge_target runs the MERGE and writes target_merge_metrics. write_outputs reads the merged table, writes four files to the exports volume, and records them in target_output_files.',
        lanes: [
          { label: 'Lakeflow job', fromRow: 0, toRow: 0 },
          { label: 'Unity Catalog', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'prep', label: 'prepare_target', mono: true, sub: 'spec to tables', col: 0, row: 0 },
          { id: 'merge', label: 'merge_target', mono: true, sub: 'MERGE and metrics', col: 1, row: 0, kind: 'highlight' },
          { id: 'write', label: 'write_outputs', mono: true, sub: 'four file formats', col: 2, row: 0 },
          { id: 'tgt', label: 'accounts_target', mono: true, sub: '1,000 then 1,020 rows', col: 0, row: 1, kind: 'store' },
          { id: 'met', label: 'target_merge_metrics', mono: true, sub: 'from Delta history', col: 1, row: 1, kind: 'store' },
          { id: 'vol', label: 'exports volume', mono: true, sub: 'csv, txt, xlsx, json', col: 2, row: 1, kind: 'store' },
          { id: 'src', label: 'accounts_source_batch', mono: true, sub: '250 change rows', col: 0, row: 2, kind: 'store' },
          { id: 'files', label: 'target_output_files', mono: true, sub: 'names and sizes', col: 2, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'prep', to: 'merge' },
          { from: 'merge', to: 'write' },
          { from: 'prep', to: 'tgt' },
          { from: 'prep', to: 'src' },
          { from: 'merge', to: 'met' },
          { from: 'write', to: 'vol' },
          { from: 'write', to: 'files' },
        ],
        legend: [
          { kind: 'highlight', label: 'MERGE step' },
          { kind: 'store', label: 'Table or volume' },
        ],
      },
    },
    {
      id: 'merge',
      heading: 'One MERGE, three clauses',
      prose:
        'Every source row carries a change type. The match condition is the account key. The change type decides which clause fires.',
      diagram: {
        type: 'matrix',
        title: 'MERGE clauses and metrics',
        description:
          'A matched row with change type DELETE is deleted: 40 rows. A matched row with change type UPDATE is updated: 150 rows. A row with no match and change type INSERT is inserted: 60 rows. The target goes from 1,000 to 1,020 rows.',
        corner: 'Change type ↓ · Detail →',
        columns: ['Clause', 'Fires when', 'Rows'],
        rows: [
          {
            label: 'DELETE',
            cells: [{ state: 'own', text: 'WHEN MATCHED' }, { state: 'own', text: 'key exists' }, { state: 'own', text: '40' }],
          },
          {
            label: 'UPDATE',
            cells: [{ state: 'own', text: 'WHEN MATCHED' }, { state: 'own', text: 'key exists' }, { state: 'own', text: '150' }],
          },
          {
            label: 'INSERT',
            cells: [{ state: 'own', text: 'WHEN NOT MATCHED' }, { state: 'own', text: 'key is new' }, { state: 'own', text: '60' }],
          },
        ],
        legend: [{ state: 'own', label: 'Clause that applies' }],
        caption: 'Source rows: 250. Target rows: 1,000 before, 1,020 after.',
      },
    },
    {
      id: 'files',
      heading: 'The four output files',
      prose:
        'write_outputs reads the merged table into a pandas frame and writes each format with the same rows in the same order. The Excel workbook is built in a temporary folder and copied to the volume, because the volume file system does not support the seeks openpyxl makes.',
      table: {
        columns: ['File', 'Format and size'],
        rows: [
          ['accounts_export.csv', 'Comma-delimited, 78,931 bytes'],
          ['accounts_export.txt', 'Pipe-delimited, 78,931 bytes'],
          ['accounts_export.xlsx', 'Excel workbook with formatting, 42,418 bytes'],
          ['accounts_export.json', 'JSON array of records, 195,159 bytes'],
        ],
      },
    },
    {
      id: 'workbook',
      heading: 'Workbook formatting',
      steps: [
        {
          title: 'Header row',
          body: 'Bold white text on a dark fill, centered, and frozen so it stays visible while scrolling.',
        },
        {
          title: 'Column widths',
          body: 'column_widths in de_common/files.py sizes each column to its longest value or header, with a minimum of 8 and a maximum of 50 characters. A unit test covers the clamping.',
        },
        {
          title: 'Number format',
          body: 'The balance column uses #,##0.00.',
        },
      ],
    },
  ],
  related: [
    { slug: 'transformation-patterns', title: 'Transformation patterns' },
    { slug: 'scd-change-capture', title: 'SCD and change capture' },
  ],
};
