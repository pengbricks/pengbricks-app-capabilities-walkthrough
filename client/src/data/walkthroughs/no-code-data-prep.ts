import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'no-code-data-prep',
  area: 'Analyst Guides',
  title: 'Lakeflow Designer: no-code data preparation',
  intro:
    'Lakeflow Designer (GA) lets a business user prepare data on a drag-and-drop canvas or in natural language, with every step governed by Unity Catalog. Each visual data prep is backed by real code, so it can move to production without a rebuild. This page covers how to build a flow, how to govern who builds and publishes, and when to hand work to an engineer.',
  businessValue: {
    summary:
      'Business users can prepare data on a visual canvas or by describing the step, under Unity Catalog governance. Analytics leaders shorten the wait for engineering and keep a path to production.',
    outcomes: [
      {
        title: 'Shorter engineering queue',
        body: 'Business users build flows with drag-and-drop operators or natural language, so routine data prep does not wait for an engineer.',
      },
      {
        title: 'Governed by default',
        body: 'A flow reads and writes with the privileges of the signed-in user. Builders write to a sandbox schema, and outputs reach production schemas only when someone promotes them.',
      },
      {
        title: 'No rebuild for production',
        body: 'Each flow saves as a notebook, so it can live in a Git folder, run as a scheduled job, or deploy with a bundle.',
      },
      {
        title: 'Consistent business definitions',
        body: 'A Source can read a metric view, so a measure in a prepared dataset matches the same measure in dashboards.',
      },
    ],
  },
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
          {
            id: 'orders',
            label: 'Orders',
            sub: 'Source',
            col: 0,
            row: 0,
            icon: 'database',
            domain: 'data',
            detail: 'A Source operator that reads the orders table.',
          },
          {
            id: 'filter',
            label: 'Filter',
            sub: 'keep matching rows',
            col: 1,
            row: 0,
            icon: 'gear-data',
            domain: 'data',
            detail: 'A Filter operator that keeps the rows you want.',
          },
          {
            id: 'customers',
            label: 'Customers',
            sub: 'Source',
            col: 1,
            row: 1,
            icon: 'database',
            domain: 'data',
            detail: 'A Source operator that reads the customers table.',
          },
          {
            id: 'join',
            label: 'Join',
            sub: 'on a shared key',
            col: 2,
            row: 0,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'data',
            detail: 'A Join operator that links orders to customers on a shared key.',
          },
          {
            id: 'select',
            label: 'Select',
            sub: 'rename columns',
            col: 3,
            row: 0,
            icon: 'gear-data',
            domain: 'data',
            detail: 'A Select operator that renames columns.',
          },
          {
            id: 'custom',
            label: 'Custom columns',
            sub: 'derive new fields',
            col: 4,
            row: 0,
            icon: 'gear-data',
            domain: 'data',
            detail: 'A Custom columns operator that derives new fields.',
          },
          {
            id: 'out',
            label: 'Output',
            sub: 'table in Unity Catalog',
            col: 4,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'governance',
            detail: 'An Output operator that writes the result as a table in Unity Catalog.',
          },
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
        {
          strong: 'Saved flow.',
          text: 'Designer saves the visual data prep as <name>.designer.ipynb. Place it in a Git folder to version it.',
        },
        { strong: 'Schedule.', text: 'Use the Schedule button in Designer, or run the file as a job task.' },
        {
          strong: 'Write mode.',
          text: 'Output defaults to Overwrite. Append and Merge are available for tables, so pick the one that matches how the data arrives.',
        },
        {
          strong: 'Edited in Git.',
          text: 'If someone changes an operator’s generated code outside Designer, Designer blocks edits to that operator until you choose Regenerate code.',
        },
      ],
      links: [
        {
          label: 'Move a visual data prep to production',
          url: 'https://docs.databricks.com/aws/en/designer/production',
        },
      ],
    },
    {
      id: 'run-it',
      heading: 'Run it: build the flow from a prompt',
      prose:
        'The bundle job generates the sample tables, and one pre-written prompt rebuilds the same flow in Lakeflow Designer. The prompt names the two source tables, each operator, the filter, the join, the derived columns, the final column list and the output table, so the result can be checked against the SQL version.',
      steps: [
        {
          title: '1. Deploy the bundle and generate the data',
          body: 'From the reference/analyst folder, deploy the analyst bundle and run only the generate_data task, which is notebook 01_generate_data. It writes analyst_customers and analyst_orders with a fixed seed. Safe to rerun: each table is overwritten.',
          code: 'databricks bundle deploy --target dev\ndatabricks bundle run capability_guides_no_code_prep --only generate_data --target dev',
        },
        {
          title: '2. Open Lakeflow Designer',
          body: 'Click the plus icon (New) in the sidebar and choose Visual data prep. The Genie Code prompt sits above the canvas in a new visual data prep.',
        },
        {
          title: '3. Paste the prompt',
          body: 'Replace <catalog> and <schema> with the values the job used, then paste the text into the Genie Code prompt. Genie Code adds and connects the operators. Select each operator and read its configuration and preview before you run.',
          code: "Sources: <catalog>.<schema>.analyst_orders and <catalog>.<schema>.analyst_customers.\nFilter analyst_orders to rows where status is equal to completed and order_ts is on or after 2026-01-01.\nJoin the filtered orders to analyst_customers on customer_id (inner join).\nAdd Custom columns: order_date = order_ts cast to a date, order_total = quantity * unit_price cast to decimal(12,2), and order_size = 'large' when quantity * unit_price is 1000 or more, otherwise 'standard'.\nAdd a Select operator that keeps only these columns, in this order: order_number (renamed from order_id), customer_id, sales_region (renamed from region), customer_segment (renamed from segment), order_date, quantity, unit_price, order_total, order_size.\nWrite the result to the table <catalog>.<schema>.prep_flow_output_designer, overwrite mode.",
        },
        {
          title: '4. Check the result against the SQL version',
          body: 'Click Run all, then run the build_flow_output task, which is notebook 02_build_flow_output. It writes prep_flow_output and prep_flow_summary. The reference run has 99,710 rows, 5,000 customers and a total of 138,172,774.00. The two EXCEPT queries must return no rows.',
          code: 'databricks bundle run capability_guides_no_code_prep --only build_flow_output --target dev\n\nSELECT * FROM <catalog>.<schema>.prep_flow_summary;\nSELECT COUNT(*) AS output_rows, SUM(order_total) AS output_total, COUNT(DISTINCT customer_id) AS customers\nFROM <catalog>.<schema>.prep_flow_output_designer;\n\nSELECT * FROM <catalog>.<schema>.prep_flow_output EXCEPT SELECT * FROM <catalog>.<schema>.prep_flow_output_designer;\nSELECT * FROM <catalog>.<schema>.prep_flow_output_designer EXCEPT SELECT * FROM <catalog>.<schema>.prep_flow_output;',
        },
        {
          title: '5. Save, schedule or promote',
          body: 'Save the file, then follow Save, schedule, and promote above. Use Schedule to rerun it, or place the file in a Git folder and run it as a job task.',
        },
      ],
      points: [
        {
          strong: 'If the generated flow differs.',
          text: 'Select the operator that is off and edit its configuration, usually a filter condition, a join type or a column name. A row count that differs points to the filter or join. Or re-prompt more specifically, naming the operator and the exact condition. The docs say the output may need adjustment, so always check the result.',
        },
        {
          strong: 'Prompt or drag-and-drop.',
          text: 'A prompt is faster for a first draft of a flow with several operators, since one paste adds and connects them. Drag-and-drop is faster for a small change to an existing flow, and you control each setting. Either way, check each operator.',
        },
      ],
      links: [
        {
          label: 'Build a transformation in Designer',
          url: 'https://docs.databricks.com/aws/en/designer/build-transformation',
        },
        { label: 'Lakeflow Designer', url: 'https://docs.databricks.com/aws/en/designer/' },
      ],
    },
    {
      id: 'choose',
      heading: 'Designer, Genie, or code',
      options: {
        caption: 'Designer, Genie, or code',
        rows: [
          {
            option: 'Lakeflow Designer',
            when: 'Repeatable cleanup and joins by a business user.',
            tradeoffs:
              'Generally available. Visual steps save as a file you can version in Git, schedule, and promote. Outputs go to a sandbox schema, and logic that outgrows the operators belongs in code.',
          },
          {
            option: 'Genie Agents or Genie One',
            when: 'A one-off answer in plain language.',
            tradeoffs:
              'Quick answers with no saved pipeline. Accuracy depends on how well the space is set up, so check the SQL it shows. It does not produce a repeatable table.',
          },
          {
            option: 'Genie Code',
            when: 'Help writing or fixing SQL or Python.',
            tradeoffs:
              'It speeds up authors who can read and judge the code. The person still runs, reviews, and owns the result.',
          },
          {
            option: 'SQL or a Lakeflow Spark Declarative Pipeline owned by data engineering',
            when: 'Tested, shared, or high-volume transformations.',
            tradeoffs:
              'Review, tests, and scale controls. It takes engineering time and changes more slowly than a visual flow.',
          },
        ],
        recommendation:
          'Let business users build repeatable cleanup in Designer and ask questions in Genie. Hand a flow to data engineering when it becomes shared or high volume.',
      },
      links: [
        {
          label: 'Lakeflow Designer',
          url: 'https://docs.databricks.com/aws/en/designer/',
          note: 'Visual data prep for business users.',
        },
        {
          label: 'Genie Agents',
          url: 'https://docs.databricks.com/aws/en/genie-agents/',
          note: 'Plain-language questions over governed data.',
        },
        {
          label: 'Genie Code',
          url: 'https://docs.databricks.com/aws/en/genie-code/',
          note: 'AI help for writing and fixing code.',
        },
        {
          label: 'Lakeflow Spark Declarative Pipelines',
          url: 'https://docs.databricks.com/aws/en/ldp/',
          note: 'Pipelines owned by data engineering.',
        },
      ],
    },
  ],
  related: [
    { slug: 'bring-your-own-data', title: 'Bring your own data' },
    { slug: 'in-platform-visualization', title: 'Charts and dashboards in the platform' },
  ],
};
