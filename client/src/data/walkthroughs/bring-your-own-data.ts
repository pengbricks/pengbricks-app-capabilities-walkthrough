import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'bring-your-own-data',
  area: 'Analyst Guides',
  title: 'Bring your own data',
  intro:
    'Analysts often hold a spreadsheet the warehouse does not: targets, mappings, a one-off list. Let them upload it into a governed location, join it to governed tables, and promote it when others need it. This page covers the upload options, how to set up a safe place for uploads, how to read a file reliably, and how to join it without losing bad keys.',
  businessValue: {
    summary:
      'Analysts can join their own spreadsheets to governed tables without a ticket to engineering or an unmanaged file share. Data owners keep control through Unity Catalog.',
    outcomes: [
      {
        title: 'Less shadow data',
        body:
          'Uploads land in a volume or sandbox schema with grants on a group. Spreadsheets live where Unity Catalog controls who sees them, not on laptops and shared drives.',
      },
      {
        title: 'Fewer silent errors',
        body:
          'A declared schema stops a stray value from changing a column type. A full outer join labels unmatched keys, so a typo shows up as a row to fix.',
      },
      {
        title: 'Analyst self-service',
        body:
          'Catalog Explorer, Lakeflow Designer, and the Excel Add-in give analysts three ways in, so a one-off list does not need an engineering request.',
      },
      {
        title: 'Deliberate promotion',
        body:
          'One-off uploads stay in the sandbox under a retention rule. A file that others need becomes a governed table with an owner.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Give users a governed place to upload.',
      body: 'Create a volume or a sandbox schema with grants on a group. Each user gets a folder, and Unity Catalog decides who sees it.',
    },
    {
      title: 'Choose the upload path by the user.',
      body: 'Catalog Explorer uploads a file to a volume or creates a table from it. Lakeflow Designer imports a file into a visual flow. The Excel Add-in reads tables and writes sheets back.',
    },
    {
      title: 'Read files with read_files and an explicit schema.',
      body: 'read_files queries a file in place. A declared schema stops a stray value from changing a column type, and bad rows land in _rescued_data.',
    },
    {
      title: 'Join with a full outer join to see bad keys.',
      body: 'Label every key matched, upload_only, or governed_only. A typo then shows up as a row to fix instead of a silent drop.',
    },
    {
      title: 'Promote what others need.',
      body: 'Keep one-off uploads in the sandbox, with a retention rule. When a file becomes shared, load it into a governed table with an owner.',
    },
  ],
  sections: [
    {
      id: 'options',
      heading: 'Upload options',
      table: {
        columns: ['User and file', 'Use'],
        rows: [
          ['A CSV or Excel file to keep as is', 'Catalog Explorer: upload to a volume'],
          ['A file that should become a table', 'Catalog Explorer: create a table from the uploaded file'],
          ['A no-code user who wants to clean it', 'Lakeflow Designer: bring the file into a visual data prep'],
          ['Someone who already lives in Excel', 'Excel Add-in: import tables, and write a sheet back to a Unity Catalog table'],
          ['A file that arrives on a schedule', 'Auto Loader or a file-arrival trigger on the volume, not a manual upload'],
        ],
      },
      links: [
        {
          label: 'Work with files in Unity Catalog volumes',
          url: 'https://docs.databricks.com/aws/en/ingestion/file-upload/',
        },
        {
          label: 'Databricks Excel Add-in',
          url: 'https://docs.databricks.com/aws/en/integrations/excel/',
        },
        {
          label: 'Lakeflow Designer',
          url: 'https://docs.databricks.com/aws/en/designer/',
        },
      ],
    },
    {
      id: 'path',
      heading: 'Set up a safe place to upload',
      prose:
        'Uploads should not mix with production tables. Use a dedicated volume, or a sandbox schema, where users can write and everyone else cannot read by default. A folder per user, named from the login, keeps files apart. Enforce it with grants instead of trust.',
      points: [
        {
          strong: 'Grant a group, not a person.',
          text: 'GRANT READ VOLUME and WRITE VOLUME on the uploads volume to an analysts group. Give a user access to another user’s folder only by request.',
        },
        {
          strong: 'Tag and expire.',
          text: 'Tag upload objects with an owner and a purpose. Review them on a schedule and remove files nobody uses.',
        },
        {
          strong: 'Separate read from join.',
          text: 'Users read governed tables with their own permissions. The upload is a file in their folder, not a new copy of the table.',
        },
        {
          strong: 'Promote deliberately.',
          text: 'When a file becomes a shared input, load it into a table in a governed schema with a named owner, a schema, and a refresh plan.',
        },
      ],
      steps: [
        {
          title: 'Upload in the UI',
          body: 'In Catalog Explorer, open the uploads volume, open your folder, and choose Upload to this volume.',
        },
        {
          title: 'Read it in SQL',
          body: 'Query the file in place before you load anything.',
          code: "SELECT * FROM read_files('/Volumes/<catalog>/<schema>/uploads/<user>/account_targets.csv', format => 'csv', header => true);",
        },
      ],
      examples: [
        {
          label: 'Read the file with an explicit schema',
          language: 'sql',
          code: "SELECT *\nFROM read_files(\n  '/Volumes/<catalog>/<schema>/uploads/<user>/account_targets.csv',\n  format => 'csv',\n  header => true,\n  schema => 'customer_id STRING, account_owner STRING, annual_target INT'\n);",
          notes: ['An explicit schema stops a stray text value from changing a column type. Rows that do not fit land in _rescued_data.'],
        },
      ],
      links: [
        {
          label: 'read_files table-valued function',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/read_files',
        },
      ],
    },
    {
      id: 'status',
      heading: 'Join and keep unmatched keys',
      prose:
        'A full outer join keeps keys that appear on only one side. The match status tells the analyst what to fix. Upload-only rows are typos or retired accounts. Governed-only rows are customers the spreadsheet did not cover.',
      diagram: {
        type: 'matrix',
        title: 'Match status',
        description:
          'matched: the key is in the upload and in the governed table. upload_only: the key is in the upload but not in the governed table. governed_only: the key is in the governed table but not in the upload.',
        corner: 'Status ↓ · Present in →',
        columns: ['Upload', 'Governed table'],
        rows: [
          { label: 'matched', sub: 'in both', cells: [{ state: 'own', text: 'yes' }, { state: 'own', text: 'yes' }] },
          { label: 'upload_only', sub: 'check the key', cells: [{ state: 'own', text: 'yes' }, { state: 'none', text: 'no' }] },
          { label: 'governed_only', sub: 'not in the file', cells: [{ state: 'none', text: 'no' }, { state: 'own', text: 'yes' }] },
        ],
        legend: [
          { state: 'own', label: 'Present' },
          { state: 'none', label: 'Absent' },
        ],
        caption: 'Trim whitespace and match case on both keys before you join.',
      },
      examples: [
        {
          label: 'Label every key',
          language: 'sql',
          code: "SELECT coalesce(u.customer_id, g.customer_id) AS customer_id,\n       CASE WHEN u.customer_id IS NULL THEN 'governed_only'\n            WHEN g.customer_id IS NULL THEN 'upload_only'\n            ELSE 'matched' END AS match_status\nFROM (SELECT trim(customer_id) AS customer_id, annual_target\n      FROM read_files('/Volumes/<catalog>/<schema>/uploads/<user>/account_targets.csv', format => 'csv', header => true)) u\nFULL OUTER JOIN <catalog>.<schema>.customers g\n  ON u.customer_id = g.customer_id;",
        },
      ],
    },
  ],
  related: [
    { slug: 'sql-notebook-analysis', title: 'SQL and notebooks at scale' },
    { slug: 'no-code-data-prep', title: 'No-code data preparation' },
  ],
};
