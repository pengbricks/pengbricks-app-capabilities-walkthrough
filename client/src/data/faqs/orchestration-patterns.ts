import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Should I trigger a job on data or on a schedule?',
    answer:
      'Trigger on the data when you can, with table_update or file_arrival, so the job does not run when nothing is new. Use a cron schedule when a deadline sets the time, such as a report due at 7 a.m. Use continuous mode only when the work must not stop, since compute runs all the time.',
    links: [{ label: 'Trigger types for jobs', url: 'https://docs.databricks.com/aws/en/jobs/triggers' }],
  },
  {
    question: 'What does a repair run rerun?',
    answer:
      'Only the failed tasks and the tasks that depend on them, with earlier results kept. Fix the cause, then repair instead of rerunning the whole job. Keep tasks small and idempotent so a retried or repaired task produces the same result.',
    links: [
      {
        label: 'Troubleshoot and repair job failures',
        url: 'https://docs.databricks.com/aws/en/jobs/repair-job-failures',
      },
    ],
  },
  {
    question: 'When should I use For each instead of copying a task?',
    answer:
      'Use For each when the list changes between runs, such as regions, tenants, or files. It runs a nested task once per item, can run several iterations at the same time, and concurrency caps how many run at once. A failed iteration can be repaired on its own.',
    links: [{ label: 'Run a parameterized task in a loop', url: 'https://docs.databricks.com/aws/en/jobs/for-each' }],
  },
  {
    question: 'How do I pass a value from one task to the next?',
    answer:
      'Set a task value in the upstream task and read it downstream with a dynamic value reference such as {{tasks.validate.values.valid_rows}}. A row count or a flag does not need a table.',
    links: [{ label: 'Task values', url: 'https://docs.databricks.com/aws/en/jobs/task-values' }],
  },
  {
    question: 'Which identity should own a production job?',
    answer:
      'A service principal. A job that runs as a person stops working when that person leaves. Set run_as to a service principal in the bundle, and define the job in Git so changes go through review.',
  },
  {
    question: 'How do I run a cleanup or alert task after a failure?',
    answer:
      'Use run_if. The default is ALL_SUCCESS. Use ALL_DONE for a cleanup task, AT_LEAST_ONE_FAILED for an alert task, and AT_LEAST_ONE_SUCCESS for a task that follows whichever branch ran.',
    links: [{ label: 'Run tasks conditionally with run_if', url: 'https://docs.databricks.com/aws/en/jobs/run-if' }],
  },
];
