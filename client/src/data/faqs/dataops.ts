import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Does Lakeflow Jobs make my tasks safe to retry?',
    answer:
      'No. A retry or repair run re-executes a task from the beginning, so a task that appended half its output before failing duplicates it on the second try. Make the task idempotent with MERGE, REPLACE WHERE, or a checkpointed stream.',
    links: [
      {
        label: 'Troubleshoot and repair job failures',
        url: 'https://docs.databricks.com/aws/en/jobs/repair-job-failures',
      },
    ],
  },
  {
    question: 'When do I use a task retry and when a repair run?',
    answer:
      'Use a retry for a transient fault such as a brief outage or throttling. Use a repair run after you fix the cause, since it re-executes only the failed, skipped, and dependent tasks and keeps the successful ones. Repair is not available for single-task jobs.',
  },
  {
    question: 'Why did I not get a job failure alert for a task that failed?',
    answer:
      'Job-level failure notifications are not sent while a failed task is being retried. Add task-level notifications on critical tasks to hear about every failed attempt.',
    links: [{ label: 'Job notifications', url: 'https://docs.databricks.com/aws/en/jobs/notifications' }],
  },
  {
    question: 'How do I catch jobs that slowly get worse across runs?',
    answer:
      'Query the system.lakeflow tables, which keep 365 days of run and task history, and put a Databricks SQL alert on the result. This catches failure rate and duration drift that single-run alerts miss.',
    links: [{ label: 'Jobs system tables', url: 'https://docs.databricks.com/aws/en/admin/system-tables/jobs' }],
  },
  {
    question: 'Can I rely on RESTORE to undo a bad pipeline write?',
    answer:
      'Only in limited cases. RESTORE works inside the retention window (7 days of files and 30 days of log by default), acts on a single table, and can break streaming checkpoints. For several bad tables, redeploy the last good release and rerun, and take deep clone backups for longer recovery.',
    links: [{ label: 'RESTORE', url: 'https://docs.databricks.com/aws/en/sql/language-manual/delta-restore' }],
  },
  {
    question: 'Should I raise max_concurrent_runs?',
    answer:
      'Keep it at 1, the default for new jobs, when runs write the same tables. Raise it only for jobs that take their inputs as parameters and write disjoint slices. Turn on queueing for scheduled jobs so a run that hits the limit waits, up to 48 hours, instead of being skipped.',
  },
];
