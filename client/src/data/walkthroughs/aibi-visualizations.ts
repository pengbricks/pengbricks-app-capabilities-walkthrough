import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'aibi-visualizations',
  area: 'Analyst Guides',
  title: 'AI/BI dashboard visualizations: chart types, running totals, metric views, and custom charts',
  intro:
    'AI/BI dashboards have more than twenty built-in visualization types, plus custom visualizations written in Vega-Lite (Public Preview). This guide covers which type fits which question, how to build a running total (cumulative sum) four ways and which one to choose, when to read a metric view straight into a chart, and how to write a custom chart when nothing built in fits. Every example is a tile in a dashboard the reference bundle deploys, and a job checks that the running totals agree.',
  businessValue: {
    summary:
      'Analysts build the chart people need on the governed data, without exporting to another tool, and running totals and ratios show the same value in the dashboard, Genie, and SQL.',
    outcomes: [
      {
        title: 'Fewer tools to license and learn',
        body: 'Bar, line, combo, pivot, funnel, Sankey, waterfall, maps, and more are built in. Bullet charts, gauges, and radars come from a Vega-Lite spec on the same dashboard.',
      },
      {
        title: 'Running totals that agree',
        body: 'A cumulative measure defined once in a metric view gives the same year-to-date number in a dashboard tile, a Genie answer, and a SQL query.',
      },
      {
        title: 'Charts that follow filters',
        body: 'Custom calculations and metric views compute after filters and grouping. A viewer who picks a region sees that region’s running total, not the company’s.',
      },
      {
        title: 'Reviewed like code',
        body: 'The dashboard, its custom calculations, and its Vega-Lite specs live in one JSON file that a bundle deploys, so chart changes go through a pull request.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Start from the question, then pick the chart.',
      body: 'Trend over time: line or area. Compare categories: bar. Part of a whole: pie or 100% stacked bar. Spread: histogram or box. Two measures: scatter or combo. Stages: funnel. Flows: Sankey. Exact values: table or pivot.',
    },
    {
      title: 'For a running total, default to the metric view.',
      body: 'Define it once with window: range: cumulative. Use a custom calculation (AGGREGATE OVER (ORDER BY month CUMULATIVE)) for a dashboard-only measure, and avoid a SQL window in the dataset when viewers filter.',
    },
    {
      title: 'A SQL window runs before filters.',
      body: 'SUM() OVER in the dataset query is computed before the dashboard applies a filter, so the line does not change when a viewer picks a region. Custom calculations and metric views compute after the filter.',
    },
    {
      title: 'Read a metric view directly when it already has the measure.',
      body: 'Select it as the dataset and ask widgets for MEASURE(revenue). Ratios and window measures stay correct at every grouping. Wrap it in a SQL dataset only when you need a WHERE clause.',
    },
    {
      title: 'Use a custom visualization only when no built-in type fits.',
      body: 'A custom visualization is a Vega-Lite JSON spec that reads the dataset as databricks_query. Built-in types are simpler, follow the theme, and cross-filter by default.',
    },
    {
      title: 'Deploy the dashboard as code.',
      body: 'The bundle dashboard resource deploys the .lvdash.json file with the catalog and schema set per target, so the same dashboard moves from dev to prod.',
    },
  ],
  prerequisites: [
    {
      slug: 'metric-views',
      title: 'Metric views',
      why: 'The running totals and ratios here are metric view measures. That guide covers joins, filters, window measures, and how to deploy the YAML.',
    },
    {
      slug: 'in-platform-visualization',
      title: 'Charts and dashboards in the platform',
      why: 'Covers when to use a dashboard, Genie, or a notebook chart. This guide goes deeper on the dashboard.',
    },
  ],
  sections: [
    {
      id: 'types',
      heading: 'Built-in visualization types',
      prose:
        'Every type below is on the Chart types page of the reference dashboard, over the same orders. Choose by the question the viewer is asking. Charts that share a dataset cross-filter each other: click a bar and the other tiles on that dataset filter to it. Genie Code can create bar, line, point map, scatter, pie, and counter charts from a prompt.',
      table: {
        caption: 'Which built-in type answers which question',
        columns: ['Question', 'Visualization types'],
        rows: [
          ['One number, and is it up or down?', 'Counter, with an optional sparkline and a comparison value'],
          [
            'How does a measure change over time?',
            'Line, area (stacked or 100%), combo for two measures with different scales',
          ],
          ['How do categories compare?', 'Bar (stacked, grouped, or 100%), horizontal bar for long labels'],
          ['What share does each part have?', 'Pie for a few categories, 100% stacked bar or area over time'],
          ['How are values spread?', 'Histogram for one measure, box to compare spreads across categories'],
          ['How do two measures relate?', 'Scatter, or bubble when a third measure sets the size'],
          ['Where do items drop off?', 'Funnel'],
          ['How does a total build up or break down?', 'Waterfall'],
          ['How do things flow between stages?', 'Sankey'],
          ['Where is it happening?', 'Point map, choropleth map, path map'],
          [
            'What are the exact values?',
            'Table, pivot (with totals and conditional formatting), heatmap for a color grid',
          ],
          ['When does each item start and end?', 'Gantt'],
          ['How many users come back?', 'Cohort, built as a pivot with a color scale'],
          ['None of the above', 'Custom visualization (Vega-Lite, Public Preview)'],
        ],
      },
      points: [
        {
          strong: 'Keep series few.',
          text: 'Color a chart by a field with three to eight values. Above that, use a table, or group the tail into "Other" in the dataset.',
        },
        {
          strong: 'One wide dataset per subject.',
          text: 'Widgets on the same dataset cross-filter each other. Splitting them across many narrow datasets breaks that, and viewers need filter widgets to do what a click would.',
        },
        {
          strong: 'Format values in the widget.',
          text: 'Set currency, percent, and compact (K, M, B) formats on each encoding. Percent formats expect 0 to 1, not 0 to 100.',
        },
      ],
      links: [
        {
          label: 'Dashboard visualization types',
          url: 'https://docs.databricks.com/aws/en/dashboards/manage/visualizations/types',
        },
        {
          label: 'Dashboard visualizations',
          url: 'https://docs.databricks.com/aws/en/dashboards/manage/visualizations/',
        },
      ],
    },
    {
      id: 'running-totals',
      heading: 'Running totals (cumulative sum)',
      prose:
        'A running total adds each period to the ones before it, so the line climbs to the period-to-date total. The reference dashboard draws the same running total four ways on its Running totals page. With no filter, all four end at the same value, and the job checks the SQL and metric view versions month by month against a sum computed in Python. Pick a region in the page filter, and the methods split: the custom calculation and the metric view move to that region’s total, and the SQL window does not.',
      diagram: {
        type: 'flow',
        title: 'Where each running total is computed',
        description:
          'Orders feed three places a running total can be computed: the dataset SQL, a dashboard custom calculation, and a metric view window measure. Only the dataset SQL runs before the dashboard filter.',
        nodes: [
          {
            id: 'orders',
            label: 'Orders',
            sub: 'Unity Catalog tables',
            col: 0,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail: 'The governed order and customer tables every method reads.',
          },
          {
            id: 'sqlwin',
            label: 'Dataset SQL',
            sub: 'SUM() OVER (ORDER BY ...)',
            mono: true,
            col: 1,
            row: 0,
            kind: 'box',
            icon: 'gear-navy',
            domain: 'data',
            detail:
              'The window runs inside the dataset query, before the dashboard applies filters. The result is fixed at the grain the query returns.',
          },
          {
            id: 'mv',
            label: 'Metric view',
            sub: 'range: cumulative',
            mono: true,
            col: 1,
            row: 2,
            kind: 'highlight',
            icon: 'data-model',
            domain: 'governance',
            detail:
              'Defined once in Unity Catalog. Computed when queried, after filters and grouping, and shared with Genie, SQL, and BI tools.',
          },
          {
            id: 'filter',
            label: 'Dashboard filter',
            sub: 'region = North',
            col: 2,
            row: 1,
            kind: 'gate',
            icon: 'checklist',
            domain: 'apps',
            detail:
              'The viewer’s filter. It narrows rows before custom calculations and metric view measures are computed.',
          },
          {
            id: 'calc',
            label: 'Custom calculation',
            sub: 'AGGREGATE OVER CUMULATIVE',
            mono: true,
            col: 3,
            row: 1,
            kind: 'highlight',
            icon: 'dashboard',
            domain: 'apps',
            detail:
              'Defined on the dashboard dataset. Computed after the filter and the chart grouping, so it follows both. Other dashboards and Genie can’t use it.',
          },
          {
            id: 'tile',
            label: 'Line chart',
            sub: 'running revenue',
            col: 4,
            row: 1,
            kind: 'surface',
            icon: 'dashboard',
            domain: 'apps',
            detail:
              'The tile a viewer sees. Waterfall and Vega-Lite tiles can also show a running total from monthly values.',
          },
        ],
        edges: [
          { from: 'orders', to: 'sqlwin' },
          { from: 'orders', to: 'filter' },
          { from: 'orders', to: 'mv' },
          { from: 'sqlwin', to: 'tile', label: 'ignores the filter', dashed: true },
          { from: 'filter', to: 'calc' },
          { from: 'mv', to: 'tile', label: 'filter applied' },
          { from: 'calc', to: 'tile' },
        ],
        legend: [
          { kind: 'highlight', label: 'Computed after filters' },
          { kind: 'box', label: 'Computed before filters' },
          { kind: 'gate', label: 'Viewer filter' },
          { kind: 'dashed', label: 'Does not follow the filter' },
        ],
      },
      examples: [
        {
          label: 'Custom calculation on a dashboard dataset',
          language: 'sql',
          code: "-- Calculated measure: follows the chart's grouping and filters\nSUM(order_value) AGGREGATE OVER (ORDER BY order_month CUMULATIVE)\n\n-- Rolling three months: the month plus the two before it\nSUM(order_value) AGGREGATE OVER (ORDER BY order_month TRAILING 3 MONTH)\n\n-- Trailing seven days, a year earlier\nSUM(order_value) AGGREGATE OVER (ORDER BY order_date TRAILING 7 DAY OFFSET -1 YEAR)",
          notes: [
            'Add these in the dataset editor under Custom calculations. Frames are CURRENT, CUMULATIVE, ALL, and TRAILING or LEADING with a number and DAY, MONTH, or YEAR.',
            'The ORDER BY field must be on the chart, here as the x axis.',
          ],
        },
        {
          label: 'Metric view window measure',
          language: 'yaml',
          code: 'measures:\n  - name: revenue_running_total\n    expr: SUM(source.quantity * source.unit_price)\n    window:\n      - order: order_month\n        range: cumulative\n        semiadditive: last\n  - name: revenue_trailing_3m\n    expr: SUM(source.quantity * source.unit_price)\n    window:\n      - order: order_month\n        range: trailing 3 month inclusive\n        semiadditive: last',
          notes: [
            'Window measures in metric views are generally available (October 6, 2026).',
            'trailing excludes the current period by default. Add inclusive to count it.',
          ],
        },
        {
          label: 'SQL window function in the dataset',
          language: 'sql',
          code: 'SELECT order_month,\n       revenue,\n       SUM(revenue) OVER (ORDER BY order_month\n                          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_revenue\nFROM monthly_revenue',
          notes: [
            'Computed before any dashboard filter. Use it when the running total must ignore filters, such as a fixed company-wide line.',
          ],
        },
      ],
      options: {
        caption: 'How to build a running total',
        rows: [
          {
            option: 'Metric view window measure (range: cumulative)',
            when: 'The running total is a business metric that Genie, SQL, alerts, or BI tools also need.',
            tradeoffs:
              'One definition everywhere, and it follows filters and grouping. Someone owns the YAML, and a change goes through the metric view’s review and deploy. The order field must be a metric view dimension.',
          },
          {
            option: 'Custom calculation (AGGREGATE OVER ... CUMULATIVE)',
            when: 'One dashboard needs it, or you are prototyping before you add it to a metric view.',
            tradeoffs:
              'No Unity Catalog change, and it follows filters and grouping. It lives in that dashboard only, so another dashboard or Genie rebuilds it and can drift. Table widgets cannot show calculated measures.',
          },
          {
            option: 'SQL window function in the dataset',
            when: 'The line must ignore viewer filters, or you need a frame custom calculations lack, such as ROWS with a fixed count.',
            tradeoffs:
              'Plain SQL that runs anywhere. It runs before filters, so a region filter leaves the line unchanged, and it is fixed at the grain the query returns.',
          },
          {
            option: 'Waterfall chart',
            when: 'Viewers need to see how each period adds to the total.',
            tradeoffs:
              'No formula: the chart stacks each period on the last. It shows contributions, not a line, and it gets crowded past about twenty bars.',
          },
          {
            option: 'Vega-Lite window transform',
            when: 'A custom visualization already draws the chart, such as monthly bars with a running-total line on a second axis.',
            tradeoffs:
              'Computed in the browser from the rows the dataset returns, so the number exists only in that tile. Custom visualizations are in Public Preview.',
          },
        ],
        recommendation:
          'Use a metric view window measure for any running total someone will quote. Use a custom calculation to prototype or for a dashboard-only number, and a SQL window only when the line must ignore filters.',
      },
      links: [
        {
          label: 'Custom calculations',
          url: 'https://docs.databricks.com/aws/en/dashboards/manage/data-modeling/custom-calculations',
          note: 'OVER and AGGREGATE OVER, frames, and limits.',
        },
        {
          label: 'Level of detail expressions',
          url: 'https://docs.databricks.com/aws/en/dashboards/manage/data-modeling/custom-calculations/level-of-detail',
        },
        {
          label: 'Metric view window measures',
          url: 'https://docs.databricks.com/aws/en/uc-semantics/metric-views/advanced-techniques#window-measures',
        },
      ],
    },
    {
      id: 'metric-views',
      heading: 'Metric views in visualizations',
      prose:
        'A metric view stores measures apart from dimensions, so a chart can group by any dimension and the measure is computed for that grouping. That matters most for ratios, distinct counts, and window measures, which go wrong when a dashboard sums pre-aggregated rows. In the reference dashboard, average order value is a metric view ratio. It reads $1.39K in total and is recomputed per region, not averaged from monthly values.',
      steps: [
        {
          title: 'Add the metric view as a dataset.',
          body: 'In the Data tab, choose Add data and pick the metric view. In dashboard JSON, a dataset with asset_name set to the view’s name does the same. The dataset exposes the view’s dimensions and measures, and you cannot add a WHERE clause.',
          code: '{"name": "ds_metric_view", "displayName": "Metric view: analyst_viz_metrics", "asset_name": "analyst_viz_metrics"}',
        },
        {
          title: 'Ask widgets for measures with MEASURE().',
          body: 'A widget field uses MEASURE(revenue) instead of SUM(revenue). The metric view computes it at the widget’s grouping and with the dashboard’s filters.',
          code: '{"name": "measure(revenue_running_total)", "expression": "MEASURE(`revenue_running_total`)"}',
        },
        {
          title: 'Wrap it in SQL only to filter or reshape.',
          body: 'A SQL dataset can query the view with MEASURE() and a WHERE clause. The result is then fixed at the query’s GROUP BY, so widgets aggregate rows again. Keep the grouping in the query equal to the chart’s.',
          code: "SELECT order_month, region, MEASURE(revenue) AS revenue\nFROM analyst_viz_metrics\nWHERE segment = 'Enterprise'\nGROUP BY ALL",
        },
        {
          title: 'Pass parameters as named arguments.',
          body: 'A metric view with parameters is called like a table function, such as FROM catalog.schema.metric_view(discount => :discount), with a dashboard parameter bound to a filter widget.',
        },
      ],
      options: {
        caption: 'Where a dashboard measure comes from',
        rows: [
          {
            option: 'Metric view dataset (asset_name)',
            when: 'The metric view already has the measure, and viewers filter with dashboard filters.',
            tradeoffs:
              'Ratios and windows are right at every grouping, and the number matches Genie and SQL. You cannot add a WHERE clause or hide columns, and the dataset exposes everything the view does.',
          },
          {
            option: 'SQL dataset over the metric view',
            when: 'You need a fixed WHERE clause, a join to another table, or a parameter.',
            tradeoffs:
              'Full SQL control. The query’s GROUP BY fixes the grain, so a chart at a coarser grain sums rows again. That is wrong for ratios and distinct counts.',
          },
          {
            option: 'Custom calculation on a SQL dataset',
            when: 'A dashboard-only metric, or a prototype before the metric view owner adds it.',
            tradeoffs:
              'Fast, with no Unity Catalog change. It is scoped to one dashboard, so it can drift from the same metric elsewhere. Export the dataset as a metric view when the measure settles.',
          },
          {
            option: 'Local metric view',
            when: 'You want metric view behavior for one dashboard without publishing to Unity Catalog.',
            tradeoffs:
              'Same semantics as a metric view, scoped to the dashboard. Genie, SQL, and other dashboards cannot read it.',
          },
        ],
        recommendation:
          'Read the metric view directly as the default. Use a SQL dataset over it only when a filter must be fixed in the query, and promote custom calculations into the metric view once more than one consumer needs them.',
      },
      points: [
        {
          strong: 'Custom calculations on a metric view.',
          text: 'You can add custom calculations on top of a metric view dataset (Public Preview), for a dashboard-only formula built from its measures.',
        },
        {
          strong: 'Faster interactions.',
          text: 'Dataset materialization pre-computes and stores dataset results on a schedule, so a published dashboard renders from stored results instead of rerunning heavy queries (October 2026).',
        },
      ],
      links: [
        {
          label: 'Dashboard datasets',
          url: 'https://docs.databricks.com/aws/en/dashboards/manage/data-modeling/datasets',
          note: 'Metric view datasets, SQL datasets, and local metric views.',
        },
        {
          label: 'Unity Catalog metric views',
          url: 'https://docs.databricks.com/aws/en/uc-semantics/metric-views/',
        },
      ],
    },
    {
      id: 'custom',
      heading: 'Custom visualizations (Vega-Lite)',
      prose:
        'A custom visualization renders a Vega-Lite JSON spec from a dashboard dataset. Choose Custom Viz under Advanced in the visualization picker, add the fields the spec reads, and paste the spec. The reference dashboard has three. A running total with monthly bars and a cumulative line on a second axis uses a Vega-Lite window transform. A bullet chart compares revenue with a target per region. A dot plot clicks through to filter a pivot.',
      examples: [
        {
          label: 'Running total in Vega-Lite (bars and a cumulative line)',
          language: 'json',
          code: '{\n  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",\n  "data": {"name": "databricks_query"},\n  "width": "container", "height": "container",\n  "config": {"autosize": {"type": "fit", "contains": "padding"}},\n  "transform": [{\n    "sort": [{"field": "order_month"}],\n    "window": [{"op": "sum", "field": "revenue", "as": "running_revenue"}],\n    "frame": [null, 0]\n  }],\n  "encoding": {"x": {"field": "order_month", "type": "ordinal", "timeUnit": "utcyearmonth"}},\n  "layer": [\n    {"mark": {"type": "bar", "opacity": 0.5},\n     "encoding": {"y": {"field": "revenue", "type": "quantitative"}}},\n    {"mark": {"type": "line", "point": true,\n              "color": {"expr": "dashboardTheme.visualizationColors[0]"}},\n     "encoding": {"y": {"field": "running_revenue", "type": "quantitative",\n                        "axis": {"orient": "right"}}}}\n  ],\n  "resolve": {"scale": {"y": "independent"}}\n}',
          notes: [
            'Read the dataset as "databricks_query", and list every field the spec uses in the Fields section.',
            'Use utcyearmonth for dates, or months shift by the viewer’s time zone.',
          ],
        },
        {
          label: 'Cross-filter from a custom chart',
          language: 'json',
          code: '"params": [{\n  "name": "databricks_mark_selection",\n  "select": {"type": "point", "fields": ["region"]}\n}],\n"mark": {"type": "circle", "size": 220},\n"encoding": {\n  "stroke": {"condition": {"param": "databricks_mark_selection", "empty": false,\n                           "value": {"expr": "colors.markHighlightColor"}}, "value": null}\n}',
          notes: [
            'The parameter name must be databricks_mark_selection, and its fields must be dimension fields. Interval (brush) selections are not supported.',
            'Keep a cross-filtering spec single-view. A layered spec with this parameter renders blank.',
          ],
        },
      ],
      points: [
        {
          strong: 'Theme-aware by default.',
          text: 'Fonts, grid lines, and background follow the dashboard theme in light and dark mode. Use the colors, mode, and dashboardTheme signals for mark colors, and a config block to override.',
        },
        {
          strong: 'Precompute layout in SQL.',
          text: 'Vega-Lite plots coordinates you give it. For a tree, network, or matrix, compute positions in the dataset query and draw them in layers.',
        },
        {
          strong: 'Limits.',
          text: 'No treemaps. Image marks take only inline base64 PNG, JPEG, or WebP of 37 KB or less. Custom visualizations are in Public Preview.',
        },
        {
          strong: 'Specs to start from.',
          text: 'The docs include a layered rolling mean, a phylogenetic tree, and bullet, gauge, radar, radial, and sunburst specs. The Vega-Lite example gallery has hundreds more.',
        },
      ],
      options: {
        caption: 'Built-in type or custom visualization',
        rows: [
          {
            option: 'Built-in type',
            when: 'A built-in type answers the question, even if it is not the exact look you pictured.',
            tradeoffs:
              'Configured in the UI, follows the theme, cross-filters, and Genie Code can build several types from a prompt. Styling options are fixed.',
          },
          {
            option: 'Custom visualization',
            when: 'The chart type does not exist built in, such as a bullet, gauge, radar, sunburst, or tree, or you need layered marks.',
            tradeoffs:
              'Any Vega-Lite chart. Someone who knows Vega-Lite maintains the JSON, it is Public Preview, layered specs cannot cross-filter, and the spec reads the dataset’s rows.',
          },
          {
            option: 'Databricks App',
            when: 'The view needs write-back, a custom interaction model, or a UI beyond a dashboard grid.',
            tradeoffs: 'Full control with code, and you own hosting, auth, and tests. See Databricks Apps.',
          },
        ],
        recommendation:
          'Try a built-in type first, use a custom visualization for the few charts that have no built-in equivalent, and move to an app only when the dashboard model itself does not fit.',
      },
      links: [
        {
          label: 'Custom visualizations',
          url: 'https://docs.databricks.com/aws/en/dashboards/manage/visualizations/custom-visualizations',
          note: 'Fields, theme signals, cross-filtering, and example specs.',
        },
        {
          label: 'Vega-Lite examples',
          url: 'https://vega.github.io/vega-lite/examples/',
        },
      ],
    },
    {
      id: 'as-code',
      heading: 'Build and ship the dashboard as code',
      prose:
        'The reference dashboard is one .lvdash.json file. Datasets hold the SQL, the asset_name of the metric view, and the custom calculations under columns. Each widget names its dataset, its fields, and a spec. A custom visualization’s Vega-Lite spec is a JSON string inside spec.jsonSpec.spec. The bundle dashboard resource sets the warehouse and the dataset catalog and schema per target, so dataset queries use bare table names.',
      examples: [
        {
          label: 'Bundle dashboard resource',
          language: 'yaml',
          code: 'resources:\n  dashboards:\n    aibi_visualizations_dashboard:\n      display_name: Capability guides AI-BI visualizations\n      file_path: ../src/dashboards/aibi_visualizations.lvdash.json\n      warehouse_id: ${var.warehouse_id}\n      dataset_catalog: ${var.catalog}\n      dataset_schema: ${var.schema}',
          notes: ['Display names cannot contain a slash, so "AI/BI" fails at deploy time.'],
        },
      ],
      points: [
        {
          strong: 'Spec versions differ by widget type.',
          text: 'Counters and tables use version 2. Bar, line, area, pie, scatter, heatmap, histogram, and pivot use version 3, and so do box, funnel, and waterfall in the reference dashboard. Combo, Sankey, and custom visualizations use version 1.',
        },
        {
          strong: 'Read the validator.',
          text: 'A widget with a bad spec shows "Invalid widget definition is imported." Show error names the property it rejected, such as a missing scale or a wrong version.',
        },
        {
          strong: 'Edit in the UI, then pull.',
          text: 'For a type you have not written before, build it in the editor and read the saved JSON (databricks lakeview get, or bundle generate dashboard). The box widget, for example, saves quartiles as five y fields.',
        },
      ],
      links: [
        {
          label: 'Bundle resources',
          url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/resources',
          note: 'The dashboard resource.',
        },
        {
          label: 'Dashboard filters',
          url: 'https://docs.databricks.com/aws/en/dashboards/manage/filters',
        },
      ],
    },
  ],
  related: [
    { slug: 'in-platform-visualization', title: 'Charts and dashboards in the platform' },
    { slug: 'metric-views', title: 'Metric views' },
    { slug: 'self-service-extracts', title: 'Self-service extracts and subscriptions' },
    { slug: 'genie-code', title: 'Genie Code: from sample data to notebooks and dashboards' },
  ],
};
