import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'orchestration-patterns',
  area: 'Data Engineering Guides',
  title: 'Orchestration patterns',
  intro:
    'One Lakeflow Job chains tasks that pass values, runs two branches in parallel, retries a flaky external call, and branches on a condition. A second job pauses every scheduled guide job in one operation and restores them afterward.',
  shortVersion: [
    {
      title: 'Tasks pass values.',
      body: 'extract sets row_count and validate sets valid_rows with task values. The next task reads them, so no table is needed to hand over a number.',
    },
    {
      title: 'Branches run in parallel.',
      body: 'branch_region and branch_status depend only on validate. join_branches waits for both.',
    },
    {
      title: 'A retry policy absorbs a bad first attempt.',
      body: 'external_call fails on purpose at attempt 0 and succeeds at attempt 1. It runs a shell command and an HTTP request.',
    },
    {
      title: 'Alerts cover success, failure, and slow runs.',
      body: 'Email notifications fire on all three, and a run-duration health rule drives the slow-run warning.',
    },
    {
      title: 'One run pauses every scheduled guide job.',
      body: 'The bulk pause job records each schedule before and after, then restores only the jobs it paused.',
    },
  ],
  sections: [
    {
      id: 'graph',
      heading: 'The task graph',
      prose:
        'The job has eleven tasks. A chain feeds a fan-out, the branches join, an external call retries, and a condition picks publish or hold. The record_run task runs after whichever branch was taken.',
      diagram: {
        type: 'flow',
        title: 'Tasks in capability-guides-orchestration',
        description:
          'extract feeds validate. validate feeds two parallel tasks, branch_region and branch_status. Both feed join_branches. join_branches feeds external_call, which retries. external_call feeds the enough_valid_rows condition. A true outcome runs publish and a false outcome runs hold_for_review. Both feed record_run.',
        lanes: [
          { label: 'Sequential', fromRow: 0, toRow: 0 },
          { label: 'Parallel branches', fromRow: 1, toRow: 1 },
          { label: 'Join, call, branch', fromRow: 2, toRow: 3 },
        ],
        nodes: [
          { id: 'extract', label: 'extract', mono: true, sub: 'sets row_count', col: 0, row: 0 },
          { id: 'validate', label: 'validate', mono: true, sub: 'sets valid_rows', col: 1, row: 0 },
          { id: 'region', label: 'branch_region', mono: true, col: 1, row: 1, kind: 'highlight' },
          { id: 'status', label: 'branch_status', mono: true, col: 2, row: 1, kind: 'highlight' },
          { id: 'join', label: 'join_branches', mono: true, sub: 'waits for both', col: 1, row: 2 },
          { id: 'external', label: 'external_call', mono: true, sub: 'shell + HTTP, retries', col: 2, row: 2 },
          { id: 'cond', label: 'enough_valid_rows', mono: true, sub: 'valid_rows > 2000', col: 3, row: 2, kind: 'gate' },
          { id: 'publish', label: 'publish', mono: true, sub: 'true branch', col: 2, row: 3 },
          { id: 'hold', label: 'hold_for_review', mono: true, sub: 'false branch', col: 3, row: 3 },
          { id: 'record', label: 'record_run', mono: true, sub: 'writes orch_task_log', col: 4, row: 3, kind: 'store' },
        ],
        edges: [
          { from: 'extract', to: 'validate' },
          { from: 'validate', to: 'region' },
          { from: 'validate', to: 'status' },
          { from: 'region', to: 'join' },
          { from: 'status', to: 'join' },
          { from: 'join', to: 'external' },
          { from: 'external', to: 'cond' },
          { from: 'cond', to: 'publish', label: 'true' },
          { from: 'cond', to: 'hold', label: 'false', dashed: true },
          { from: 'publish', to: 'record' },
          { from: 'hold', to: 'record', dashed: true },
        ],
        legend: [
          { kind: 'highlight', label: 'Runs in parallel' },
          { kind: 'gate', label: 'Condition task' },
          { kind: 'dashed', label: 'Branch not taken in this run' },
        ],
        caption: 'In the reference run the condition was true, so hold_for_review shows as excluded.',
      },
      examples: [
        {
          label: "Run one task per item with For each",
          language: 'yml',
          code: "- task_key: per_region\n  for_each_task:\n    inputs: '[\"east\", \"west\", \"south\"]'\n    concurrency: 2\n    task:\n      task_key: per_region_iteration\n      notebook_task:\n        notebook_path: ../guides/orchestration-patterns/03_branch.py\n        base_parameters:\n          dimension: \"{{input}}\"",
          notes: ["The reference job fans out to two fixed branches. For each handles a list that changes between runs."],
        },
      ],
    },
    {
      id: 'run',
      heading: 'What the reference run recorded',
      prose:
        'record_run writes one row per task to orch_task_log. The run shows the retry as two external_call rows, and the skipped branch as excluded.',
      diagram: {
        type: 'matrix',
        title: 'Task results in the reference run',
        description:
          'extract, validate, branch_region, branch_status, join_branches, enough_valid_rows, and publish each succeeded at attempt 0. external_call failed at attempt 0 after 22 seconds and succeeded at attempt 1 after 59 seconds. hold_for_review was excluded.',
        corner: 'Task ↓ · Attempt →',
        columns: ['Attempt 0', 'Attempt 1'],
        rows: [
          { label: 'extract', sub: '2,400 rows', cells: [{ state: 'own', text: 'SUCCESS 47 s' }, { state: 'none', text: 'not needed' }] },
          { label: 'validate', sub: '2,341 valid', cells: [{ state: 'own', text: 'SUCCESS 24 s' }, { state: 'none', text: 'not needed' }] },
          { label: 'branch_region', sub: '4 groups', cells: [{ state: 'own', text: 'SUCCESS 26 s' }, { state: 'none', text: 'not needed' }] },
          { label: 'branch_status', sub: '3 groups', cells: [{ state: 'own', text: 'SUCCESS 27 s' }, { state: 'none', text: 'not needed' }] },
          { label: 'external_call', sub: 'retry policy', cells: [{ state: 'optional', text: 'FAILED 22 s' }, { state: 'own', text: 'SUCCESS 59 s' }] },
          { label: 'publish', sub: 'true branch', cells: [{ state: 'own', text: 'SUCCESS 28 s' }, { state: 'none', text: 'not needed' }] },
          { label: 'hold_for_review', sub: 'false branch', cells: [{ state: 'none', text: 'EXCLUDED' }, { state: 'none', text: 'not needed' }] },
        ],
        legend: [
          { state: 'own', label: 'Succeeded' },
          { state: 'optional', label: 'Failed, then retried' },
          { state: 'none', label: 'Not run' },
        ],
      },
    },
    {
      id: 'settings',
      heading: 'Schedule, retries, and alerts',
      prose: 'These settings sit on the job in resources/orchestration_patterns.job.yml.',
      table: {
        columns: ['Setting', 'Value'],
        rows: [
          ['schedule', 'cron 0 0 6 * * ?, UTC, pause_status PAUSED'],
          ['external_call retry', 'max_retries 2, 10 s interval, retry_on_timeout'],
          ['email_notifications', 'on_success, on_failure, on_duration_warning_threshold_exceeded'],
          ['health rule', 'RUN_DURATION_SECONDS greater than 900'],
          ['external process', 'python3 --version via subprocess; HTTP GET returned 200 in 117 ms'],
          ['condition', 'valid_rows task value greater than the min_valid_rows job parameter'],
        ],
      },
      examples: [
        {
          label: "Start on new data instead of a clock",
          language: 'yml',
          code: "trigger:\n  pause_status: UNPAUSED\n  table_update:\n    table_names:\n      - ${var.catalog}.${var.schema}.orch_orders_valid\n    condition: ANY_UPDATED\n    min_time_between_triggers_seconds: 300",
          notes: ["Use trigger in place of schedule. A file_arrival trigger works the same way for a volume path."],
        },
      ],
    },
    {
      id: 'bulk-pause',
      heading: 'Pause every scheduled job at once',
      prose:
        'The bulk pause job lists jobs by the capability_guide_job tag, pauses those that are unpaused, logs each state, and restores only the jobs it paused. Dev mode keeps bundle schedules paused, so a probe job with an unpaused schedule gives the pause something to change.',
      diagram: {
        type: 'flow',
        title: 'Bulk pause and resume',
        description:
          'prepare creates the probe job and records the before states. pause_all sets every unpaused tagged schedule to paused and records the jobs it changed. resume_all restores those jobs. cleanup_probe deletes the probe. Every phase writes to bulk_pause_log.',
        nodes: [
          { id: 'prepare', label: 'prepare', mono: true, sub: 'create probe, log before', col: 0, row: 0 },
          { id: 'pause', label: 'pause_all', mono: true, sub: 'UNPAUSED to PAUSED', col: 1, row: 0, kind: 'highlight' },
          { id: 'resume', label: 'resume_all', mono: true, sub: 'restore changed jobs', col: 2, row: 0, kind: 'highlight' },
          { id: 'cleanup', label: 'cleanup_probe', mono: true, sub: 'delete probe', col: 3, row: 0 },
          { id: 'log', label: 'bulk_pause_log', mono: true, sub: 'every phase', col: 1, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'prepare', to: 'pause' },
          { from: 'pause', to: 'resume' },
          { from: 'resume', to: 'cleanup' },
          { from: 'pause', to: 'log' },
        ],
        legend: [
          { kind: 'highlight', label: 'Changes schedules through the Jobs API' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
        caption:
          'The run found 2 tagged scheduled jobs. The probe went from UNPAUSED to PAUSED and back; the orchestration job stayed PAUSED throughout.',
      },
    },
  ],
  related: [
    { slug: 'data-observability', title: 'Lineage and drift detection' },
    { slug: 'dataops', title: 'Pipeline operations' },
  ],
};
