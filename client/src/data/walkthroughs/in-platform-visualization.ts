import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'in-platform-visualization',
  area: 'Analyst Guides',
  title: 'Charts and dashboards in the platform',
  intro:
    'Two governed views feed both a notebook that draws matplotlib charts and a published AI/BI dashboard. A final task runs the dashboard\'s own dataset queries and compares their totals with the views and the notebook, so a chart and its dashboard tile show the same number.',
  shortVersion: [
    {
      title: 'Two governed views.',
      body: 'v_revenue_by_month and v_revenue_by_region_segment hold the business logic once.',
    },
    {
      title: 'Notebook charts go to a volume.',
      body: 'The notebook draws a line chart and a stacked bar chart, then saves both PNG files to the charts volume.',
    },
    {
      title: 'The dashboard reads the same views.',
      body: 'Its two datasets are SELECT statements over the views, with counters, a line chart, a bar chart, and a table.',
    },
    {
      title: 'Totals are compared.',
      body: 'Dashboard, view, and notebook totals are all 246,476,934.00 for both views.',
    },
    {
      title: 'A mismatch fails the job.',
      body: 'confirm_totals raises an error when the three totals differ by more than half a cent.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'Views first, then charts',
      prose:
        'The job builds the views, then the notebook reads them. The dashboard is deployed by the bundle and reads the same views. confirm_totals closes the loop.',
      diagram: {
        type: 'flow',
        title: 'One source of numbers',
        description:
          'generate_data writes customers and orders. create_views defines v_revenue_by_month and v_revenue_by_region_segment. notebook_charts reads the views, saves two PNG files to the charts volume, and writes chart_totals. The published dashboard reads the same views. confirm_totals runs the dashboard dataset queries, compares their totals with the views and with chart_totals, and writes totals_check.',
        lanes: [
          { label: 'Job tasks', fromRow: 0, toRow: 0 },
          { label: 'Governed objects', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'gen', label: 'generate_data', mono: true, col: 0, row: 0 },
          { id: 'views', label: 'create_views', mono: true, col: 1, row: 0 },
          { id: 'nb', label: 'notebook_charts', mono: true, sub: 'matplotlib', col: 2, row: 0, kind: 'highlight' },
          { id: 'confirm', label: 'confirm_totals', mono: true, sub: 'compare three totals', col: 3, row: 0, kind: 'gate' },
          { id: 'v1', label: 'v_revenue_by_month', mono: true, col: 1, row: 1, kind: 'store' },
          { id: 'v2', label: 'Region and segment view', sub: 'v_revenue_by_region', col: 1, row: 2, kind: 'store' },
          { id: 'png', label: 'charts volume', sub: 'two PNG files', col: 2, row: 1, kind: 'store' },
          { id: 'dash', label: 'AI/BI dashboard', sub: 'published', col: 3, row: 1, kind: 'surface' },
          { id: 'check', label: 'totals_check', mono: true, sub: 'one row per view', col: 3, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'gen', to: 'views' },
          { from: 'views', to: 'nb' },
          { from: 'nb', to: 'confirm' },
          { from: 'views', to: 'v1' },
          { from: 'views', to: 'v2' },
          { from: 'v1', to: 'png', label: 'read' },
          { from: 'v1', to: 'dash', dashed: true },
          { from: 'v2', to: 'dash', dashed: true },
          { from: 'dash', to: 'confirm', dashed: true },
          { from: 'confirm', to: 'check' },
        ],
        legend: [
          { kind: 'highlight', label: 'Notebook charts' },
          { kind: 'gate', label: 'Fails on mismatch' },
          { kind: 'surface', label: 'Dashboard' },
        ],
      },
    },
    {
      id: 'totals',
      heading: 'The three totals',
      prose:
        'Each view has three totals: the view itself, the notebook\'s plotted values, and the dashboard dataset. The reference run found them equal.',
      diagram: {
        type: 'matrix',
        title: 'Revenue totals by source',
        description:
          'For v_revenue_by_month, the view total, the dashboard dataset total, and the notebook chart total are all 246,476,934.00. For v_revenue_by_region_segment, all three totals are also 246,476,934.00.',
        corner: 'View ↓ · Source →',
        columns: ['View', 'Dashboard', 'Notebook'],
        rows: [
          { label: 'by_month', sub: 'v_revenue_by_month', cells: [{ state: 'own', text: '246,476,934.00' }, { state: 'own', text: '246,476,934.00' }, { state: 'own', text: '246,476,934.00' }] },
          { label: 'by_region_segment', sub: 'region and segment', cells: [{ state: 'own', text: '246,476,934.00' }, { state: 'own', text: '246,476,934.00' }, { state: 'own', text: '246,476,934.00' }] },
        ],
        legend: [{ state: 'own', label: 'Matches the view total' }],
        caption: 'Run 975475851271421. The two views slice the same orders, so both totals are equal.',
      },
    },
    {
      id: 'how',
      heading: 'How the check works',
      steps: [
        {
          title: 'Read the dashboard definition',
          body: 'The task loads the deployed lvdash.json and takes each dataset\'s queryLines.',
        },
        {
          title: 'Run it as the dashboard does',
          body: 'The query runs on the same warehouse with the catalog and schema set, which is how the dashboard resolves bare table names.',
          code: 'SELECT SUM(revenue) FROM (SELECT month, orders, revenue FROM v_revenue_by_month) t',
        },
        {
          title: 'Compare',
          body: 'totals_match accepts a difference of at most half a cent, then writes one row per view to totals_check.',
        },
      ],
    },
  ],
  related: [
    { slug: 'self-service-extracts', title: 'Self-service extracts and subscriptions' },
    { slug: 'sql-notebook-analysis', title: 'SQL and notebooks at scale' },
  ],
};
