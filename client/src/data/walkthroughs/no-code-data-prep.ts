import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'no-code-data-prep',
  area: 'Analyst Guides',
  title: 'No-code data preparation',
  intro:
    'A business user builds a visual data prep in Lakeflow Designer: browse tables, filter, join, rename, derive a column, and save. Designer is UI-only, so the bundle runs the same steps in SQL and writes prep_flow_output. The user compares the flow output with that table.',
  shortVersion: [
    {
      title: 'Six clicks-and-forms steps.',
      body: 'Source, Filter, Join, Select (rename), Custom columns, then Output. No code.',
    },
    {
      title: 'The flow is saved.',
      body: 'Designer stores the visual data prep as a notebook that can run on a schedule or move to Git.',
    },
    {
      title: 'SQL gives the comparison.',
      body: 'The job writes prep_flow_output with the same logic: 99,710 rows and a total of 138,172,774.00.',
    },
    {
      title: 'The check is one query.',
      body: 'Row count and total from the Designer output should equal the numbers in prep_flow_summary.',
    },
    {
      title: 'Permissions apply.',
      body: 'The flow reads and writes Unity Catalog tables with the signed-in user\'s privileges.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'The flow, step by step',
      prose:
        'The canvas runs left to right. Each operator is configured in a side pane and previews its result below the canvas.',
      diagram: {
        type: 'flow',
        title: 'Visual data prep operators',
        description:
          'Two Source operators read orders and customers. A Filter operator keeps completed orders from 2026-01-01. A Join operator links the filtered orders to customers on customer_id. A Select operator renames columns. A Custom columns operator adds order_total and order_size. An Output operator writes the table prep_flow_output_designer to Unity Catalog.',
        nodes: [
          { id: 'orders', label: 'Source: orders', sub: 'Browse existing', col: 0, row: 0 },
          { id: 'filter', label: 'Filter', sub: 'completed, from 2026-01-01', col: 1, row: 0 },
          { id: 'customers', label: 'Source: customers', sub: 'Browse existing', col: 1, row: 1 },
          { id: 'join', label: 'Join', sub: 'on customer_id', col: 2, row: 0, kind: 'highlight' },
          { id: 'select', label: 'Select', sub: 'rename columns', col: 3, row: 0 },
          { id: 'custom', label: 'Custom columns', sub: 'order_total, order_size', col: 4, row: 0 },
          { id: 'out', label: 'Output', sub: 'prep_flow_output_designer', col: 4, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'orders', to: 'filter' },
          { from: 'filter', to: 'join' },
          { from: 'customers', to: 'join' },
          { from: 'join', to: 'select' },
          { from: 'select', to: 'custom' },
          { from: 'custom', to: 'out' },
        ],
        legend: [
          { kind: 'highlight', label: 'Two inputs' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
      },
    },
    {
      id: 'sql',
      heading: 'The same flow in SQL',
      prose:
        'Each operator has a line in sql/prep_flow_output.sql. The job runs it, so the guide has a table to compare with.',
      diagram: {
        type: 'matrix',
        title: 'Operator and SQL equivalent',
        description:
          'Source maps to FROM orders and customers. Filter maps to WHERE status = completed and order_ts >= 2026-01-01. Join maps to JOIN customers ON customer_id. Select maps to column aliases such as order_number and sales_region. Custom columns maps to order_total and order_size expressions.',
        corner: 'Operator ↓ · Form →',
        columns: ['In Designer', 'In SQL'],
        rows: [
          { label: 'Source', sub: 'two tables', cells: [{ state: 'own', text: 'Browse existing' }, { state: 'own', text: 'FROM orders o' }] },
          { label: 'Filter', sub: 'two conditions', cells: [{ state: 'own', text: 'condition builder' }, { state: 'own', text: 'WHERE status = ...' }] },
          { label: 'Join', sub: 'inner', cells: [{ state: 'own', text: 'pick matching columns' }, { state: 'own', text: 'JOIN ... ON' }] },
          { label: 'Select', sub: 'rename', cells: [{ state: 'own', text: 'Rename field' }, { state: 'own', text: 'AS sales_region' }] },
          { label: 'Custom columns', sub: 'derive', cells: [{ state: 'own', text: 'Formula' }, { state: 'own', text: 'CASE WHEN ...' }] },
        ],
        legend: [{ state: 'own', label: 'Equivalent step' }],
      },
    },
    {
      id: 'compare',
      heading: 'Compare the two outputs',
      prose:
        'Run the job, build the flow, then compare row counts and totals. A difference points at one operator, usually a filter condition or a join type.',
      steps: [
        {
          title: 'Reference numbers',
          body: 'prep_flow_summary holds the SQL output counts: 99,710 rows, 5,000 customers, a total of 138,172,774.00 (run 770669008949852).',
          code: 'SELECT * FROM <catalog>.<schema>.prep_flow_summary;',
        },
        {
          title: 'Designer numbers',
          body: 'Query the table your flow wrote.',
          code: 'SELECT COUNT(*) AS output_rows, SUM(order_total) AS output_total\nFROM <catalog>.<schema>.prep_flow_output_designer;',
        },
        {
          title: 'Row-level difference',
          body: 'If the totals differ, list rows that appear on one side only.',
          code: 'SELECT order_number FROM <catalog>.<schema>.prep_flow_output\nEXCEPT\nSELECT order_number FROM <catalog>.<schema>.prep_flow_output_designer;',
        },
      ],
    },
    {
      id: 'saved',
      heading: 'Save and rerun',
      points: [
        { strong: 'Saved flow.', text: 'Designer saves the visual data prep as <name>.designer.ipynb. Place it in a Git folder to version it.' },
        { strong: 'Schedule.', text: 'Use the Schedule button in Designer, or run the file as a job task.' },
        { strong: 'Write mode.', text: 'Output defaults to Overwrite. Append and Merge are available for tables.' },
      ],
    },
  ],
  related: [
    { slug: 'bring-your-own-data', title: 'Bring your own data' },
    { slug: 'in-platform-visualization', title: 'Charts and dashboards in the platform' },
  ],
};
