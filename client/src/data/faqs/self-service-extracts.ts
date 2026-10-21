import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Should a published dashboard use shared or individual data permissions?',
    answer:
      'Publish with shared data permissions, using a service principal credential, for broad non-sensitive audiences. Use individual data permissions when readers differ in what they may see. Shared runs as the publisher and fills a shared cache, so every viewer sees the same data. Individual runs as each viewer, so row filters and column masks apply per person.',
    links: [{ label: 'Share dashboards', url: 'https://docs.databricks.com/aws/en/dashboards/share/' }],
  },
  {
    question: 'Can I send a dashboard to people outside the workspace?',
    answer:
      'Yes. Add subscribers as workspace users, or use a notification destination such as email, Slack, or Microsoft Teams for people outside the workspace. A subscription can attach PDF pages and widget data as CSV, TSV, or Excel.',
    links: [
      {
        label: 'Schedules and subscriptions',
        url: 'https://docs.databricks.com/aws/en/dashboards/share/schedule-subscribe',
      },
    ],
  },
  {
    question: 'How do I make a scheduled dashboard load faster?',
    answer:
      'Use a serverless SQL warehouse so the scheduled run starts quickly, and publish with shared data permissions so scheduled updates fill a shared cache. Dataset materialization, in Beta per the release notes, also stores dashboard dataset results on a schedule so published dashboards render from stored results.',
  },
  {
    question: 'How do I deliver a recurring file to a partner system?',
    answer:
      'Write the file from a Lakeflow Job into a Unity Catalog volume, read it back and compare its row count with the source table, and fail the job if they differ. Then run GRANT READ VOLUME to the partner group, so access is a grant instead of a shared link.',
    links: [
      {
        label: 'Work with files in Unity Catalog volumes',
        url: 'https://docs.databricks.com/aws/en/ingestion/file-upload/',
      },
    ],
  },
  {
    question: 'Should I send an outside organization a file or share the table?',
    answer:
      'Use OpenSharing for outside organizations that can read it. A file is a copy that is out of date once written, so you own the schedule and the row-count check. Use files in a volume only for systems that take nothing but files, and downloads for one-off requests.',
    links: [{ label: 'OpenSharing', url: 'https://docs.databricks.com/aws/en/opensharing' }],
  },
  {
    question: 'Do Excel users keep their own permissions when they pull data?',
    answer:
      'Yes. The Excel Add-in (GA) imports Unity Catalog tables and views and refreshes them on a schedule, with the permissions of the user still in force.',
    links: [{ label: 'Databricks Excel Add-in', url: 'https://docs.databricks.com/aws/en/integrations/excel/' }],
  },
];
