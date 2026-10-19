import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'row-column-security',
  area: 'Governance/Monitoring',
  title: 'Row and column security',
  intro:
    'Two sensitive columns get masks and two tables get row filters, all generated from the use-case spec. The same queries then run for several identities. The job identity is tested for real; the other identities are evaluated with the same policy logic, and role switching is the way to test them for real.',
  shortVersion: [
    {
      title: 'Masks sit on the columns.',
      body: 'email and national_id show NULL to the restricted role, the real value to admins, and a partial value to everyone else.',
    },
    {
      title: 'Two filters, two jobs.',
      body: 'An attribute filter hides restricted orders. A dynamic filter limits customers to the regions listed for the caller in a mapping table.',
    },
    {
      title: 'Policies read session_user() first.',
      body: 'An assumed role fails is_member() checks, so each policy matches the restricted role by name before it checks membership.',
    },
    {
      title: 'Access changes are inserts.',
      body: 'Moving someone to another region means adding a row to region_access. No policy is rewritten.',
    },
    {
      title: 'The inventory comes from SQL.',
      body: 'information_schema.column_masks and row_filters list all four policies without opening any table.',
    },
  ],
  sections: [
    {
      id: 'flow',
      examples: [
        {
          label: 'Attach and remove a mask and a row filter',
          language: 'sql',
          code: `CREATE OR REPLACE FUNCTION main.sales.mask_email(v STRING) RETURNS STRING
  RETURN CASE WHEN is_account_group_member('pii_readers') THEN v
              ELSE concat(left(v, 1), '***@', split_part(v, '@', 2)) END;
ALTER TABLE main.sales.customers ALTER COLUMN email SET MASK main.sales.mask_email;

CREATE OR REPLACE FUNCTION main.sales.region_filter(region STRING) RETURNS BOOLEAN
  RETURN is_account_group_member('admins') OR region = 'WEST';
ALTER TABLE main.sales.orders SET ROW FILTER main.sales.region_filter ON (region);

-- Detach
ALTER TABLE main.sales.customers ALTER COLUMN email DROP MASK;
ALTER TABLE main.sales.orders DROP ROW FILTER;`,
          notes: ['The reference code branches on session_user() first; this shorter form uses only group membership.'],
        },
      ],
      heading: 'How the policies are built',
      prose:
        'The spec names the masked columns, the filter columns, and the mapping rows. The job generates the tables, creates the functions, and attaches them to the table objects.',
      diagram: {
        type: 'flow',
        title: 'From spec to policies',
        description:
          'The use-case spec drives generate_data, which writes gov_customers and gov_orders as generated sample data. create_policies writes the region_access mapping table, creates two mask functions and two filter functions, and attaches them with ALTER TABLE. test_policies runs the same queries for several identities. policy_inventory reads information_schema.',
        lanes: [
          { label: 'Spec and data', fromRow: 0, toRow: 0 },
          { label: 'Policies', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'spec', label: 'Use-case spec', sub: 'general.yml', col: 0, row: 0 },
          { id: 'gen', label: 'generate_data', mono: true, sub: 'generated data, fixed seed', col: 1, row: 0 },
          { id: 'tables', label: 'gov_ tables', mono: true, sub: '5,000 and 20,000 rows', col: 2, row: 0, kind: 'store' },
          { id: 'map', label: 'region_access', mono: true, sub: 'principal to region', col: 0, row: 1, kind: 'store' },
          { id: 'create', label: 'create_policies', mono: true, col: 1, row: 1, kind: 'highlight' },
          { id: 'mask', label: 'Column masks', sub: 'email, national_id', col: 2, row: 1, kind: 'surface' },
          { id: 'filter', label: 'Row filters', sub: 'sensitivity, region', col: 3, row: 1, kind: 'surface' },
          { id: 'test', label: 'test_policies', mono: true, sub: 'several identities', col: 1, row: 2 },
          { id: 'inv', label: 'policy_inventory', mono: true, sub: 'information_schema', col: 2, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'spec', to: 'gen' },
          { from: 'gen', to: 'tables' },
          { from: 'map', to: 'create' },
          { from: 'create', to: 'mask' },
          { from: 'create', to: 'filter' },
          { from: 'mask', to: 'tables', dashed: true, label: 'SET MASK' },
          { from: 'create', to: 'test' },
          { from: 'test', to: 'inv' },
        ],
        legend: [
          { kind: 'highlight', label: 'Policy functions and ALTER TABLE' },
          { kind: 'surface', label: 'Attached to the table' },
          { kind: 'store', label: 'Table' },
        ],
        caption: 'The filters attach to the table objects too (SET ROW FILTER), like the masks.',
      },
    },
    {
      id: 'identities',
      heading: 'What each identity sees',
      prose:
        'The numbers below are for customer CUST-000001 and the full tables. The job identity row is a real session. The other two rows apply the same policy logic with the identity swapped in, and they are labelled simulated in the table.',
      diagram: {
        type: 'matrix',
        title: 'Same queries, different identities',
        description:
          'The job identity, an admin, sees 5,000 customers, 20,000 orders, all four regions, and real values. The account users role sees 3,478 customers in EMEA and NA, 17,972 orders, and NULL for both masked columns. The app service principal sees 1,019 customers in APAC, 17,972 orders, a partial email, and a partial national ID.',
        corner: 'Identity ↓ · Result →',
        columns: ['Customers', 'Orders', 'Email', 'National ID'],
        rows: [
          {
            label: 'Job identity',
            sub: 'admin, real session',
            cells: [
              { state: 'own', text: '5,000' },
              { state: 'own', text: '20,000' },
              { state: 'own', text: 'Real value' },
              { state: 'own', text: 'Real value' },
            ],
          },
          {
            label: 'account users role',
            sub: 'simulated',
            cells: [
              { state: 'optional', text: '3,478', sub: 'EMEA, NA' },
              { state: 'optional', text: '17,972' },
              { state: 'none', text: 'NULL' },
              { state: 'none', text: 'NULL' },
            ],
          },
          {
            label: 'App service principal',
            sub: 'simulated',
            cells: [
              { state: 'optional', text: '1,019', sub: 'APAC' },
              { state: 'optional', text: '17,972' },
              { state: 'optional', text: 'u***@example.com' },
              { state: 'optional', text: '***-**-0031' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Everything, real values' },
          { state: 'optional', label: 'Filtered or partial' },
          { state: 'none', label: 'Hidden' },
        ],
        caption: 'Before it reports the other rows, the job checks that the same logic reproduces the real result for the job identity on all five measures.',
      },
    },
    {
      id: 'testing',
      heading: 'Testing as a second identity',
      prose:
        'An admin session cannot confirm a restriction, because admins pass every policy. Three methods exist, and the job uses the third because the first two were not available in this run.',
      diagram: {
        type: 'flow',
        title: 'Ways to test a policy',
        description:
          'Role switching assumes the account users role in the workspace menu and reruns the test queries; this is the real test and is documented in sql/policy_test_queries.sql. Running as the app service principal needs a secret or a run_as binding that this run did not have. Twin evaluation swaps session_user and is_member for literals, and the job runs it after confirming it matches the real result for the job identity.',
        nodes: [
          { id: 'q', label: 'Same test queries', sub: 'policy_test_queries.sql', col: 0, row: 1 },
          { id: 'role', label: 'Role switching', sub: 'real, manual', col: 1, row: 0, kind: 'highlight' },
          { id: 'sp', label: 'Run as service principal', sub: 'needs secret or run_as', col: 1, row: 1 },
          { id: 'twin', label: 'Twin evaluation', sub: 'job does this', col: 1, row: 2, kind: 'surface' },
          { id: 'real', label: 'Real policy result', sub: 'UC evaluates policies', col: 2, row: 0, kind: 'store' },
          { id: 'sim', label: 'Simulated result', sub: 'same logic, literals', col: 2, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'q', to: 'role' },
          { from: 'q', to: 'sp' },
          { from: 'q', to: 'twin' },
          { from: 'role', to: 'real' },
          { from: 'sp', to: 'real', dashed: true, label: 'not run' },
          { from: 'twin', to: 'sim' },
        ],
        legend: [
          { kind: 'highlight', label: 'Real test' },
          { kind: 'surface', label: 'Run by the job' },
        ],
      },
      points: [
        { strong: 'Why session_user().', text: 'While a role is assumed it returns the role name. is_member(\'admins\') is false, and a group is not a member of itself.' },
        { strong: 'Audit survives the switch.', text: 'system.access.audit keeps the human in identity_metadata.run_by and the role in run_as.' },
      ],
    },
    {
      id: 'inventory',
      heading: 'Policy inventory',
      prose: 'The inventory is two queries. A table with no policy is the gap to look for, and it will not appear here unless you compare against the table list.',
      table: {
        caption: 'policy_inventory from the reference run',
        columns: ['Policy', 'Table and column'],
        rows: [
          ['Column mask', 'gov_customers.email (mask_email)'],
          ['Column mask', 'gov_customers.national_id (mask_national_id)'],
          ['Row filter', 'gov_customers.region (filter_customers_region)'],
          ['Row filter', 'gov_orders.sensitivity (filter_orders_sensitivity)'],
        ],
      },
      steps: [
        {
          title: 'List masks and filters',
          body: 'sql/policy_inventory.sql reads information_schema.column_masks and information_schema.row_filters for the whole catalog.',
          code: 'SELECT table_name, column_name, mask_name\nFROM <catalog>.information_schema.column_masks;\nSELECT table_name, filter_name, target_columns\nFROM <catalog>.information_schema.row_filters;',
        },
      ],
    },
  ],
  related: [
    { slug: 'access-management', title: 'Access management' },
    { slug: 'cost-chargeback', title: 'Cost tracking and chargeback' },
  ],
};
