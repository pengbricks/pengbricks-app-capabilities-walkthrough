import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'operational-support',
  area: 'Governance/Monitoring',
  title: 'Support and recovery',
  intro:
    'Support starts before an incident: tasks that retry safely, runs that clean up after a failure, streams that restart on their own, and a recovery plan for a lost region. After that come alerts that reach the right person, a severity scale people agree on, and runbooks. This page covers the current Databricks features for each layer and how to combine them.',
  businessValue: {
    summary:
      'Support teams and IT owners need pipelines that recover on their own and a clear plan when they cannot. This guide covers retries, alerts, severity levels, runbooks, and disaster recovery for production data work.',
    outcomes: [
      {
        title: 'Fewer overnight pages',
        body:
          'Task retries absorb transient errors, and streaming workloads restart automatically. People are paged only for failures that need a human.',
      },
      {
        title: 'Shorter recovery after a failure',
        body:
          'A repair run reruns only the failed tasks and their dependents. Work that already succeeded is kept, so the fix does not repeat hours of processing.',
      },
      {
        title: 'Agreed severity and ownership',
        body:
          'A short severity scale decides who is paged and how fast. Each alert links to a runbook that names the owner and the next step.',
      },
      {
        title: 'Recovery targets set per tier',
        body:
          'RPO and RTO are chosen for each workload tier, and managed disaster recovery covers a lost region on AWS and Azure. Delta time travel covers corruption, which replication copies to both regions.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Make tasks safe to run twice.',
      body: 'Retries and repair runs rerun work. Idempotent writes, such as a keyed MERGE, make that harmless.',
    },
    {
      title: 'Retry first, then repair.',
      body: 'Task retries absorb transient errors. A repair run reruns only the failed tasks and their dependents after you fix the cause, and keeps the work that already succeeded.',
    },
    {
      title: 'Use run_if for cleanup and notification.',
      body: 'A task with run_if ALL_DONE runs whether upstream tasks pass or fail, so it can release resources and report.',
    },
    {
      title: 'Choose managed disaster recovery for cross-region needs.',
      body: 'Set RPO and RTO per workload tier. Databricks recommends managed disaster recovery on AWS and Azure; keep Delta time travel or backups for corruption, which replication copies to both regions.',
    },
    {
      title: 'Define severities, owners, and runbooks.',
      body: 'A short severity scale decides who is paged and how fast. Each alert links to a runbook that names the owner and the next step.',
    },
  ],
  sections: [
    {
      id: 'resiliency',
      heading: 'Retries, run_if, and repair runs',
      prose:
        'Lakeflow Jobs gives you three tools that work together. Retries handle failures that clear on their own. run_if decides which tasks run after something fails. Repair finishes a run once the cause is fixed.',
      diagram: {
        type: 'flow',
        title: 'What happens when a task fails',
        description:
          'A task fails and is retried according to its retry policy. If retries are exhausted, downstream tasks with the default ALL_SUCCESS condition are skipped, while a cleanup or notify task with run_if ALL_DONE still runs. An on-call engineer fixes the cause and starts a repair run, which reruns only the failed and skipped tasks.',
        nodes: [
          { id: 'task', label: 'Task fails', sub: 'transient or real', col: 0, row: 0 },
          { id: 'retry', label: 'Retry policy', sub: 'max_retries, interval', col: 1, row: 0, kind: 'highlight' },
          { id: 'down', label: 'Downstream tasks', sub: 'skipped on ALL_SUCCESS', col: 2, row: 0 },
          { id: 'clean', label: 'Cleanup or notify', sub: 'run_if ALL_DONE', col: 2, row: 1, kind: 'surface' },
          { id: 'fix', label: 'Fix the cause', sub: 'data, config, access', col: 1, row: 1, kind: 'gate' },
          { id: 'repair', label: 'Repair run', sub: 'failed tasks only', col: 0, row: 1, kind: 'highlight' },
        ],
        edges: [
          { from: 'task', to: 'retry' },
          { from: 'retry', to: 'down', label: 'exhausted' },
          { from: 'retry', to: 'clean', dashed: true },
          { from: 'clean', to: 'fix' },
          { from: 'fix', to: 'repair' },
        ],
        legend: [
          { kind: 'highlight', label: 'Job setting' },
          { kind: 'surface', label: 'Always runs' },
          { kind: 'gate', label: 'Human step' },
        ],
      },
      table: {
        columns: ['Setting', 'Use it when'],
        rows: [
          [
            'max_retries with min_retry_interval_millis',
            'The failure is likely transient, such as an upstream outage or a throttled API.',
          ],
          [
            'timeout_seconds',
            'A task can hang. Add retry_on_timeout only if a second attempt is safe. A timeout applies to each retry.',
          ],
          [
            'Idempotent writes (keyed MERGE, or INSERT ... WHERE NOT EXISTS)',
            'Always, for tasks that retry or can be repaired. Delta commits are atomic, so a failed write leaves the table unchanged.',
          ],
          [
            'run_if ALL_DONE, or AT_LEAST_ONE_FAILED',
            'A cleanup, triage, or notification task must run even when upstream tasks fail.',
          ],
          [
            'Repair run',
            'The cause is fixed and you want to rerun only failed and skipped tasks, keeping successful results.',
          ],
          ['max_concurrent_runs = 1', 'Two overlapping runs would write the same table.'],
        ],
      },
      links: [
        { label: 'Configure task dependencies and run_if', url: 'https://docs.databricks.com/aws/en/jobs/run-if' },
        {
          label: 'Troubleshoot and repair job failures',
          url: 'https://docs.databricks.com/aws/en/jobs/repair-job-failures',
        },
        {
          label: 'Configure and edit tasks (retries, timeouts)',
          url: 'https://docs.databricks.com/aws/en/jobs/configure-task',
        },
      ],
    },
    {
      id: 'streaming',
      heading: 'Restart streaming workloads automatically',
      prose:
        'Do not rely on someone noticing a stopped stream. Let the platform restart it and let the checkpoint decide where to resume.',
      points: [
        {
          strong: 'Use continuous jobs.',
          text: 'A continuous trigger keeps exactly one run active and restarts it after it ends or fails. Failed tasks retry with exponential backoff, and Task retry mode defaults to On failure. This replaces the older advice to set unlimited retries and one concurrent run.',
        },
        {
          strong: 'Keep the checkpoint.',
          text: 'Structured Streaming resumes from its checkpoint, so a restart does not reprocess data. Give each query its own checkpoint location and do not delete it to fix an error.',
        },
        {
          strong: 'Prefer pipelines for managed streaming.',
          text: 'Lakeflow Spark Declarative Pipelines handle retries and restarts of flows for you. Run them in continuous mode when you need low latency.',
        },
        {
          strong: 'Alert on backlog.',
          text: 'Set a streaming backlog threshold on the task. Databricks notifies when the 10-minute average backlog passes the threshold, then repeats every 30 minutes while it stays high.',
        },
      ],
      options: {
        caption: 'How to run a streaming workload',
        rows: [
          {
            option: 'Continuous job with a Structured Streaming task',
            when: 'You own custom streaming code and need low latency.',
            tradeoffs:
              'Compute runs all the time, so cost is steady. Jobs restarts a failed run and retries tasks with backoff. You manage the checkpoint, schema changes, and the code yourself.',
          },
          {
            option: 'Pipeline in continuous mode',
            when: 'The logic fits Lakeflow Spark Declarative Pipelines and you need low latency.',
            tradeoffs:
              'Compute also runs all the time. The pipeline handles retries and flow restarts, so you write and operate less code. You accept the pipeline programming model.',
          },
          {
            option: 'Pipeline or job on a triggered schedule',
            when: 'Minutes to hours of delay is acceptable.',
            tradeoffs:
              'Lowest cost, because compute stops between runs. Freshness is limited by the schedule, and each run pays a start-up and catch-up cost. Failures show up as a failed run, which suits run-level alerts.',
          },
        ],
        recommendation:
          'Default to a triggered run unless the business needs data fresher than a schedule can give. When it does, use a continuous pipeline if the logic fits, and a continuous job for custom Structured Streaming code.',
      },
      links: [
        { label: 'Run jobs continuously', url: 'https://docs.databricks.com/aws/en/jobs/continuous' },
        {
          label: 'Structured Streaming checkpoints',
          url: 'https://docs.databricks.com/aws/en/structured-streaming/checkpoints',
        },
        {
          label: 'Triggers in Structured Streaming',
          url: 'https://docs.databricks.com/aws/en/structured-streaming/triggers',
        },
        { label: 'Pipeline updates and modes', url: 'https://docs.databricks.com/aws/en/ldp/updates' },
      ],
    },
    {
      id: 'notifications',
      heading: 'Notifications, health rules, and destinations',
      prose: 'Notify on the events that need a decision, and send them where people already respond.',
      points: [
        {
          strong: 'Events.',
          text: 'Jobs and tasks can notify on start, success, failure, a duration threshold, and a streaming backlog threshold. Continuous jobs can also notify on maintenance windows.',
        },
        {
          strong: 'Health rules.',
          text: 'Set an expected duration, or a streaming backlog threshold, on the job or task. Crossing it triggers the Duration warning or Streaming backlog notification.',
        },
        {
          strong: 'Destinations.',
          text: 'Email, or system destinations an admin sets up once: Slack, Microsoft Teams, PagerDuty, and webhooks. Each job or task can use up to three system destinations per event type. Page from PagerDuty or a webhook for high severity, and send the rest to chat.',
        },
        {
          strong: 'Task or job level.',
          text: 'Job-level failure notifications are not sent for failed tasks that are retried. Add task-level notifications if you want to know about each failed attempt.',
        },
        {
          strong: 'Succeeded with failures.',
          text: 'A run that ends in the Succeeded with failures state counts as successful. Select the Success event if you want to be notified about it.',
        },
      ],
      links: [{ label: 'Add notifications on a job', url: 'https://docs.databricks.com/aws/en/jobs/notifications' }],
    },
    {
      id: 'severity',
      heading: 'A severity taxonomy',
      prose:
        'Four levels are enough. Define them by business impact, not by error text, and attach a first response and an escalation to each. The examples are a starting point; set the time targets from your SLAs.',
      diagram: {
        type: 'matrix',
        title: 'Severity, first response, and escalation',
        description:
          'Sev 1 is an outage or data loss affecting production consumers and pages the on-call engineer immediately. Sev 2 is a degraded or late critical pipeline and notifies on-call within the hour. Sev 3 is a non-critical failure with a workaround and goes to the owning team queue. Sev 4 is a warning or a request and is handled in normal planning.',
        corner: 'Severity ↓ · Response →',
        columns: ['Meaning', 'First response', 'Escalate to'],
        rows: [
          {
            label: 'Sev 1',
            sub: 'outage or data loss',
            cells: [
              { state: 'own', text: 'Production blocked', sub: 'or wrong data published' },
              { state: 'own', text: 'Page on-call now' },
              { state: 'own', text: 'Platform lead, then Databricks support' },
            ],
          },
          {
            label: 'Sev 2',
            sub: 'degraded or late',
            cells: [
              { state: 'own', text: 'Critical job missed its SLA' },
              { state: 'own', text: 'Notify on-call' },
              { state: 'optional', text: 'Platform lead if not fixed in 2 hours' },
            ],
          },
          {
            label: 'Sev 3',
            sub: 'workaround exists',
            cells: [
              { state: 'optional', text: 'Non-critical task failed' },
              { state: 'optional', text: 'Ticket to owning team' },
              { state: 'none', text: 'Only if it repeats' },
            ],
          },
          {
            label: 'Sev 4',
            sub: 'warning or request',
            cells: [
              { state: 'none', text: 'Slow run, cost warning, question' },
              { state: 'none', text: 'Backlog item' },
              { state: 'none', text: 'None' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Immediate' },
          { state: 'optional', label: 'Same day' },
          { state: 'none', label: 'Planned' },
        ],
      },
      points: [
        {
          strong: 'Tag jobs with severity and owner.',
          text: 'Put the tier and the owning team in job tags. Alert routing and dashboards read the same tags.',
        },
        {
          strong: 'Classify by impact first.',
          text: 'An error class (permission, quota, data quality, transient) helps diagnosis. The severity comes from what the failure blocks.',
        },
      ],
    },
    {
      id: 'dr',
      heading: 'Disaster recovery: RPO, RTO, and what to replicate',
      prose:
        'Start with the objectives. RPO is how much change you can afford to lose, and RTO is how long you can be down. Different workloads get different tiers, and the tier decides the design.',
      table: {
        columns: ['Layer', 'Approach'],
        rows: [
          [
            'Within a region',
            'Databricks spreads the control plane across zones and recovers from a zone failure in about 15 minutes. You choose zone-redundant storage and pools that span zones.',
          ],
          [
            'Across regions',
            'Use managed disaster recovery on AWS and Azure. It replicates Unity Catalog metadata, managed table data, and workspace assets continuously, gives a stable URL, and fails over from the account console. Replication state is in system.replication.states.',
          ],
          [
            'Resources managed DR does not cover, or active-active',
            'Replicate yourself. Delta deep clone copies tables to a second region and can run incrementally. Redeploy jobs, pipelines, and policies from code in Git with bundles or Terraform.',
          ],
          [
            'Corruption and bad deletes',
            'Replication copies mistakes to both regions. Use Delta time travel and RESTORE for recent changes, and keep object-store versioning or backups for external storage.',
          ],
          [
            'Unity Catalog and workspace configuration',
            'Keep grants, tags, catalogs, and workspace settings in Terraform or bundles so you can rebuild them, and export what is not code.',
          ],
          ['Cross-cloud', 'Not covered by managed DR. Plan it as a separate project.'],
        ],
      },
      points: [
        {
          strong: 'Test it.',
          text: 'Run a failover exercise on a schedule and record the measured RTO. An untested plan is a guess.',
        },
        {
          strong: 'Mind the egress.',
          text: 'Copying tables across regions or clouds incurs cloud data-transfer charges. Include them in the tier decision.',
        },
        {
          strong: 'Cover the dependencies.',
          text: 'Sources, ingestion tools, BI tools, and schedulers also have to fail over, or the Databricks side recovers to nothing.',
        },
      ],
      links: [
        { label: 'Disaster recovery', url: 'https://docs.databricks.com/aws/en/admin/disaster-recovery' },
        { label: 'Clone a table', url: 'https://docs.databricks.com/aws/en/delta/clone' },
        { label: 'Work with table history', url: 'https://docs.databricks.com/aws/en/delta/history' },
        {
          label: 'Best practices for reliability',
          url: 'https://docs.databricks.com/aws/en/lakehouse-architecture/reliability/best-practices',
        },
      ],
    },
    {
      id: 'runbooks',
      heading: 'Runbooks, on-call, and the escalation path',
      prose:
        'A page without a runbook sends the on-call engineer to search. Write the runbook when you create the alert.',
      steps: [
        {
          title: 'Own every alert',
          body: "Each alert names one owning team and one on-call rotation. Store the mapping in job tags or a small table, not in people's heads.",
        },
        {
          title: 'Write a short runbook per alert class',
          body: 'State the symptom, the first check (run page, task error, system.lakeflow tables), the usual causes, the fix, and when to repair or rerun. Link it from the notification.',
        },
        {
          title: 'Define the escalation path',
          body: 'Owning team on-call, then the platform team, then Databricks support. Escalate on time or severity, whichever comes first.',
        },
        {
          title: 'Open a Databricks support case with evidence',
          body: 'Include the workspace ID, job and run IDs, the error text, the time window, and what you already tried. Check status.databricks.com first for a known incident.',
        },
        {
          title: 'Close the loop',
          body: 'After each Sev 1 or Sev 2, write down the cause and the change that prevents it: a retry setting, a health rule, a quota, or a runbook edit.',
        },
      ],
      links: [{ label: 'Databricks status', url: 'https://status.databricks.com' }],
    },
  ],
  related: [
    { slug: 'monitoring', title: 'Platform observability' },
    { slug: 'orchestration-patterns', title: 'Orchestration patterns' },
    { slug: 'platform-administration', title: 'Workspace and account administration' },
  ],
};
