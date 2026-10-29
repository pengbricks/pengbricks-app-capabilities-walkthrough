import type { Faq } from './types.ts';

const CUSTOM_CALCS = 'https://docs.databricks.com/aws/en/dashboards/manage/data-modeling/custom-calculations';
const CUSTOM_VIZ = 'https://docs.databricks.com/aws/en/dashboards/manage/visualizations/custom-visualizations';

export const faqs: Faq[] = [
  {
    question: 'What visualization types do AI/BI dashboards have?',
    answer:
      'Area, bar, box, bubble, choropleth map, cohort (a pivot with a color scale), combo, counter, funnel, Gantt, heatmap, histogram, line, path map, pie, pivot, point map, Sankey, scatter, table, and waterfall, plus custom visualizations in Vega-Lite (Public Preview). The reference dashboard puts most of them on one page over the same data.',
    links: [
      {
        label: 'Dashboard visualization types',
        url: 'https://docs.databricks.com/aws/en/dashboards/manage/visualizations/types',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'How do I show a running total (cumulative sum) on a dashboard?',
    answer:
      'Define it in a metric view with a window measure (range: cumulative) and chart it with MEASURE(). For a dashboard-only number, add a custom calculation such as SUM(order_value) AGGREGATE OVER (ORDER BY order_month CUMULATIVE) and put order_month on the x axis. A waterfall chart also shows the build-up without a formula.',
    links: [
      { label: 'Custom calculations', url: CUSTOM_CALCS },
      {
        label: 'Metric view window measures',
        url: 'https://docs.databricks.com/aws/en/uc-semantics/metric-views/advanced-techniques#window-measures',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'Why doesn’t my running total change when I filter the dashboard?',
    answer:
      'The running total is probably a SQL window function in the dataset query, such as SUM(revenue) OVER (ORDER BY month). The dataset query runs before dashboard filters, so the window has already summed every row. Move the running total into a custom calculation (AGGREGATE OVER) or a metric view window measure. Both compute after filters and grouping.',
    links: [{ label: 'Custom calculations', url: CUSTOM_CALCS }],
  },
  {
    kind: 'decision',
    question: 'OVER or AGGREGATE OVER in a custom calculation?',
    answer:
      'AGGREGATE OVER computes after the chart groups the data, so it follows the chart’s grouping and filters. Use it for running totals and moving windows (CUMULATIVE, TRAILING 3 MONTH). OVER computes before grouping, at a fixed partition. Use it for ranks, values that should ignore the chart’s filters, or a fixed level of detail.',
    links: [
      { label: 'Custom calculations', url: CUSTOM_CALCS },
      {
        label: 'Level of detail expressions',
        url: 'https://docs.databricks.com/aws/en/dashboards/manage/data-modeling/custom-calculations/level-of-detail',
      },
    ],
  },
  {
    question: 'Does TRAILING 3 MONTH include the current month?',
    answer:
      'Yes. In a custom calculation, AGGREGATE OVER (ORDER BY order_month TRAILING 3 MONTH) covers the month in each row and the two before it. That matches a metric view window with range: trailing 3 month inclusive. In a metric view, trailing excludes the current period unless you add inclusive.',
  },
  {
    kind: 'decision',
    question: 'Should a chart read the metric view directly or through a SQL dataset?',
    answer:
      'Read it directly by default: pick the metric view as the dataset and ask widgets for MEASURE(). Ratios, distinct counts, and window measures stay correct at every grouping. Use a SQL dataset over the view only when you need a fixed WHERE clause or a join. Its GROUP BY then fixes the grain, so a chart at a coarser grain sums rows again, which is wrong for ratios.',
    links: [
      {
        label: 'Dashboard datasets',
        url: 'https://docs.databricks.com/aws/en/dashboards/manage/data-modeling/datasets',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'Custom calculation or metric view measure?',
    answer:
      'A custom calculation lives in one dashboard. It needs no Unity Catalog change, but another dashboard or Genie has to rebuild it and can drift. A metric view measure is defined once and shared by dashboards, Genie, SQL, alerts, and BI tools, at the cost of owning and deploying the YAML. Prototype as a custom calculation, then move the measure to the metric view once a second consumer needs it. The dataset editor can export a dataset as a metric view.',
    links: [{ label: 'Metric views', url: '/walkthroughs/metric-views' }],
  },
  {
    kind: 'decision',
    question: 'When should I write a custom visualization?',
    answer:
      'Only when no built-in type fits, such as a bullet chart, gauge, radar, sunburst, or tree, or when you need layered marks. Built-in types are configured in the UI, follow the theme, and cross-filter. A custom visualization is a Vega-Lite spec that someone has to maintain, and the feature is in Public Preview. If you need write-back or a custom interaction model, build a Databricks App instead.',
    links: [
      { label: 'Custom visualizations', url: CUSTOM_VIZ },
      { label: 'Databricks Apps', url: '/walkthroughs/databricks-apps' },
    ],
  },
  {
    question: 'How does a custom visualization get its data?',
    answer:
      'Add the dataset columns in the Fields section, then reference them by name in the Vega-Lite spec. The spec reads the rows from a data source named databricks_query. Set width and height to container and autosize to fit so the chart fills the tile.',
    links: [{ label: 'Custom visualizations', url: CUSTOM_VIZ }],
  },
  {
    kind: 'tradeoff',
    question: 'Can a custom visualization cross-filter other tiles?',
    answer:
      'Yes, with a point selection parameter named databricks_mark_selection whose fields are dimension fields. Clicking a mark filters the other widgets on the same dataset. Interval (brush) selections and aggregated measures are not supported, and in the reference dashboard a layered spec with this parameter rendered blank, so keep cross-filtering specs single-view.',
    links: [{ label: 'Custom visualizations', url: CUSTOM_VIZ }],
  },
  {
    question: 'What can’t a custom visualization do?',
    answer:
      'It can’t draw treemaps, and image marks accept only inline base64 PNG, JPEG, or WebP of 37 KB or less. Vega-Lite does not compute layouts for networks or trees, so precompute positions in the dataset query. It runs only Vega-Lite, not arbitrary HTML or JavaScript.',
    links: [{ label: 'Custom visualizations', url: CUSTOM_VIZ }],
  },
  {
    question: 'Why does my dashboard JSON show “Invalid widget definition is imported”?',
    answer:
      'The widget spec failed validation, often because of the wrong spec version for the type or a missing scale on an axis. Select Show error to see the rejected property. In the reference dashboard, box, funnel, and waterfall need version 3. A box widget takes five y fields (whiskerStart, boxStart, boxMid, boxEnd, whiskerEnd) that the widget computes with MIN, PERCENTILE, MEDIAN, and MAX. When unsure, build the widget in the editor and read the saved JSON.',
  },
  {
    question: 'Why is my dashboard deploy failing on the display name?',
    answer:
      'Dashboard display names cannot contain a slash. A name like "AI/BI visualizations" fails at deploy time with INVALID_PARAMETER_VALUE. Use "AI-BI" or reword it.',
  },
];
