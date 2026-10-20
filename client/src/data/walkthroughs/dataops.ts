import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'dataops',
  area: 'CI/CD & Version Control Guides',
  title: 'Pipeline operations',
  intro:
    'Day-two operations come down to four questions. Can a failed task run again safely? Who finds out, and how fast? How do you see trends across runs? What do you do when a bad write has already landed? This page covers the Lakeflow Jobs settings and platform tables that answer them: idempotent tasks, retries and repair, notifications and health rules, system tables, concurrency limits, and recovery with Delta.',
  shortVersion: [
    {
      title: 'Make every task safe to run twice.',
      body: 'Retries and repair runs both re-execute a task from the start. Use MERGE or overwrite by partition so a second run replaces the first instead of duplicating it.',
    },
    {
      title: 'Retry for transient faults, repair for fixed faults.',
      body: 'A retry handles a blip inside the same run. A repair run re-executes only the failed and skipped tasks after you fix the cause, and keeps the successful ones.',
    },
    {
      title: 'Alert on tasks, and on slow runs.',
      body: 'Send failure and duration alerts to Slack, PagerDuty, Teams, or a webhook. Job-level failure alerts skip retried failures, so add task-level alerts where each failure matters.',
    },
    {
      title: 'Trend with system tables.',
      body: 'system.lakeflow tables hold run and task history for a year. A SQL alert on them catches failure rate and duration drift that single-run alerts miss.',
    },
    {
      title: 'RESTORE is a tool with limits.',
      body: 'It works only inside the retention window, acts on one table, and can break streaming checkpoints. Take deep clones for backups, and redeploy the last good release for multi-table rollback.',
    },
  ],
  sections: [
    {
      id: 'idempotent',
      heading: 'Design tasks to run twice',
      prose:
        'Lakeflow Jobs does not make tasks idempotent. A retry or a repair re-runs a task from the beginning, so a task that appended half its output before failing will duplicate it on the second try. Fix that in the task, not in the scheduler.',
      table: {
        caption: 'Write patterns and what a second run does',
        columns: ['Pattern', 'Second run'],
        rows: [
          ['MERGE on a business key', 'Updates the same rows and inserts only what is missing'],
          ['Overwrite one partition or date range (replaceWhere)', 'Replaces that slice with identical data'],
          ['Streaming table or Auto Loader with a checkpoint', 'Picks up from the checkpoint and skips files already processed'],
          ['Plain INSERT or append', 'Duplicates the rows from the first attempt'],
        ],
      },
      points: [
        {
          strong: 'Pass the slice as a parameter.',
          text: 'Give each task the date or batch it processes, rather than reading the clock inside it. A rerun then processes the same data.',
        },
        {
          strong: 'Write once at the end.',
          text: 'Build the result in a DataFrame or temp view, then write it in one atomic Delta commit. A failure before the commit leaves the table untouched.',
        },
        {
          strong: 'Keep side effects out of the middle.',
          text: 'Emails, API posts, and file moves do not roll back. Put them last, behind an idempotency key or a check that the work already happened.',
        },
      ],
      examples: [
        {
          label: 'Two idempotent writes',
          language: 'sql',
          code: `-- Upsert by key: a rerun updates the same rows
MERGE INTO silver.transactions AS t
USING staged_transactions AS s
  ON t.transaction_id = s.transaction_id
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *;

-- Replace one day: a rerun writes the same day again
INSERT INTO silver.daily_totals
REPLACE WHERE event_date = DATE'2026-10-19'
SELECT * FROM staged_daily_totals WHERE event_date = DATE'2026-10-19';`,
          notes: ['Use whichever matches the table grain: a key for entity tables, a partition or date for facts.'],
        },
      ],
      links: [
        {
          label: 'Troubleshoot and repair job failures',
          url: 'https://docs.databricks.com/aws/en/jobs/repair-job-failures',
          note: 'Why repair needs idempotent tasks.',
        },
        {
          label: 'Upsert with MERGE',
          url: 'https://docs.databricks.com/aws/en/delta/merge',
        },
        {
          label: 'Selective overwrite',
          url: 'https://docs.databricks.com/aws/en/delta/selective-overwrite',
        },
      ],
    },
    {
      id: 'retry-repair',
      heading: 'Retry, repair, or rerun',
      prose:
        'Three tools cover three situations. Pick by whether the fault was transient, what is already done, and whether you changed anything.',
      diagram: {
        type: 'matrix',
        title: 'Which recovery tool for which failure',
        description:
          'Task retries handle a transient fault inside the same run. A repair run re-executes only failed and skipped tasks in a multi-task job after the cause is fixed, and reuses successful tasks. A full rerun starts a new run of the whole job with fresh parameters.',
        corner: 'Tool ↓ · Detail →',
        columns: ['Use when', 'What runs again', 'Needs'],
        rows: [
          {
            label: 'Task retry',
            sub: 'max_retries and a retry interval',
            cells: [
              { state: 'own', text: 'Brief outage, throttling' },
              { state: 'own', text: 'The failed task' },
              { state: 'own', text: 'Idempotent task' },
            ],
          },
          {
            label: 'Repair run',
            sub: 'from the run page or the API',
            cells: [
              { state: 'own', text: 'Cause fixed after failure' },
              { state: 'own', text: 'Failed, skipped, and dependent tasks' },
              { state: 'own', text: 'Two or more tasks' },
            ],
          },
          {
            label: 'New run',
            sub: 'run now with parameters',
            cells: [
              { state: 'optional', text: 'Single-task job, or new inputs' },
              { state: 'optional', text: 'Every task' },
              { state: 'optional', text: 'Idempotent tasks' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Preferred for this case' },
          { state: 'optional', label: 'Valid, redoes completed work' },
        ],
        caption:
          'A repair uses current job and task settings, so you can fix a path or a parameter first. Repair is not available for single-task jobs.',
      },
      points: [
        {
          strong: 'Set retries with a delay.',
          text: 'A few retries with an interval of tens of seconds to minutes rides out short outages. Do not retry failures that are logic or data errors. They will fail the same way.',
        },
        {
          strong: 'A timeout applies to each attempt.',
          text: 'Set a task timeout so a hung attempt fails and retries instead of holding the run open.',
        },
        {
          strong: 'Repair runs stay in the run history.',
          text: 'The run page lists the original attempt and each repair, so the audit trail shows what ran when.',
        },
      ],
    },
    {
      id: 'alerts',
      heading: 'Tell the right people',
      prose:
        'Send alerts where the owner already works. Notification destinations are set up once by an admin and reused across jobs.',
      points: [
        {
          strong: 'Destinations.',
          text: 'Email, Slack, Microsoft Teams, PagerDuty, and generic webhooks. Use a webhook if you need a stable payload, because the Slack and Teams message text can change.',
        },
        {
          strong: 'Events.',
          text: 'Start, success, failure, duration warning, and streaming backlog. Alert on failure for every production job, and on duration warning for jobs with a deadline.',
        },
        {
          strong: 'Job-level versus task-level.',
          text: 'Job-level failure notifications are not sent while a failed task is being retried. Add task notifications on critical tasks to hear about every failed attempt.',
        },
        {
          strong: 'Health rules.',
          text: 'Set an expected run duration so the job flags slow runs before they fail, and a maximum duration to stop runaway runs. Streaming jobs can alert on backlog.',
        },
        {
          strong: 'Route by severity.',
          text: 'Page on failures of jobs with a downstream SLA. Send everything else to a team channel so the page stays meaningful.',
        },
      ],
      examples: [
        {
          label: 'Retry, alert, and health settings in a bundle job',
          language: 'yaml',
          code: `resources:
  jobs:
    nightly_load:
      max_concurrent_runs: 1
      timeout_seconds: 7200
      queue:
        enabled: true
      health:
        rules:
          - metric: RUN_DURATION_SECONDS
            op: GREATER_THAN
            value: 3600
      email_notifications:
        on_failure: [data-oncall@example.com]
        on_duration_warning_threshold_exceeded: [data-oncall@example.com]
      webhook_notifications:
        on_failure:
          - id: <notification-destination-id>
      tasks:
        - task_key: ingest
          max_retries: 2
          min_retry_interval_millis: 60000
          timeout_seconds: 1800`,
          notes: ['The destination id comes from the admin settings page for notification destinations.'],
        },
      ],
      links: [
        {
          label: 'Job notifications',
          url: 'https://docs.databricks.com/aws/en/jobs/notifications',
          note: 'Destinations, events, and webhooks.',
        },
        {
          label: 'Configure jobs',
          url: 'https://docs.databricks.com/aws/en/jobs/configure-job',
          note: 'Duration thresholds, timeouts, queueing, concurrent runs.',
        },
      ],
    },
    {
      id: 'monitor',
      heading: 'Watch trends in system tables',
      prose:
        'Notifications fire on one run. System tables show the pattern across runs: a job that fails one run in five, or a duration that grows week over week. system.lakeflow keeps 365 days of history, and you can query it with SQL and alert on it.',
      table: {
        columns: ['Table', 'Use'],
        rows: [
          ['system.lakeflow.jobs', 'Job definitions, owners, and settings over time'],
          ['system.lakeflow.job_tasks', 'Task definitions and dependencies'],
          ['system.lakeflow.job_run_timeline', 'One row per run period: result state, termination code, trigger'],
          ['system.lakeflow.job_task_run_timeline', 'The same per task, including retry attempts'],
        ],
      },
      examples: [
        {
          label: 'Failure rate by job, for a SQL alert',
          language: 'sql',
          code: `SELECT job_id, runs, failure_rate
FROM (
  SELECT job_id,
         count(*) AS runs,
         round(avg(CASE WHEN result_state <> 'SUCCEEDED' THEN 1 ELSE 0 END), 3) AS failure_rate
  FROM system.lakeflow.job_run_timeline
  WHERE period_start_time >= current_timestamp() - INTERVAL 7 DAYS
    AND result_state IS NOT NULL
  GROUP BY job_id
)
WHERE failure_rate > 0.2 AND runs >= 5;`,
          notes: [
            'Save the query, add a Databricks SQL alert that triggers when it returns a row, and send it to the team channel.',
            'Join system.lakeflow.jobs for names and owners, and system.billing.usage for cost per job.',
          ],
        },
      ],
      links: [
        {
          label: 'Jobs system tables',
          url: 'https://docs.databricks.com/aws/en/admin/system-tables/jobs',
          note: 'Schemas and retention.',
        },
        {
          label: 'SQL alerts',
          url: 'https://docs.databricks.com/aws/en/sql/user/alerts',
        },
      ],
    },
    {
      id: 'concurrency',
      heading: 'Control overlap, queueing, and runtime',
      points: [
        {
          strong: 'max_concurrent_runs.',
          text: 'It defaults to 1 for new jobs. Keep 1 when runs write the same tables, so a slow run cannot overlap the next. Raise it only for jobs that take their inputs as parameters and write disjoint slices.',
        },
        {
          strong: 'Queueing.',
          text: 'With queueing on, a run that hits a concurrency limit waits, up to 48 hours, instead of being skipped. Enable it for scheduled jobs where a skipped run means a data gap.',
        },
        {
          strong: 'Timeouts.',
          text: 'Set a job timeout for the whole run and task timeouts for each attempt. Pair the timeout with a duration warning at a lower value so someone hears about slowness before the kill.',
        },
        {
          strong: 'Isolate environments.',
          text: 'Deploy the same bundle to dev and test targets with separate schemas and name prefixes, so a test run cannot touch production tables.',
        },
      ],
    },
    {
      id: 'recovery',
      heading: 'Recover from a bad write',
      prose:
        'Delta keeps previous versions, so a bad write is usually reversible. Know the limits before you rely on it.',
      points: [
        {
          strong: 'RESTORE works only inside retention.',
          text: 'Time travel is limited by delta.deletedFileRetentionDuration (7 days by default) and log retention (30 days). VACUUM removes the files an older version needs. Raise retention on tables you may need to restore.',
        },
        {
          strong: 'RESTORE acts on one table.',
          text: 'A pipeline that wrote five tables needs five restores, and they may not line up. For several tables, redeploy the last good release and rerun from a known input.',
        },
        {
          strong: 'Restore can break streaming.',
          text: 'A streaming query that reads or writes a restored table can fail or reprocess data, because its checkpoint no longer matches the table. Plan to reset the checkpoint or start from a known version.',
        },
        {
          strong: 'Use deep clone for backups.',
          text: 'History is not a backup. A deep clone copies data and metadata to an independent table, and reruns copy only what changed.',
        },
        {
          strong: 'RESTORE is recorded.',
          text: 'It adds a new entry to the table history, so the rollback is auditable.',
        },
      ],
      examples: [
        {
          label: 'Find the last good version, restore, then back up',
          language: 'sql',
          code: `DESCRIBE HISTORY silver.transactions;

RESTORE TABLE silver.transactions TO VERSION AS OF 41;

-- Independent backup you can restore from after retention expires
CREATE OR REPLACE TABLE backup.transactions_daily
DEEP CLONE silver.transactions;`,
          notes: ['Check the history first. Restore to the version before the bad write, not the one that wrote it.'],
        },
      ],
      links: [
        {
          label: 'RESTORE',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/delta-restore',
        },
        {
          label: 'Table history and retention',
          url: 'https://docs.databricks.com/aws/en/tables/history',
        },
        {
          label: 'Clone a table',
          url: 'https://docs.databricks.com/aws/en/tables/operations/clone',
        },
      ],
    },
    {
      id: 'runbook',
      heading: 'Write the runbook and name the owner',
      prose:
        'Alerts without a response plan wake the wrong person. Keep a short runbook per job, next to the code, and check it with the people who answer the page.',
      steps: [
        {
          title: 'Name an owner and a backup',
          body: 'Run the job as a service principal, give the on-call group CAN MANAGE on it, and list the team in the job tags and the runbook.',
        },
        {
          title: 'Record the first three checks',
          body: 'Link the run page, the upstream source status, and the system table query for recent failures. State which failures to repair and which to escalate.',
        },
        {
          title: 'Say what is safe to rerun',
          body: 'Write which tasks are idempotent, what a repair run does, and which tables need a restore after a partial write.',
        },
        {
          title: 'Review after each incident',
          body: 'Add the missing alert, health rule, or test that would have caught it, and ship it through the same bundle.',
        },
      ],
    },
  ],
  related: [
    { slug: 'github-cicd', title: 'GitHub-based CI/CD' },
    { slug: 'versioning', title: 'Data contract versioning' },
  ],
};
