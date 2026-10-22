import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'in-platform-visualization',
  area: 'Analyst Guides',
  title: 'Charts and dashboards in the platform',
  intro:
    'Define each business metric once in a Unity Catalog metric view, then consume it everywhere: AI/BI dashboards, notebook charts, Genie, alerts, and BI tools. A chart and its dashboard tile then show the same number because they share one definition. This page covers the metric view, the dashboard features that matter, notebook charts, and how Genie and Genie Code fit.',
  businessValue: {
    summary:
      'Leaders get one definition of each business metric across dashboards, notebook charts, and Genie answers, so teams stop reconciling conflicting numbers.',
    outcomes: [
      {
        title: 'One number everywhere',
        body: 'A Unity Catalog metric view holds the measure once, and dashboards, notebooks, Genie, and alerts read it. A chart and its dashboard tile show the same value.',
      },
      {
        title: 'New cuts without new reports',
        body: 'A metric view separates measures from dimensions. Users group by any field and the engine computes the right result, so a new breakdown does not need a rebuilt report.',
      },
      {
        title: 'Business users can ask',
        body: 'Genie Agents answer from the same metric views, and Genie One gives business users a place to ask. Answers match the dashboards.',
      },
      {
        title: 'Dashboards under change control',
        body: 'Bundles deploy dashboards, Unity Catalog sets permissions, and teams certify the datasets the dashboards depend on.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Define metrics once, in a metric view.',
      body: 'A metric view separates measures from dimensions. Users group by any field, and the engine computes the right result for each query.',
    },
    {
      title: 'Build the dashboard on governed data.',
      body: 'An AI/BI dashboard reads datasets over metric views or governed views, so logic lives in Unity Catalog and not in each tile.',
    },
    {
      title: 'Use the built-in notebook charts first.',
      body: 'display() and the visualization editor chart a query in place. Use matplotlib or Plotly when you need a custom figure.',
    },
    {
      title: 'Let people ask Genie on the same data.',
      body: 'Genie Agents answer questions from the same metric views, and Genie One gives business users a place to ask. Genie Code helps authors write the queries.',
    },
    {
      title: 'Treat dashboards as code.',
      body: 'Deploy dashboards with bundles, set permissions with Unity Catalog, and certify the datasets they depend on.',
    },
  ],
  sections: [
    {
      id: 'metric',
      heading: 'Define the measure once as a metric view',
      prose:
        'A standard view fixes its grouping when you create it. A metric view stores the measure and the dimensions separately, so one definition of revenue serves a monthly trend, a regional breakdown, and a Genie question. Query it with the MEASURE() function from SQL editors, notebooks, dashboards, Genie, alerts, and BI tools.',
      examples: [
        {
          label: 'Create and query a metric view',
          language: 'sql',
          code: "CREATE OR REPLACE VIEW <catalog>.<schema>.revenue_metrics\nWITH METRICS\nLANGUAGE YAML\nAS $$\n  version: 1.1\n  source: <catalog>.<schema>.analyst_orders\n  dimensions:\n    - name: order_month\n      expr: DATE_TRUNC('MONTH', order_ts)\n  measures:\n    - name: revenue\n      expr: SUM(quantity * unit_price)\n$$;\n\nSELECT order_month, MEASURE(revenue) FROM <catalog>.<schema>.revenue_metrics GROUP BY ALL;",
          notes: ['A metric view keeps the revenue formula in one place for notebooks, dashboards, and Genie.'],
        },
      ],
      points: [
        {
          strong: 'Add agent metadata.',
          text: 'Synonyms, display names, and formats help Genie answer accurately and show values the same way in every tool.',
        },
        {
          strong: 'Materialize heavy metrics.',
          text: 'Metric view materialization pre-computes aggregations, and the engine rewrites queries to use them.',
        },
        {
          strong: 'Reach BI tools.',
          text: 'Power BI and Tableau can query metric views, so a report outside Databricks shares the definition.',
        },
      ],
      options: {
        caption: 'Where a measure is defined',
        rows: [
          {
            option: 'Metric view',
            when: 'The same measure is sliced many ways across dashboards, Genie, notebooks, and BI tools.',
            tradeoffs:
              'One definition serves every consumer through MEASURE(). Someone owns the YAML definition, and SQL authors learn one extra function.',
          },
          {
            option: 'Standard view',
            when: 'A fixed shape, such as a joined and filtered table at one grain.',
            tradeoffs:
              'Plain SQL that everyone knows. A standard view locks in its grouping when you create it, so each new grouping becomes a new view and the formula gets copied.',
          },
          {
            option: 'SQL in a dashboard dataset',
            when: 'One dashboard or a prototype.',
            tradeoffs:
              'The fastest to build. The formula lives in that dashboard only, so other dashboards and Genie rebuild it and the numbers can diverge.',
          },
        ],
        recommendation:
          'Use a metric view for any measure that more than one consumer needs, a standard view for fixed shapes, and dataset SQL for prototypes.',
      },
      links: [
        {
          label: 'Unity Catalog metric views',
          url: 'https://docs.databricks.com/aws/en/metric-views/',
        },
        {
          label: 'Create a metric view',
          url: 'https://docs.databricks.com/aws/en/metric-views/create',
        },
        {
          label: 'Views',
          url: 'https://docs.databricks.com/aws/en/views',
          note: 'Standard views, materialized views, and dynamic views.',
        },
      ],
    },
    {
      id: 'flow',
      heading: 'Build once, consume everywhere',
      prose:
        'Put the logic in the governed layer and keep consumers thin. Every consumer reads through Unity Catalog, so permissions and lineage apply to all of them.',
      diagram: {
        type: 'flow',
        title: 'One source of numbers',
        description:
          'A metric view or governed view sits over the source tables. An AI/BI dashboard, notebook charts, a Genie Agent, and external BI tools all read it.',
        nodes: [
          {
            id: 'tables',
            label: 'Source tables',
            sub: 'governed in Unity Catalog',
            col: 0,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail: 'The governed Unity Catalog tables that the metric view or governed view sits over.',
          },
          {
            id: 'mv',
            label: 'Metric view',
            sub: 'measures and dimensions',
            col: 1,
            row: 1,
            kind: 'highlight',
            icon: 'data-model',
            domain: 'governance',
            detail:
              'Holds the business logic once, as measures and dimensions. Every consumer reads through Unity Catalog, so permissions and lineage apply to all of them.',
          },
          {
            id: 'dash',
            label: 'AI/BI dashboard',
            sub: 'published',
            col: 2,
            row: 0,
            kind: 'surface',
            icon: 'dashboard',
            domain: 'apps',
            detail:
              'A published AI/BI dashboard for the recurring view, with filters and scheduled snapshots. Its datasets point at the metric view.',
          },
          {
            id: 'nb',
            label: 'Notebook charts',
            sub: 'display(), Plotly',
            col: 2,
            row: 1,
            kind: 'surface',
            icon: 'gear-navy',
            domain: 'apps',
            detail:
              'Analysts chart in notebooks with display(), matplotlib, or Plotly. Results update only when someone reruns the code.',
          },
          {
            id: 'genie',
            label: 'Genie Agent',
            sub: 'plain-language questions',
            col: 2,
            row: 2,
            kind: 'surface',
            icon: 'data-search',
            domain: 'apps',
            detail:
              'A Genie Agent answers open-ended questions in plain language over the same metric view, and shows the SQL it ran.',
          },
          {
            id: 'bi',
            label: 'Power BI, Tableau',
            sub: 'over OAuth',
            col: 3,
            row: 1,
            kind: 'surface',
            icon: 'network',
            domain: 'apps',
            detail:
              'Power BI and Tableau read the view over OAuth, with the same Unity Catalog permissions as other consumers.',
          },
        ],
        edges: [
          { from: 'tables', to: 'mv' },
          { from: 'mv', to: 'dash' },
          { from: 'mv', to: 'nb' },
          { from: 'mv', to: 'genie' },
          { from: 'mv', to: 'bi' },
        ],
        legend: [
          { kind: 'highlight', label: 'Business logic, defined once' },
          { kind: 'surface', label: 'Consumer' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
      },
      options: {
        caption: 'Which surface presents the numbers',
        rows: [
          {
            option: 'AI/BI dashboard',
            when: 'A recurring, shared view with filters and scheduled snapshots.',
            tradeoffs:
              'Published and governed, with schedules and subscriptions. The questions are fixed by its authors, and viewers explore through filters and cross-filtering.',
          },
          {
            option: 'Genie Agent or Genie One',
            when: 'Open-ended questions in plain language.',
            tradeoffs:
              'Flexible and needs no SQL. Answer quality depends on how well the space is set up with metric views and instructions, so people should read the SQL it shows. It is not a fixed report.',
          },
          {
            option: 'Notebook charts',
            when: 'Analyst exploration and custom figures.',
            tradeoffs:
              'Full freedom with the visualization editor, matplotlib, or Plotly. The audience needs notebook access, and results update only when someone reruns the code.',
          },
        ],
        recommendation:
          'Use a dashboard for the recurring view, Genie for follow-up questions on the same metric view, and notebook charts for analysis.',
      },
      links: [
        {
          label: 'AI/BI dashboards',
          url: 'https://docs.databricks.com/aws/en/dashboards/',
          note: 'Build, publish, and share.',
        },
        {
          label: 'Genie Agents',
          url: 'https://docs.databricks.com/aws/en/genie-agents/',
          note: 'Plain-language questions over governed data.',
        },
        {
          label: 'Visualizations in notebooks and the SQL editor',
          url: 'https://docs.databricks.com/aws/en/notebooks/visualizations/',
          note: 'Built-in charts and custom figures.',
        },
      ],
    },
    {
      id: 'dashboards',
      heading: 'AI/BI dashboards',
      points: [
        {
          strong: 'Datasets are the query layer.',
          text: 'Point each dataset at a metric view or a governed view. Keep the SQL short, and let parameters and filters narrow it.',
        },
        {
          strong: 'Filters and cross-filtering.',
          text: 'Use page filters, parameters, and cross-filtering so viewers explore without editing a query.',
        },
        {
          strong: 'Credentials.',
          text: 'Shared data permissions give every viewer the same data and a shared cache. Individual data permissions run as each viewer, so row filters and column masks apply.',
        },
        {
          strong: 'Schedule and subscribe.',
          text: 'A schedule refreshes the dashboard, and subscriptions send snapshots to email, Slack, or Microsoft Teams.',
        },
        {
          strong: 'Deploy with a bundle.',
          text: 'The bundle dashboard resource keeps the definition in Git, so changes are reviewed and promoted across environments.',
        },
      ],
      links: [
        {
          label: 'AI/BI dashboards',
          url: 'https://docs.databricks.com/aws/en/dashboards/',
        },
      ],
    },
    {
      id: 'notebooks',
      heading: 'Notebook charts',
      prose:
        'In a notebook or the SQL editor, create a chart from a query result with the built-in visualization editor. It needs no code and updates when the query reruns. Use matplotlib or Plotly when you need a custom figure, and read the data from the same governed view or metric view the dashboard uses.',
      links: [
        {
          label: 'Visualizations in notebooks and the SQL editor',
          url: 'https://docs.databricks.com/aws/en/notebooks/visualizations/',
        },
      ],
    },
    {
      id: 'genie',
      heading: 'Genie and Genie Code',
      points: [
        {
          strong: 'Genie Agents for questions.',
          text: 'Attach a Genie Agent to the metric view and tables behind the dashboard. Business users ask in plain language and see the SQL that answered.',
        },
        {
          strong: 'Genie One for business users.',
          text: 'It is the place where business users ask Genie without learning the workspace.',
        },
        {
          strong: 'Genie Code for authors.',
          text: 'It writes and explains the SQL for a dataset and fixes errors in a notebook.',
        },
      ],
      links: [
        {
          label: 'Genie Agents',
          url: 'https://docs.databricks.com/aws/en/genie-agents/',
        },
        {
          label: 'Genie Code',
          url: 'https://docs.databricks.com/aws/en/genie-code/',
        },
      ],
    },
    {
      id: 'how',
      heading: 'Keep numbers trustworthy',
      points: [
        {
          strong: 'Certify and tag datasets.',
          text: 'Tag the metric views and governed views that are approved for reporting, so authors pick them first.',
        },
        {
          strong: 'Grant consumers the least they need.',
          text: 'Give viewers access to the dashboard and its data through groups. With shared data permissions, viewers need not read the underlying tables.',
        },
        {
          strong: 'Test a change.',
          text: 'When you change a metric, compare the dashboard dataset and the view for the same filter before you publish. A reconciliation in a job catches a drift in logic.',
        },
      ],
    },
  ],
  related: [
    { slug: 'self-service-extracts', title: 'Self-service extracts and subscriptions' },
    { slug: 'sql-notebook-analysis', title: 'SQL and notebooks at scale' },
    { slug: 'genie-agents', title: 'Genie Agents: setup, instructions, and data handling' },
  ],
};
