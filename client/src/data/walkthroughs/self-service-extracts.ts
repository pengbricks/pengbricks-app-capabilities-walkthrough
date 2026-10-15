import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'self-service-extracts',
  area: 'Analyst Guides',
  title: 'Self-service extracts and subscriptions',
  intro:
    'One filter feeds three outputs: an AI/BI dashboard with a weekly schedule and an email subscription, a formatted Excel workbook, and a pipe-delimited file for an external partner. The files land in a Unity Catalog volume, and the dashboard reads the same table the files came from.',
  shortVersion: [
    {
      title: 'One filtered table.',
      body: 'extract_orders holds West-region completed orders from January to June 2026: 13,211 rows and 18,124,357.00 in revenue.',
    },
    {
      title: 'Excel with formatting.',
      body: 'openpyxl writes a styled header, number formats, frozen header row, autofilter, and a Summary sheet.',
    },
    {
      title: 'Pipe-delimited for partners.',
      body: 'A plain text file with a header row. Fields that contain a pipe are quoted.',
    },
    {
      title: 'Row counts agree.',
      body: 'The task reads both files back from the volume and fails unless they match the table.',
    },
    {
      title: 'The dashboard is scheduled.',
      body: 'A task creates a Monday 07:00 America/New_York schedule and subscribes notification_email.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'One filter, three outputs',
      prose:
        'build_extracts filters once and saves extract_orders. The dashboard and both files read from it, so a number on the dashboard can be traced to a row in the file.',
      diagram: {
        type: 'flow',
        title: 'From orders to files and dashboard',
        description:
          'build_extracts joins analyst_orders to analyst_customers, filters by region, status, and date range, and writes extract_orders. It then writes an xlsx workbook and a pipe-delimited file to the extracts volume and records both in extract_manifest. The AI/BI dashboard reads extract_orders. schedule_dashboard creates a weekly schedule and a subscription for the notification address.',
        lanes: [
          { label: 'Job tasks', fromRow: 0, toRow: 0 },
          { label: 'Outputs', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'gen', label: 'generate_data', mono: true, col: 0, row: 0 },
          { id: 'build', label: 'build_extracts', mono: true, sub: 'filter, write, verify', col: 1, row: 0, kind: 'highlight' },
          { id: 'sched', label: 'schedule_dashboard', mono: true, sub: 'schedule, subscription', col: 2, row: 0 },
          { id: 'table', label: 'extract_orders', mono: true, sub: '13,211 rows', col: 1, row: 1, kind: 'store' },
          { id: 'xlsx', label: 'orders_extract.xlsx', mono: true, sub: 'formatted workbook', col: 0, row: 2, kind: 'store' },
          { id: 'pipe', label: 'orders_extract.txt', mono: true, sub: 'pipe-delimited', col: 1, row: 2, kind: 'store' },
          { id: 'dash', label: 'AI/BI dashboard', sub: 'published', col: 2, row: 1, kind: 'surface' },
          { id: 'mail', label: 'Email subscriber', sub: 'notification_email', col: 3, row: 1 },
        ],
        edges: [
          { from: 'gen', to: 'build' },
          { from: 'build', to: 'sched' },
          { from: 'build', to: 'table' },
          { from: 'table', to: 'xlsx' },
          { from: 'table', to: 'pipe' },
          { from: 'table', to: 'dash' },
          { from: 'sched', to: 'dash', label: 'weekly' },
          { from: 'dash', to: 'mail' },
        ],
        legend: [
          { kind: 'highlight', label: 'Shared filter' },
          { kind: 'surface', label: 'Dashboard' },
          { kind: 'store', label: 'Table or volume file' },
        ],
      },
    },
    {
      id: 'files',
      heading: 'What each file contains',
      prose: 'Both files carry the same nine columns and 13,211 rows. The workbook adds formatting and a summary sheet.',
      diagram: {
        type: 'matrix',
        title: 'Excel workbook and pipe-delimited file',
        description:
          'The xlsx file has an Orders sheet with a styled header, frozen header row, autofilter, number formats on unit_price and revenue, and a yyyy-mm-dd date format, plus a Summary sheet with the filters, row count, and revenue. The pipe-delimited file has a header row and quotes fields that contain a pipe.',
        corner: 'Feature ↓ · File →',
        columns: ['xlsx', 'pipe-delimited'],
        rows: [
          { label: 'Header row', sub: 'column names', cells: [{ state: 'own', text: 'styled, frozen' }, { state: 'own', text: 'plain' }] },
          { label: 'Number formats', sub: 'money, dates', cells: [{ state: 'own', text: '#,##0.00 and date' }, { state: 'none', text: 'raw values' }] },
          { label: 'Filter and summary', sub: 'for the reader', cells: [{ state: 'own', text: 'autofilter, Summary' }, { state: 'none', text: 'none' }] },
          { label: 'Size, reference run', sub: 'bytes', cells: [{ state: 'own', text: '621,272' }, { state: 'own', text: '1,052,781' }] },
        ],
        legend: [
          { state: 'own', label: 'Present' },
          { state: 'none', label: 'Not part of the format' },
        ],
        caption: 'Run 480047373211928. Files are in the extracts volume under partner/.',
      },
    },
    {
      id: 'subscription',
      heading: 'Schedule and subscription',
      prose:
        'The bundle deploys the dashboard. It cannot declare a schedule or subscription, so schedule_dashboard creates them through the Databricks SDK, reuses them on rerun, and records the IDs in dashboard_subscription.',
      steps: [
        {
          title: 'Create the schedule',
          body: 'Quartz cron for Mondays at 07:00 in America/New_York, on the same warehouse.',
          code: 'w.lakeview.create_schedule(dashboard_id, Schedule(display_name="Weekly partner orders", cron_schedule=CronSchedule(quartz_cron_expression="0 0 7 ? * MON", timezone_id="America/New_York"), warehouse_id=...))',
        },
        {
          title: 'Subscribe the address',
          body: 'The task finds the workspace user for notification_email and adds a user subscription.',
          code: 'w.lakeview.create_subscription(dashboard_id, schedule_id, Subscription(subscriber=Subscriber(user_subscriber=SubscriptionSubscriberUser(user_id=...))))',
        },
        {
          title: 'Export by hand',
          body: 'Analysts who need a one-off file can use the table download on the dashboard, which writes CSV or Excel from their browser.',
        },
      ],
    },
  ],
  related: [
    { slug: 'in-platform-visualization', title: 'Charts and dashboards in the platform' },
    { slug: 'local-tool-connectivity', title: 'Connecting local tools' },
  ],
};
