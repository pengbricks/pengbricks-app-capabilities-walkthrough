import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'operational-support',
  area: 'Governance/Monitoring',
  title: 'Support and recovery',
  intro:
    'A job fails one task on purpose, triages every failed capability guide run, classifies each error, and routes it to an owner from an on_call table. A second job repairs the failed run through the Jobs API repair endpoint and records the outcome in support_incidents.',
  shortVersion: [
    {
      title: 'One task fails by design.',
      body: 'fragile_step raises on the original run. The job ends as succeeded with one failed task, which is the state a support engineer inherits.',
    },
    {
      title: 'Triage reads two sources.',
      body: 'The Jobs API gives the failed task and its error text. system.lakeflow.job_run_timeline cross-checks the run-level result.',
    },
    {
      title: 'Errors get a class and a route.',
      body: 'Regular expressions in the spec map each error to a class and severity. The job tag then picks an on_call row.',
    },
    {
      title: 'Repair reruns only what failed.',
      body: 'support_repair calls repair_run with the failed task keys. The same run ID finishes as SUCCESS.',
    },
    {
      title: 'Retries recover the rest.',
      body: 'write_with_retry fails once, passes on the retry, and writes its rows with a MERGE, so the retry adds no duplicates.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'Fail, triage, repair',
      prose:
        'The support job runs once and leaves a failed run behind. The repair job finds that run, reruns the failed task, and updates the incident that triage opened.',
      diagram: {
        type: 'flow',
        title: 'From failure to a recorded repair',
        description:
          'The operational support job writes on_call, then runs write_with_retry and fragile_step. fragile_step fails on the original run. triage runs after both tasks, reads failed runs from the Jobs API and system tables, classifies each error, routes it using on_call, and writes support_incidents. The support repair job calls the repair endpoint on the failed run and updates the incident.',
        lanes: [
          { label: 'Support job', fromRow: 0, toRow: 1 },
          { label: 'Repair job', fromRow: 2, toRow: 2 },
          { label: 'Tables', fromRow: 3, toRow: 3 },
        ],
        nodes: [
          { id: 'setup', label: 'setup_on_call', mono: true, sub: 'writes the owner map', col: 0, row: 0 },
          { id: 'retry', label: 'write_with_retry', mono: true, sub: 'fails once, then passes', col: 1, row: 0 },
          { id: 'fragile', label: 'fragile_step', mono: true, sub: 'fails by design', col: 2, row: 0, kind: 'gate' },
          { id: 'triage', label: 'triage', mono: true, sub: 'runs after both tasks', col: 1, row: 1, kind: 'highlight' },
          { id: 'api', label: 'Jobs API', sub: 'tasks and errors', col: 2, row: 1, kind: 'surface' },
          { id: 'sys', label: 'System tables', sub: 'job_run_timeline', col: 3, row: 1, kind: 'surface' },
          { id: 'repair', label: 'repair_failed_run', mono: true, sub: 'repair_run endpoint', col: 1, row: 2, kind: 'highlight' },
          { id: 'oncall', label: 'on_call', mono: true, sub: 'owner and escalation', col: 0, row: 3, kind: 'store' },
          { id: 'inc', label: 'support_incidents', mono: true, sub: 'one row per failure', col: 1, row: 3, kind: 'store' },
        ],
        edges: [
          { from: 'setup', to: 'retry' },
          { from: 'retry', to: 'triage' },
          { from: 'fragile', to: 'triage', label: 'ALL_DONE' },
          { from: 'api', to: 'triage', dashed: true },
          { from: 'sys', to: 'triage', dashed: true },
          { from: 'triage', to: 'repair', label: 'failed run' },
          { from: 'oncall', to: 'inc', label: 'routes' },
          { from: 'repair', to: 'inc', label: 'outcome' },
        ],
        legend: [
          { kind: 'gate', label: 'Fails on purpose' },
          { kind: 'highlight', label: 'Support action' },
          { kind: 'store', label: 'Delta table' },
        ],
        caption: 'Reference run: fragile_step failed, the repair job reran it as repair 1080614604838017, and the original run finished as SUCCESS.',
      },
    },
    {
      id: 'routing',
      heading: 'How an error reaches a person',
      prose:
        'Classification uses the first matching pattern in the spec. Routing uses the job tag, then the use-case tag, then a wildcard row. High severity also pages the escalation contact.',
      diagram: {
        type: 'matrix',
        title: 'Error class, severity, and route',
        description:
          'Examples from the reference triage. A TransientSourceError from the support job is class transient, severity low, and notifies platform-support with escalation after 30 minutes. A PERMISSION_DENIED error from another guide job is class permission, severity high, and pages the owner and the escalation contact immediately. A Delta metadata change is class concurrency, severity low.',
        corner: 'Example error ↓ · Result →',
        columns: ['Class', 'Severity', 'Route'],
        rows: [
          {
            label: 'TransientSourceError',
            sub: 'fragile_step',
            cells: [
              { state: 'own', text: 'transient' },
              { state: 'none', text: 'low' },
              { state: 'own', text: 'Notify owner', sub: 'escalate after 30 min' },
            ],
          },
          {
            label: 'PERMISSION_DENIED',
            sub: 'a data sharing guide run',
            cells: [
              { state: 'own', text: 'permission' },
              { state: 'optional', text: 'high' },
              { state: 'optional', text: 'Page owner and lead', sub: 'no wait' },
            ],
          },
          {
            label: 'DELTA_METADATA_CHANGED',
            sub: 'an external run',
            cells: [
              { state: 'own', text: 'concurrency' },
              { state: 'none', text: 'low' },
              { state: 'own', text: 'Notify owner', sub: 'wildcard or tag row' },
            ],
          },
          {
            label: 'TypeError',
            sub: 'a code defect in a guide',
            cells: [
              { state: 'own', text: 'code_error' },
              { state: 'own', text: 'medium' },
              { state: 'own', text: 'Notify owner', sub: 'escalate after 120 min' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Standard handling' },
          { state: 'optional', label: 'Pages the escalation contact' },
          { state: 'none', label: 'Low severity' },
        ],
      },
    },
    {
      id: 'resiliency',
      heading: 'Resiliency settings',
      prose: 'Each setting answers a different failure. The job uses all of them, and the guide documents when to change them.',
      table: {
        columns: ['Setting', 'What it does here'],
        rows: [
          ['max_retries: 2, 10 s interval', 'write_with_retry fails on execution 1 and passes on execution 2.'],
          ['timeout_seconds: 600', 'A hung task stops after 10 minutes instead of holding the job.'],
          ['retry_on_timeout: true', 'A timed-out attempt counts as retryable.'],
          ['MERGE keyed by item id', 'Re-running the write leaves 25 rows. The retry never appends duplicates.'],
          ['No retries on fragile_step', 'The failure stays visible so a person or the repair job handles it.'],
          ['Repair, not rerun', 'repair_run reruns only failed tasks and keeps the successful ones.'],
        ],
      },
    },
    {
      id: 'steps',
      heading: 'Run the exercise',
      steps: [
        {
          title: 'Run the support job',
          body: 'It finishes as succeeded with one failed task. Open the run and note the fragile_step error.',
          code: 'databricks bundle run capability_guides_operational_support --target dev',
        },
        {
          title: 'Read the incident',
          body: 'triage wrote the class, severity, owner, and route for the failed task.',
          code: "SELECT run_id, task_key, error_class, severity, route, status\nFROM <catalog>.<schema>.support_incidents\nORDER BY detected_at DESC;",
        },
        {
          title: 'Repair the run',
          body: 'The repair job calls the repair endpoint, waits, and sets the incident to repaired with the repair ID.',
          code: 'databricks bundle run capability_guides_support_repair --target dev',
        },
      ],
    },
  ],
  related: [
    { slug: 'platform-administration', title: 'Workspace and account administration' },
    { slug: 'dataops', title: 'Pipeline operations' },
  ],
};
