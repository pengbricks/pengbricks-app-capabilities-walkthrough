import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'bring-your-own-data',
  area: 'Analyst Guides',
  title: 'Bring your own data',
  intro:
    'A user drops a spreadsheet into a volume folder named after their login and joins it to a governed table. A full outer join keeps keys that appear on only one side, so a bad key shows up as a row instead of disappearing.',
  shortVersion: [
    {
      title: 'Each user gets a folder.',
      body: 'Uploads land in /Volumes/<catalog>/<schema>/uploads/<user>/, where the folder name comes from the login.',
    },
    {
      title: 'The join keeps both sides.',
      body: 'A full outer join labels every key matched, upload_only, or governed_only.',
    },
    {
      title: 'Counts are recorded.',
      body: 'The reference run matched 450 keys, found 30 only in the upload, and found 4,550 customers with no upload row.',
    },
    {
      title: 'The job simulates the upload.',
      body: 'A task writes a 480-row CSV to the caller\'s folder. In real use the person uploads the file in Catalog Explorer.',
    },
    {
      title: 'Governance does not change.',
      body: 'The governed table is read with the caller\'s permissions. The upload is a file, not a new copy of the table.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'From upload to joined table',
      prose:
        'The job creates the customers table, writes the CSV, reads it back with a header and inferred types, and joins on customer_id after trimming whitespace.',
      diagram: {
        type: 'flow',
        title: 'Upload, join, count',
        description:
          'generate_data writes the customers table. simulate_upload writes account_targets.csv to the uploads volume under a folder named after the current user. join_to_governed reads the CSV, full outer joins it to customers on customer_id, and writes byod_joined and byod_match_counts. The task fails if no key matches.',
        lanes: [
          { label: 'Job tasks', fromRow: 0, toRow: 0 },
          { label: 'Storage', fromRow: 1, toRow: 1 },
        ],
        nodes: [
          { id: 'gen', label: 'generate_data', mono: true, col: 0, row: 0 },
          { id: 'upload', label: 'simulate_upload', mono: true, sub: 'writes the CSV', col: 1, row: 0 },
          { id: 'join', label: 'join_to_governed', mono: true, sub: 'full outer join', col: 2, row: 0, kind: 'highlight' },
          { id: 'customers', label: 'customers', mono: true, sub: 'governed table', col: 0, row: 1, kind: 'store' },
          { id: 'csv', label: 'uploads/<user>/', mono: true, sub: 'account_targets.csv', col: 1, row: 1, kind: 'store' },
          { id: 'joined', label: 'byod_joined', mono: true, sub: 'every key, with status', col: 2, row: 1, kind: 'store' },
          { id: 'counts', label: 'byod_match_counts', mono: true, sub: 'one row per status', col: 3, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'gen', to: 'upload' },
          { from: 'upload', to: 'join' },
          { from: 'gen', to: 'customers' },
          { from: 'upload', to: 'csv' },
          { from: 'csv', to: 'join' },
          { from: 'customers', to: 'join' },
          { from: 'join', to: 'joined' },
          { from: 'join', to: 'counts' },
        ],
        legend: [
          { kind: 'highlight', label: 'Join that keeps unmatched keys' },
          { kind: 'store', label: 'Table or volume file' },
        ],
      },
    },
    {
      id: 'status',
      heading: 'What each match status means',
      prose:
        'Match status tells the analyst what to fix. Upload-only rows are typos or retired accounts. Governed-only rows are customers the spreadsheet did not cover.',
      diagram: {
        type: 'matrix',
        title: 'Match status and counts',
        description:
          'matched: the key is in the upload and the customers table, 450 keys. upload_only: the key is in the upload but not in customers, 30 keys. governed_only: the key is in customers but not in the upload, 4,550 keys.',
        corner: 'Status ↓ · Present in →',
        columns: ['Upload', 'customers', 'Keys'],
        rows: [
          { label: 'matched', sub: 'in both', cells: [{ state: 'own', text: 'yes' }, { state: 'own', text: 'yes' }, { state: 'own', text: '450' }] },
          { label: 'upload_only', sub: 'check the key', cells: [{ state: 'own', text: 'yes' }, { state: 'none', text: 'no' }, { state: 'optional', text: '30' }] },
          { label: 'governed_only', sub: 'not in the file', cells: [{ state: 'none', text: 'no' }, { state: 'own', text: 'yes' }, { state: 'optional', text: '4,550' }] },
        ],
        legend: [
          { state: 'own', label: 'Present or matched' },
          { state: 'optional', label: 'Needs a look' },
          { state: 'none', label: 'Absent' },
        ],
        caption: 'Run 933824869009411. 480 uploaded rows: 450 matched plus 30 upload_only.',
      },
    },
    {
      id: 'path',
      heading: 'The per-user path',
      prose:
        'user_folder() lowercases the login and collapses punctuation to underscores, so a.analyst@example.com becomes a_analyst_example_com. The helper has unit tests, and the same rule works for a Unity Catalog grant or a folder-per-team layout.',
      steps: [
        {
          title: 'Upload in the UI',
          body: 'In Catalog Explorer, open the uploads volume, create a folder named after your login, and choose Upload to this volume.',
        },
        {
          title: 'Read it in SQL',
          body: 'Query the file in place before you load anything.',
          code: "SELECT * FROM read_files('/Volumes/<catalog>/<schema>/uploads/<user>/account_targets.csv', format => 'csv', header => true);",
        },
        {
          title: 'Join and keep unmatched keys',
          body: 'Count each status to see how much of the file matched.',
          code: 'SELECT match_status, COUNT(*) FROM <catalog>.<schema>.byod_joined GROUP BY match_status;',
        },
      ],
    },
  ],
  related: [
    { slug: 'sql-notebook-analysis', title: 'SQL and notebooks at scale' },
    { slug: 'no-code-data-prep', title: 'No-code data preparation' },
  ],
};
