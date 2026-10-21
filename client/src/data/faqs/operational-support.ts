import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'How do I make a cleanup or notification task run even when upstream tasks fail?',
    answer:
      'Set run_if to ALL_DONE, or AT_LEAST_ONE_FAILED, on that task. Tasks with the default ALL_SUCCESS condition are skipped when an upstream task fails, but an ALL_DONE task still runs and can release resources and report.',
    links: [{ label: 'Configure task dependencies and run_if', url: 'https://docs.databricks.com/aws/en/jobs/run-if' }],
  },
  {
    question: 'How should I keep a streaming workload running without someone watching it?',
    answer:
      'Use a continuous job, which keeps one run active and restarts it after it ends or fails, or a Lakeflow Spark Declarative Pipeline in continuous mode. Keep the checkpoint so a restart does not reprocess data, and set a streaming backlog threshold to alert you.',
    links: [{ label: 'Run jobs continuously', url: 'https://docs.databricks.com/aws/en/jobs/continuous' }],
  },
  {
    question: 'Do continuous jobs still need unlimited retries and one concurrent run?',
    answer:
      'No. A continuous trigger keeps exactly one run active and restarts it, failed tasks retry with exponential backoff, and Task retry mode defaults to On failure. This replaces the older advice to set unlimited retries and one concurrent run.',
  },
  {
    question: 'Why did I not get paged for a failed task?',
    answer:
      'Job-level failure notifications are not sent for failed tasks that are retried. Add task-level notifications to hear about each failed attempt. Also, a run that ends in the Succeeded with failures state counts as successful, so select the Success event if you want a notification for it.',
    links: [{ label: 'Add notifications on a job', url: 'https://docs.databricks.com/aws/en/jobs/notifications' }],
  },
  {
    question: 'Does managed disaster recovery protect me from corruption or a bad delete?',
    answer:
      'No. Replication copies mistakes to both regions. Use Delta time travel and RESTORE for recent changes, and keep object-store versioning or backups for external storage. Managed DR also does not cover cross-cloud, which you plan as a separate project.',
    links: [{ label: 'Disaster recovery', url: 'https://docs.databricks.com/aws/en/admin/disaster-recovery' }],
  },
  {
    question: 'What goes into a Databricks support case?',
    answer:
      'Include the workspace ID, job and run IDs, the error text, the time window, and what you already tried. Check status.databricks.com first for a known incident. Escalate in order from the owning team on-call to the platform team to Databricks support.',
    links: [{ label: 'Databricks status', url: 'https://status.databricks.com' }],
  },
];
