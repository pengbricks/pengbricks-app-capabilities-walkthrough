import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'cost-chargeback',
  area: 'Governance/Monitoring',
  title: 'Cost tracking and chargeback',
  intro:
    'A job joins system.billing.usage to list prices in one workspace-scoped view and breaks spend down by product, tag, user, job, and pipeline. A SQL alert watches 7-day spend, ai_forecast projects 30 days, and two queries point at waste.',
  shortVersion: [
    {
      title: 'One view carries the cost math.',
      body: 'cost_usage_enriched multiplies usage by the list price in effect at the time, for this workspace only.',
    },
    {
      title: 'Tags make chargeback possible.',
      body: 'Jobs carry capability_guide_job and capability_guide_use_case. Spend with no tag shows as untagged, and in the reference run it was most of the total.',
    },
    {
      title: 'The budget alert is a SQL alert.',
      body: 'It sums 7-day spend and compares it with a threshold variable. The account budgets API was not reachable from the workspace.',
    },
    {
      title: 'The forecast is 30 days of ai_forecast.',
      body: 'It ran as a SQL task on the warehouse. Only 3 days of history existed, so it demonstrates the mechanics, not a plan.',
    },
    {
      title: 'Optimization is two queries.',
      body: 'Warehouses are flagged by auto-stop and statement count. Jobs are ranked by cost per run.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'From billing tables to answers',
      prose:
        'The view is the single place where usage meets price. Every breakdown, the alert, the forecast, and the dashboard read from it or from tables built on it.',
      diagram: {
        type: 'flow',
        title: 'Cost pipeline',
        description:
          'system.billing.usage and system.billing.list_prices feed the cost_usage_enriched view. The spend_breakdown task writes tables by product, SKU, tag, user, job, and pipeline. A SQL alert and the budget_check task read the view for 7-day spend. The forecast task runs ai_forecast on the daily cost table. The optimization task writes warehouse and job tables. The cost dashboard reads the results.',
        lanes: [
          { label: 'System tables', fromRow: 0, toRow: 0 },
          { label: 'Lakeflow job', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'usage', label: 'system.billing.usage', mono: true, col: 0, row: 0, kind: 'store' },
          { id: 'prices', label: 'billing.list_prices', mono: true, col: 1, row: 0, kind: 'store' },
          { id: 'view', label: 'cost_usage_enriched', mono: true, sub: 'this workspace, 90 days', col: 2, row: 0, kind: 'highlight' },
          { id: 'break', label: 'spend_breakdown', mono: true, sub: 'product, tag, user, job', col: 0, row: 1 },
          { id: 'budget', label: 'budget_check', mono: true, sub: '7-day spend', col: 1, row: 1 },
          { id: 'fc', label: 'forecast', mono: true, sub: 'ai_forecast, 30 days', col: 2, row: 1 },
          { id: 'opt', label: 'optimization', mono: true, sub: 'warehouses, jobs', col: 3, row: 1 },
          { id: 'alert', label: 'SQL alert', sub: 'hourly, threshold var', col: 1, row: 2, kind: 'surface' },
          { id: 'dash', label: 'Cost dashboard', sub: 'AI/BI', col: 2, row: 2, kind: 'surface' },
        ],
        edges: [
          { from: 'usage', to: 'view' },
          { from: 'prices', to: 'view' },
          { from: 'view', to: 'break' },
          { from: 'view', to: 'budget' },
          { from: 'break', to: 'fc', label: 'daily cost' },
          { from: 'view', to: 'opt' },
          { from: 'budget', to: 'alert', dashed: true, label: 'same query' },
          { from: 'fc', to: 'dash' },
        ],
        legend: [
          { kind: 'highlight', label: 'Usage x list price' },
          { kind: 'surface', label: 'Alert and dashboard' },
          { kind: 'store', label: 'System table' },
        ],
      },
    },
    {
      id: 'breakdown',
      heading: 'Breakdowns for chargeback',
      prose:
        'Each breakdown answers a different chargeback question. The tag breakdown works only for workloads that carry tags.',
      diagram: {
        type: 'matrix',
        title: 'Spend questions and where they are answered',
        description:
          'Spend by product and SKU is in cost_by_product and cost_by_sku. Spend by custom tag is in cost_by_tag using capability_guide_job and capability_guide_use_case. Spend by user is in cost_by_user using the run-as identity. Spend by job is in cost_by_job, and spend by pipeline is in cost_by_pipeline.',
        corner: 'Question ↓ · Source →',
        columns: ['Table', 'Key column'],
        rows: [
          {
            label: 'Which product?',
            cells: [
              { state: 'own', text: 'cost_by_product' },
              { state: 'own', text: 'product, SKU' },
            ],
          },
          {
            label: 'Which workload tag?',
            cells: [
              { state: 'own', text: 'cost_by_tag' },
              { state: 'own', text: 'guide job, use case' },
            ],
          },
          {
            label: 'Which person?',
            cells: [
              { state: 'own', text: 'cost_by_user' },
              { state: 'own', text: 'run-as identity' },
            ],
          },
          {
            label: 'Which job?',
            cells: [
              { state: 'own', text: 'cost_by_job' },
              { state: 'own', text: 'job ID, runs' },
            ],
          },
          {
            label: 'Which pipeline?',
            cells: [
              { state: 'own', text: 'cost_by_pipeline' },
              { state: 'own', text: 'pipeline ID' },
            ],
          },
        ],
        legend: [{ state: 'own', label: 'Built by spend_breakdown' }],
        caption: 'Most spend in the reference workspace had no capability_guide_job tag. Tag workloads before relying on the tag breakdown.',
      },
    },
    {
      id: 'budget',
      heading: 'Budget alert and forecast',
      prose:
        'The alert and the budget_check task run the same sum. In the reference run, 7-day list-price spend was 107.70 USD against a 50 USD threshold, so the check reported a breach.',
      diagram: {
        type: 'flow',
        title: 'Budget and forecast paths',
        description:
          'The cost_usage_enriched view feeds a 7-day spend query. The SQL alert evaluates it hourly and emails the notification address when spend is above the threshold. The budget_check task writes budget_status. The daily cost table feeds ai_forecast, which writes a 30-day forecast with lower and upper bounds. The account budgets API was not reachable from the workspace.',
        nodes: [
          { id: 'view', label: 'cost_usage_enriched', mono: true, col: 0, row: 0, kind: 'store' },
          { id: 'sum', label: '7-day spend', sub: 'sum of cost_usd', col: 1, row: 0 },
          { id: 'gate', label: 'Above threshold?', sub: 'budget_threshold_usd', col: 2, row: 0, kind: 'gate' },
          { id: 'mail', label: 'Alert email', sub: 'notification_email', col: 3, row: 0, kind: 'surface' },
          { id: 'status', label: 'budget_status', mono: true, sub: 'spend, breached, note', col: 3, row: 1, kind: 'store' },
          { id: 'daily', label: 'cost_daily', mono: true, col: 0, row: 2, kind: 'store' },
          { id: 'ai', label: 'ai_forecast', mono: true, sub: 'SQL task, 30 days', col: 1, row: 2, kind: 'highlight' },
          { id: 'f', label: 'cost_forecast_30d', mono: true, sub: 'forecast, lower, upper', col: 2, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'view', to: 'sum' },
          { from: 'sum', to: 'gate' },
          { from: 'gate', to: 'mail', label: 'yes' },
          { from: 'gate', to: 'status', label: 'recorded' },
          { from: 'daily', to: 'ai' },
          { from: 'ai', to: 'f' },
        ],
        legend: [
          { kind: 'gate', label: 'Threshold check' },
          { kind: 'highlight', label: 'ai_forecast' },
          { kind: 'surface', label: 'Notification' },
        ],
        caption:
          'The forecast covers 2026-10-15 to 2026-11-13 and sums to 10,318.55 USD (range 9,655.43 to 11,256.42). It rests on 3 days of history.',
      },
    },
    {
      id: 'optimize',
      heading: 'Optimization queries',
      prose: 'Two tables point at waste. Both read the same view, plus the warehouse list and system.query.history for statement counts.',
      steps: [
        {
          title: 'Idle or over-held warehouses',
          body: 'opt_idle_warehouses lists 30-day spend, statement count, USD per statement, and auto-stop. It flags auto-stop above 10 minutes or disabled, and fewer than 100 statements in 30 days.',
        },
        {
          title: 'Expensive jobs',
          body: 'opt_costly_jobs ranks jobs by USD per run over 30 days, with runs and DBUs, so oversized jobs stand out.',
          code: 'SELECT job_name, runs, usd_per_run\nFROM opt_costly_jobs\nORDER BY usd_per_run DESC;',
        },
        {
          title: 'Dashboard',
          body: 'The cost dashboard charts daily spend by product, spend by tag and user, the actual-versus-forecast line, and both optimization tables.',
        },
      ],
    },
  ],
  related: [
    { slug: 'compute-capacity-management', title: 'Compute and capacity management' },
    { slug: 'access-management', title: 'Access management' },
  ],
};
