import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'self-service-extracts',
  area: 'Analyst Guides',
  title: 'Self-service extracts and subscriptions',
  intro:
    'Business users want numbers on a schedule and data in the tool they already use. Give them subscriptions to AI/BI dashboards, the Excel Add-in over governed tables, and Genie for ad hoc questions, and reserve file extracts for partners and systems that cannot connect. This page covers which delivery path fits each need, how credentials and permissions work, and how to deliver files safely.',
  shortVersion: [
    {
      title: 'Subscribe people to a dashboard.',
      body: 'A schedule refreshes the dashboard, and a subscription sends a snapshot by email, Slack, or Microsoft Teams. It can attach PDF pages and widget data as CSV, TSV, or Excel.',
    },
    {
      title: 'Let Excel users pull governed data themselves.',
      body: 'The Excel Add-in (GA) imports Unity Catalog tables and views, refreshes them on a schedule, and keeps the user’s permissions in force.',
    },
    {
      title: 'Answer ad hoc questions with Genie.',
      body: 'Genie Agents on a curated dataset, or Genie One for business users, replace a request for a custom extract. Results can go to Excel.',
    },
    {
      title: 'Choose the credential mode on purpose.',
      body: 'Shared data permissions run queries as the publisher and share a cache. Individual data permissions run as each viewer and enforce row and column rules per person.',
    },
    {
      title: 'Send files to partners from a volume, after a check.',
      body: 'Write the file from a job, verify it, grant READ VOLUME to a group, or share the table with OpenSharing instead of copying it.',
    },
  ],
  sections: [
    {
      id: 'paths',
      heading: 'Pick the delivery path',
      table: {
        columns: ['Need', 'Use'],
        rows: [
          ['A weekly report in the inbox or a channel', 'Dashboard schedule and subscription'],
          ['A pivot table or model in Excel', 'Excel Add-in, with scheduled refresh'],
          ['A one-off answer or a quick filter', 'Genie Agents or Genie One'],
          ['A one-time download of what is on screen', 'Dashboard or SQL editor download, within its row limits'],
          ['A recurring file for a system or partner', 'A Lakeflow Job that writes to a volume'],
          ['Live data for an outside organization', 'OpenSharing, not file copies'],
        ],
      },
      links: [
        {
          label: 'Databricks Excel Add-in',
          url: 'https://docs.databricks.com/aws/en/integrations/excel/',
        },
        {
          label: 'Genie One',
          url: 'https://docs.databricks.com/aws/en/genie-one/',
        },
      ],
    },
    {
      id: 'subscription',
      heading: 'Schedule and subscription',
      prose:
        'Create the schedule from the dashboard’s Schedule button. Set the cadence and time zone, pick the warehouse, and choose whether to apply the current filter selections. Add subscribers: workspace users, or a notification destination such as email, Slack, or Microsoft Teams for people outside the workspace. Refresh-only schedules warm the cache without sending anything.',
      steps: [
        {
          title: 'Create the schedule',
          body: 'Use a Quartz cron or the pickers. Use a serverless SQL warehouse so the scheduled run starts quickly.',
        },
        {
          title: 'Add subscribers and attachments',
          body: 'Attach the pages you want as PDF, and widget data as CSV, TSV, or Excel when readers need numbers.',
        },
        {
          title: 'Automate when you have many',
          body: 'The Databricks SDK and API create schedules and subscriptions, so a bundle deployment or a script can set them up for a set of dashboards.',
          code: 'w.lakeview.create_schedule(dashboard_id, Schedule(display_name="Weekly orders", cron_schedule=CronSchedule(quartz_cron_expression="0 0 7 ? * MON", timezone_id="America/New_York"), warehouse_id=...))',
        },
      ],
      points: [
        {
          strong: 'Shared data permissions.',
          text: 'Queries run with the publisher’s credentials, every viewer sees the same data, and scheduled runs fill a shared cache. Use it for broad audiences on non-sensitive data.',
        },
        {
          strong: 'Individual data permissions.',
          text: 'Queries run as each viewer, so row filters and column masks apply per person. Use it when permissions differ across readers.',
        },
        {
          strong: 'Make dashboards fast.',
          text: 'Dataset materialization, in Beta per the release notes, stores dashboard dataset results on a schedule so published dashboards render from stored results.',
        },
      ],
      links: [
        {
          label: 'Schedules and subscriptions',
          url: 'https://docs.databricks.com/aws/en/dashboards/share/schedule-subscribe',
        },
        {
          label: 'Share dashboards',
          url: 'https://docs.databricks.com/aws/en/dashboards/share/',
        },
      ],
    },
    {
      id: 'files',
      heading: 'Files for partners and systems',
      prose:
        'When the reader cannot connect to Databricks, write a file. Define the filter once in a table, then write every format from that table so the numbers agree. Land the files in a Unity Catalog volume, so access is a grant instead of a shared link.',
      table: {
        columns: ['Format', 'Notes'],
        rows: [
          ['CSV or pipe-delimited text', 'Write with Spark for large files. Quote fields that contain the delimiter. Include a header row.'],
          ['Excel workbook', 'Good for a human reader. Format the header, number columns, and add a summary sheet. Keep it to small extracts.'],
          ['Parquet or Delta', 'Best for another data system. It keeps types and compresses.'],
        ],
      },
      points: [
        {
          strong: 'Verify before you deliver.',
          text: 'Read the file back and compare its row count with the source table. Fail the job if they differ.',
        },
        {
          strong: 'Schedule it as a Lakeflow Job.',
          text: 'Use a job for large or recurring files, with notifications on failure, instead of an analyst exporting by hand.',
        },
        {
          strong: 'Share by grant.',
          text: 'GRANT READ VOLUME to the partner group. For an organization outside your account, use OpenSharing to share the table itself.',
        },
      ],
      examples: [
        {
          label: 'Grant read access to the extracts volume',
          language: 'sql',
          code: 'GRANT READ VOLUME ON VOLUME <catalog>.<schema>.extracts TO `partner-analysts`;',
          notes: ['The files sit in a Unity Catalog volume, so access is a grant, not a shared link.'],
        },
      ],
    },
  ],
  related: [
    { slug: 'in-platform-visualization', title: 'Charts and dashboards in the platform' },
    { slug: 'local-tool-connectivity', title: 'Connecting local tools' },
  ],
};
