import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'no-code-data-prep',
  area: 'Analyst Guides',
  title: 'No-code data preparation',
  intro:
    'Lakeflow Designer (GA) lets a business user prepare data on a drag-and-drop canvas or in natural language, with every step governed by Unity Catalog. Each visual data prep is backed by real code, so it can move to production without a rebuild. This page covers how to build a flow, how to govern who builds and publishes, and when to hand work to an engineer.',
  shortVersion: [
    {
      title: 'Build visually or by describing the step.',
      body: 'Add operators such as Source, Filter, Join, Aggregate, and Output on the canvas, or search by intent and let Designer pick the operator. Each operator shows a description you can edit to reconfigure it.',
    },
    {
      title: 'Start from governed data.',
      body: 'A Source reads a Unity Catalog table, a file, or a metric view. Using a metric view keeps the business definition of a measure the same as in dashboards.',
    },
    {
      title: 'The flow is code.',
      body: 'Designer saves a visual data prep as a notebook named <name>.designer.ipynb. Put it in a Git folder, schedule it as a job, or deploy it with a bundle.',
    },
    {
      title: 'Governance is Unity Catalog.',
      body: 'The flow reads and writes with the signed-in user’s privileges. Give builders a sandbox schema to write to, and promote outputs to production schemas deliberately.',
    },
    {
      title: 'Hand off when logic outgrows the canvas.',
      body: 'Move to SQL or a declarative pipeline when a flow needs tests, shared logic, or heavy scale. The generated code is the starting point.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'Build a flow',
      prose:
        'The canvas runs left to right. Each operator is configured in a side pane and previews its result below the canvas. Changing a source invalidates the cached output of every operator after it.',
      diagram: {
        type: 'flow',
        title: 'A typical visual data prep',
        description:
          'Two Source operators read an orders table and a customers table. A Filter operator keeps the rows you want. A Join operator links orders to customers on a key. A Select operator renames columns. A Custom columns operator derives new fields. An Output operator writes a table to Unity Catalog.',
        nodes: [
          { id: 'orders', label: 'Orders', sub: 'Source', col: 0, row: 0 },
          { id: 'filter', label: 'Filter', sub: 'keep matching rows', col: 1, row: 0 },
          { id: 'customers', label: 'Customers', sub: 'Source', col: 1, row: 1 },
          { id: 'join', label: 'Join', sub: 'on a shared key', col: 2, row: 0, kind: 'highlight' },
          { id: 'select', label: 'Select', sub: 'rename columns', col: 3, row: 0 },
          { id: 'custom', label: 'Custom columns', sub: 'derive new fields', col: 4, row: 0 },
          { id: 'out', label: 'Output', sub: 'table in Unity Catalog', col: 4, row: 1, kind: 'store' },
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
      links: [
        {
          label: 'Lakeflow Designer',
          url: 'https://docs.databricks.com/aws/en/designer/',
        },
        {
          label: 'Built-in operators',
          url: 'https://docs.databricks.com/aws/en/designer/built-in-operators',
        },
      ],
    },
    {
      id: 'govern',
      heading: 'Govern who builds and publishes',
      points: [
        {
          strong: 'Give builders a sandbox.',
          text: 'Grant the analysts group CREATE TABLE on one sandbox schema. Outputs land there, not in production schemas.',
        },
        {
          strong: 'Publish through review.',
          text: 'Store the file in a Git folder and promote it through a pull request, a job, and a bundle. A production schema gets its table from a job running as a service principal.',
        },
        {
          strong: 'Check the output with lineage.',
          text: 'Catalog Explorer shows which tables a flow read and wrote, so a reviewer can confirm sources before approving.',
        },
        {
          strong: 'Reuse measures from metric views.',
          text: 'Source a metric view and pick dimensions and measures, so the number matches the AI/BI dashboard.',
        },
        {
          strong: 'Extend with user-defined operators.',
          text: 'Platform teams can publish approved operators built on Unity Catalog functions, so users get vetted steps instead of copying code.',
        },
      ],
    },
    {
      id: 'saved',
      heading: 'Save, schedule, and promote',
      points: [
        { strong: 'Saved flow.', text: 'Designer saves the visual data prep as <name>.designer.ipynb. Place it in a Git folder to version it.' },
        { strong: 'Schedule.', text: 'Use the Schedule button in Designer, or run the file as a job task.' },
        { strong: 'Write mode.', text: 'Output defaults to Overwrite. Append and Merge are available for tables, so pick the one that matches how the data arrives.' },
        { strong: 'Edited in Git.', text: 'If someone changes an operator’s generated code outside Designer, Designer blocks edits to that operator until you choose Regenerate code.' },
      ],
      links: [
        {
          label: 'Move a visual data prep to production',
          url: 'https://docs.databricks.com/aws/en/designer/production',
        },
      ],
    },
    {
      id: 'choose',
      heading: 'Designer, Genie, or code',
      table: {
        columns: ['Need', 'Use'],
        rows: [
          ['Repeatable cleanup and joins by a business user', 'Lakeflow Designer'],
          ['A one-off answer in plain language', 'Genie Agents or Genie One'],
          ['Help writing or fixing SQL or Python', 'Genie Code'],
          ['Tested, shared, or high-volume transformations', 'SQL or a Lakeflow Spark Declarative Pipeline, owned by data engineering'],
        ],
      },
    },
  ],
  related: [
    { slug: 'bring-your-own-data', title: 'Bring your own data' },
    { slug: 'in-platform-visualization', title: 'Charts and dashboards in the platform' },
  ],
};
