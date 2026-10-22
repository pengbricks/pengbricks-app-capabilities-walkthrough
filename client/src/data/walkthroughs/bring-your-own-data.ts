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
        body: 'Uploads land in a volume or sandbox schema with grants on a group. Spreadsheets live where Unity Catalog controls who sees them, not on laptops and shared drives.',
      },
      {
        title: 'Fewer silent errors',
        body: 'A declared schema stops a stray value from changing a column type. A full outer join labels unmatched keys, so a typo shows up as a row to fix.',
      },
      {
        title: 'Analyst self-service',
        body: 'Catalog Explorer, Lakeflow Designer, and the Excel Add-in give analysts three ways in, so a one-off list does not need an engineering request.',
      },
      {
        title: 'Deliberate promotion',
        body: 'One-off uploads stay in the sandbox under a retention rule. A file that others need becomes a governed table with an owner.',
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
      options: {
        caption: 'Ways to bring a file in',
        rows: [
          {
            option: 'Catalog Explorer upload',
            when: 'A CSV or Excel file to keep as is (upload to a volume), or a file that should become a table (create a table from the uploaded file).',
            tradeoffs:
              'Nothing to install, and the file lands in a governed location with grants. It is a one-off: nobody refreshes it, and a table built from a file takes guessed column types unless you give a schema.',
          },
          {
            option: 'Lakeflow Designer',
            when: 'A no-code user who wants to clean the file, bringing it into a visual data prep.',
            tradeoffs:
              'Steps are visual and the saved flow can run on a schedule. Lakeflow Designer is generally available. Builders need a sandbox schema to write to, and flows with growing logic should move to code.',
          },
          {
            option: 'Excel Add-in',
            when: 'Someone who already lives in Excel and wants to import tables and write a sheet back to a Unity Catalog table.',
            tradeoffs:
              'Generally available. It queries a SQL warehouse as the signed-in user, so grants apply. A write-back target needs its own schema and grants so it stays apart from production tables.',
          },
          {
            option: 'Auto Loader or a file-arrival trigger on the volume',
            when: 'A file that arrives on a schedule, so a manual upload does not fit.',
            tradeoffs:
              'Each new file loads on its own, and the pipeline remembers what it has read. Someone has to own the pipeline and handle schema changes.',
          },
        ],
        recommendation:
          "Upload to a volume for one-off analysis, use Designer or the Excel Add-in when the user's tool decides the route, and use Auto Loader once a file arrives on a schedule.",
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
        {
          label: 'Auto Loader',
          url: 'https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/',
          note: 'Incremental ingestion for recurring files.',
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
          notes: [
            'An explicit schema stops a stray text value from changing a column type. Rows that do not fit land in _rescued_data.',
          ],
        },
      ],
      options: {
        caption: 'Where an uploaded file lives while it is used',
        rows: [
          {
            option: 'Query it in place with read_files',
            when: 'Exploration or a one-off join.',
            tradeoffs:
              "No table to own, and the file stays in the user's folder. Every query parses the file again and infers types unless you pass a schema.",
          },
          {
            option: 'Load it into a table in the sandbox schema',
            when: 'One person or team reuses the data several times.',
            tradeoffs:
              'Types are fixed once and permissions work at table level. Someone refreshes it when the file changes, and it adds objects to tag, review, and expire.',
          },
          {
            option: 'Promote it to a governed schema',
            when: 'The data becomes a shared input.',
            tradeoffs:
              'A named owner, a schema, and a refresh plan make it reliable for others. It takes review and process, so use it only once other people depend on it.',
          },
        ],
        recommendation:
          'Query in place first, load to the sandbox when you reuse the data, and promote to a governed schema only when others depend on it and someone owns it.',
      },
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
          {
            label: 'matched',
            sub: 'in both',
            cells: [
              { state: 'own', text: 'yes' },
              { state: 'own', text: 'yes' },
            ],
          },
          {
            label: 'upload_only',
            sub: 'check the key',
            cells: [
              { state: 'own', text: 'yes' },
              {
                state: 'none',
                text: 'no',
                detail: 'Upload-only rows are typos or retired accounts, so check the key.',
              },
            ],
          },
          {
            label: 'governed_only',
            sub: 'not in the file',
            cells: [
              { state: 'none', text: 'no', detail: 'Governed-only rows are customers the spreadsheet did not cover.' },
              { state: 'own', text: 'yes' },
            ],
          },
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
