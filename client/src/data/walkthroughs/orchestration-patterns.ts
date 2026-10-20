import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'orchestration-patterns',
  area: 'Data Engineering Guides',
  title: 'Orchestration patterns',
  intro:
    'Lakeflow Jobs orchestrates notebooks, pipelines, SQL, dbt, and Python tasks as one dependency graph. This page covers the features to reach for first: task values and dependencies, parallel branches, run_if and condition tasks, For each loops, data-driven triggers, retries and repair runs, and notifications. It ends with how to run jobs safely as a team.',
  shortVersion: [
    {
      title: 'Pass values between tasks.',
      body: 'A task sets a task value and the next task reads it, so a row count or a flag does not need a table.',
    },
    {
      title: 'Parallelize and branch with the graph.',
      body: 'Tasks that depend on the same upstream task run together. run_if and condition tasks choose a path, and For each runs one task per list item.',
    },
    {
      title: 'Start on data, not on a clock.',
      body: 'Use a table-update or file-arrival trigger when new data should start the work. Use a schedule when a deadline drives it.',
    },
    {
      title: 'Plan for failure.',
      body: 'Set retries and timeouts on flaky tasks, alert on failure and slow runs, and repair a failed run to rerun only the tasks that need it.',
    },
    {
      title: 'Run as a service principal, defined in Git.',
      body: 'Own production jobs with a service principal, define them in a bundle, and tag them so you can find and manage them in bulk.',
    },
  ],
  sections: [
    {
      id: 'graph',
      heading: 'Compose the task graph',
      prose:
        'Dependencies define order. A task starts when its upstream tasks finish, so two tasks that share an upstream run in parallel. A task reads a value from upstream with a dynamic value reference such as {{tasks.validate.values.valid_rows}}.',
      diagram: {
        type: 'flow',
        title: 'Sequence, parallel branches, and a condition',
        description:
          'Extract feeds validate. Validate feeds two parallel branches. Both feed a join task. A condition task checks a task value. A true outcome runs publish and a false outcome runs hold for review. Both paths feed a final record task.',
        lanes: [
          { label: 'Sequential', fromRow: 0, toRow: 0 },
          { label: 'Parallel branches', fromRow: 1, toRow: 1 },
          { label: 'Join and branch', fromRow: 2, toRow: 3 },
        ],
        nodes: [
          { id: 'extract', label: 'extract', mono: true, sub: 'sets row_count', col: 0, row: 0 },
          { id: 'validate', label: 'validate', mono: true, sub: 'sets valid_rows', col: 1, row: 0 },
          { id: 'a', label: 'branch_a', mono: true, col: 1, row: 1, kind: 'highlight' },
          { id: 'b', label: 'branch_b', mono: true, col: 2, row: 1, kind: 'highlight' },
          { id: 'join', label: 'join', mono: true, sub: 'waits for both', col: 1, row: 2 },
          { id: 'cond', label: 'enough_rows', mono: true, sub: 'condition task', col: 2, row: 2, kind: 'gate' },
          { id: 'publish', label: 'publish', mono: true, sub: 'true path', col: 2, row: 3 },
          { id: 'hold', label: 'hold_for_review', mono: true, sub: 'false path', col: 3, row: 3 },
          { id: 'record', label: 'record', mono: true, sub: 'AT_LEAST_ONE_SUCCESS', col: 4, row: 3, kind: 'store' },
        ],
        edges: [
          { from: 'extract', to: 'validate' },
          { from: 'validate', to: 'a' },
          { from: 'validate', to: 'b' },
          { from: 'a', to: 'join' },
          { from: 'b', to: 'join' },
          { from: 'join', to: 'cond' },
          { from: 'cond', to: 'publish', label: 'true' },
          { from: 'cond', to: 'hold', label: 'false', dashed: true },
          { from: 'publish', to: 'record' },
          { from: 'hold', to: 'record', dashed: true },
        ],
        legend: [
          { kind: 'highlight', label: 'Runs in parallel' },
          { kind: 'gate', label: 'Condition task' },
          { kind: 'dashed', label: 'Path taken only when the condition is false' },
        ],
      },
      points: [
        {
          strong: 'run_if sets when a task runs.',
          text: 'The default is ALL_SUCCESS. Use ALL_DONE for a cleanup task, AT_LEAST_ONE_FAILED for an alert task, and AT_LEAST_ONE_SUCCESS for a task that follows whichever branch ran.',
        },
        {
          strong: 'Keep tasks small.',
          text: 'One task per unit of retry. A single large notebook cannot be repaired in part.',
        },
        {
          strong: 'Use native task types.',
          text: 'Run pipelines, SQL, dbt, and Python wheel tasks directly instead of wrapping each in a notebook.',
        },
      ],
      links: [
        {
          label: 'Lakeflow Jobs',
          url: 'https://docs.databricks.com/aws/en/jobs/',
        },
        {
          label: 'Task values',
          url: 'https://docs.databricks.com/aws/en/jobs/task-values',
        },
        {
          label: 'Run tasks conditionally with run_if',
          url: 'https://docs.databricks.com/aws/en/jobs/run-if',
        },
      ],
    },
    {
      id: 'foreach',
      heading: 'Loop with For each',
      prose:
        'For each runs a nested task once per item in a list and can run several iterations at the same time. Use it when the list changes between runs, such as regions, tenants, or files, so you do not copy a task per item. The list can be a literal or the output of an upstream task.',
      examples: [
        {
          label: 'Run one task per item',
          language: 'yml',
          code: '- task_key: per_region\n  for_each_task:\n    inputs: \'["east", "west", "south"]\'\n    concurrency: 2\n    task:\n      task_key: per_region_iteration\n      notebook_task:\n        notebook_path: ../src/process_region.py\n        base_parameters:\n          region: "{{input}}"',
          notes: ['concurrency caps how many iterations run at once. A failed iteration can be repaired on its own.'],
        },
      ],
      links: [
        {
          label: 'Run a parameterized task in a loop',
          url: 'https://docs.databricks.com/aws/en/jobs/for-each',
        },
      ],
    },
    {
      id: 'triggers',
      heading: 'Start on data, not on a clock',
      prose:
        'A trigger starts the job when the data it depends on changes, so it does not poll on a fixed schedule and does not run when nothing is new. Use a cron schedule only when a deadline, such as a report due at 7 a.m., sets the time.',
      table: {
        columns: ['Start the job when', 'Use'],
        rows: [
          ['A Unity Catalog table is updated', 'table_update trigger'],
          ['Files land in a volume or external location', 'file_arrival trigger'],
          ['Work must always be running, as in streaming', 'continuous mode'],
          ['A deadline or calendar sets the time', 'cron schedule'],
        ],
      },
      examples: [
        {
          label: 'Start when upstream tables change',
          language: 'yml',
          code: 'trigger:\n  pause_status: UNPAUSED\n  table_update:\n    table_names:\n      - ${var.catalog}.${var.schema}.orders_valid\n    condition: ANY_UPDATED\n    min_time_between_triggers_seconds: 300',
          notes: ['Use trigger in place of schedule. A file_arrival trigger takes a volume path in the same way.'],
        },
      ],
      links: [
        {
          label: 'Trigger jobs when source tables are updated',
          url: 'https://docs.databricks.com/aws/en/jobs/trigger-table-update',
        },
        {
          label: 'Trigger jobs when new files arrive',
          url: 'https://docs.databricks.com/aws/en/jobs/file-arrival-triggers',
        },
      ],
    },
    {
      id: 'settings',
      heading: 'Retries, timeouts, and alerts',
      prose: 'Set these on the job in the bundle, so a review sees them. Tune them per task, not once for the whole job.',
      table: {
        columns: ['Setting', 'Use it for'],
        rows: [
          ['max_retries, min_retry_interval_millis', 'Retry a task that fails on a transient error, such as a network call'],
          ['timeout_seconds', 'Stop a task that hangs instead of waiting forever'],
          ['Duration health rule', 'Warn when a run is slower than expected, before it breaches an SLA'],
          ['Notifications on failure, success, and slow runs', 'Send to email or a destination such as Slack, Microsoft Teams, or PagerDuty'],
          ['queue and max_concurrent_runs', 'Decide whether an overlapping run waits, skips, or runs alongside'],
        ],
      },
      links: [
        {
          label: 'Job notifications and alerts',
          url: 'https://docs.databricks.com/aws/en/jobs/notifications',
        },
      ],
    },
    {
      id: 'repair',
      heading: 'Repair a failed run',
      prose:
        'A repair run reruns only the failed tasks and the tasks that depend on them, with the earlier results kept. Fix the cause, then repair, instead of rerunning the whole job. This is why tasks should be small and idempotent: a retried or repaired task must produce the same result.',
      links: [
        {
          label: 'Troubleshoot and repair job failures',
          url: 'https://docs.databricks.com/aws/en/jobs/repair-job-failures',
        },
      ],
    },
    {
      id: 'bulk-pause',
      heading: 'Operate jobs as a team',
      prose:
        'Production jobs need an owner that is not a person, a source of truth in Git, and a way to act on many at once.',
      points: [
        {
          strong: 'Run as a service principal.',
          text: 'A job that runs as a person stops working when that person leaves. Set run_as to a service principal in the bundle.',
        },
        {
          strong: 'Define jobs in a bundle.',
          text: 'Review changes in Git, and let the target control pause_status so development copies do not run on their schedule.',
        },
        {
          strong: 'Tag jobs.',
          text: 'A tag lets one script list, pause, or resume a group of jobs through the Jobs API, for example before maintenance.',
        },
        {
          strong: 'Watch runs from system tables.',
          text: 'The system.lakeflow tables record job and task runs, so one query shows failures, durations, and trends across workspaces.',
        },
        {
          strong: 'Prefer serverless jobs.',
          text: 'They start fast and need no cluster sizing. Use budget policies to attribute their cost.',
        },
      ],
      links: [
        {
          label: 'Jobs system tables',
          url: 'https://docs.databricks.com/aws/en/admin/system-tables/jobs',
        },
      ],
    },
  ],
  related: [
    { slug: 'data-observability', title: 'Lineage and drift detection' },
    { slug: 'dataops', title: 'Pipeline operations' },
  ],
};
