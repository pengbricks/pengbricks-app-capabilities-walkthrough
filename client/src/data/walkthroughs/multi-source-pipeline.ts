import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'multi-source-pipeline',
  area: 'Ingestion',
  title: 'Multi-source pipeline',
  intro:
    'One Lakeflow Declarative Pipeline reads a database extract, landed CSV files, and landed API pages. Each source maps its own column names into the same shape and tags its rows with a source_system value. The output is one customers_conformed table with 260 rows.',
  shortVersion: [
    {
      title: 'Three sources, one pipeline.',
      body: 'A materialized view reads the database extract. Two streaming tables read files and API pages with Auto Loader.',
    },
    {
      title: 'Each source keeps its own staging table.',
      body: 'Raw column names and types stay visible in the stg_ tables, so a mapping mistake is easy to trace.',
    },
    {
      title: 'One query holds the mapping.',
      body: 'customers_conformed has one SELECT branch per source. They produce the same seven columns.',
    },
    {
      title: 'Every row names its source.',
      body: 'source_system is database, files, or api. An expectation fails the update if a row has no value.',
    },
    {
      title: 'The counts are checked.',
      body: 'The last task compares 120, 80, and 60 rows with the inputs and confirms each (source_system, source_id) is unique.',
    },
  ],
  sections: [
    {
      id: 'graph',
      heading: 'The pipeline graph',
      prose:
        'A first task prepares the three inputs. The pipeline then stages each source and combines them. A last task checks the result.',
      diagram: {
        type: 'flow',
        title: 'Three sources into one table',
        description:
          'prepare_inputs writes the ms_db_customers Delta table, a CSV file in the landing volume, and JSON-lines API pages in the landing volume. In the pipeline, stg_db_customers is a materialized view over the extract. stg_files_customers and stg_api_users are Auto Loader streaming tables. All three feed customers_conformed, which feeds customers_by_source. verify_conformed checks the counts.',
        lanes: [
          { label: 'Inputs', fromRow: 0, toRow: 2 },
          { label: 'Lakeflow Declarative Pipeline', fromRow: 0, toRow: 2 },
        ],
        nodes: [
          { id: 'db', label: 'ms_db_customers', mono: true, sub: 'database extract', col: 0, row: 0, kind: 'store' },
          { id: 'files', label: 'Landed CSV file', sub: 'volume, 80 rows', col: 0, row: 1, kind: 'store' },
          { id: 'api', label: 'Landed API pages', sub: 'volume, 60 rows', col: 0, row: 2, kind: 'store' },
          { id: 'sdb', label: 'stg_db_customers', mono: true, sub: 'materialized view', col: 1, row: 0 },
          { id: 'sfiles', label: 'stg_files_customers', mono: true, sub: 'Auto Loader', col: 1, row: 1 },
          { id: 'sapi', label: 'stg_api_users', mono: true, sub: 'Auto Loader', col: 1, row: 2 },
          { id: 'conf', label: 'customers_conformed', mono: true, sub: '260 rows', col: 2, row: 1, kind: 'highlight' },
          { id: 'by', label: 'customers_by_source', mono: true, col: 3, row: 0, kind: 'store' },
          { id: 'verify', label: 'verify_conformed', mono: true, sub: 'job task', col: 3, row: 2 },
        ],
        edges: [
          { from: 'db', to: 'sdb' },
          { from: 'files', to: 'sfiles' },
          { from: 'api', to: 'sapi' },
          { from: 'sdb', to: 'conf', label: "'database'" },
          { from: 'sfiles', to: 'conf', label: "'files'" },
          { from: 'sapi', to: 'conf', label: "'api'" },
          { from: 'conf', to: 'by' },
          { from: 'conf', to: 'verify' },
        ],
        legend: [
          { kind: 'highlight', label: 'Conformed table' },
          { kind: 'store', label: 'Landed data or output table' },
        ],
        caption: 'Edge labels show the source_system value each branch writes.',
      },
    },
    {
      id: 'mapping',
      heading: 'How three shapes become one',
      prose:
        'The three sources name the same fields differently. The conformed query maps each one. The API has no signup date, so created_date is NULL for those rows.',
      diagram: {
        type: 'matrix',
        title: 'Column mapping by source',
        description:
          'source_id comes from customer_id, cust_no, or id. full_name joins first_name and last_name for the database, comes from name for files, and joins firstName and lastName for the API. email comes from email, mail, or email. city comes from city, town, or address.city. country comes from country, nation, or address.country. created_date comes from created_date or signup_date, and is NULL for the API.',
        corner: 'Conformed column ↓ · Source →',
        columns: ['database', 'files', 'api'],
        rows: [
          {
            label: 'source_id',
            cells: [
              { state: 'own', text: 'customer_id' },
              { state: 'own', text: 'cust_no' },
              { state: 'own', text: 'id' },
            ],
          },
          {
            label: 'full_name',
            cells: [
              { state: 'own', text: 'first + last name' },
              { state: 'own', text: 'name' },
              { state: 'own', text: 'firstName + lastName' },
            ],
          },
          {
            label: 'email',
            cells: [
              { state: 'own', text: 'email' },
              { state: 'own', text: 'mail' },
              { state: 'own', text: 'email' },
            ],
          },
          {
            label: 'city',
            cells: [
              { state: 'own', text: 'city' },
              { state: 'own', text: 'town' },
              { state: 'own', text: 'address.city' },
            ],
          },
          {
            label: 'country',
            cells: [
              { state: 'own', text: 'country' },
              { state: 'own', text: 'nation' },
              { state: 'own', text: 'address.country' },
            ],
          },
          {
            label: 'created_date',
            cells: [
              { state: 'own', text: 'created_date' },
              { state: 'own', text: 'signup_date' },
              { state: 'none', text: 'NULL' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Source column used' },
          { state: 'none', label: 'Not available in this source' },
        ],
      },
    },
    {
      id: 'counts',
      heading: 'What the run produced',
      prose: 'The pipeline uses a full refresh because the job regenerates its inputs each time.',
      table: {
        caption: 'customers_by_source for the successful run',
        columns: ['source_system', 'rows and distinct countries'],
        rows: [
          ['database', '120 rows, 10 countries'],
          ['files', '80 rows, 10 countries'],
          ['api', '60 rows, 1 country (the API returns one country for every user)'],
        ],
      },
    },
    {
      id: 'extend',
      heading: 'Adding or changing a source',
      steps: [
        {
          title: 'Stage it',
          body: 'Add one file under src/pipelines/multi_source/ that reads the source with its own names and types.',
        },
        {
          title: 'Map it',
          body: 'Add one SELECT branch to customers_conformed.sql with a new source_system value.',
          code: "UNION ALL\nSELECT 'crm', CAST(account_id AS STRING), account_name, email, city, country, opened_on\nFROM stg_crm_accounts",
        },
        {
          title: 'Check it',
          body: 'Add its row count to verify_multi_source.py so a silent drop fails the job.',
        },
      ],
    },
  ],
  related: [
    { slug: 'relational-db-ingestion', title: 'Relational database extracts' },
    { slug: 'file-format-ingestion', title: 'File format ingestion' },
  ],
};
