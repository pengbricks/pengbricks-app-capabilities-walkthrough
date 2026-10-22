import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'genie-zeroops',
  area: 'Governance/Monitoring',
  title: 'Genie ZeroOps: AI operations for data and AI workloads',
  intro:
    'Genie ZeroOps is an AI operations agent that Databricks announced on June 16, 2026. It watches jobs, pipelines, tables, and ML workloads, finds the root cause of a failure with Unity Catalog lineage, tests a fix in a sandbox, and asks a person before anything reaches production. As of October 22, 2026 the public sources describe it as a private preview, so plan around what Databricks has said in public and confirm the rest with your account team. The sections below show where ZeroOps would sit next to the alerting, CI, and on-call practice you already run.',
  businessValue: {
    summary:
      'ZeroOps aims to cut the time from a failed run to a reviewed fix. Platform and data engineering leads can plan a preview without weakening on-call or change control.',
    outcomes: [
      {
        title: 'Shorter time to a fix',
        body: 'The agent traces a failure through lineage and proposes a tested fix, so the on-call engineer starts from a root cause instead of a blank log.',
      },
      {
        title: 'Silent failures get a reviewer',
        body: 'Databricks says the agent also reads data quality metrics, so problems that never fail a run can still reach an inbox ranked by severity.',
      },
      {
        title: 'Human approval stays in place',
        body: 'Databricks states that nothing applies to production without approval, and that the tested change is the one applied. Your change-control rules still decide who signs off.',
      },
      {
        title: 'Access follows your credentials',
        body: 'Databricks says the agent can only reach data that your credentials allow, and the sandbox uses scoped permissions and network isolation.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'It is a private preview.',
      body: 'The June 16, 2026 announcement said it was entering private preview. No public docs page or release note covered it when this was written. Check the docs and your account team for availability, and do not plan on production use yet.',
    },
    {
      title: 'The loop is monitor, investigate, validate, approve.',
      body: 'The agent reads metrics, events, logs, and run history, traces dependencies with Unity Catalog lineage, tests the fix in a sandbox with shallow clones of your data, and waits for a person to approve.',
    },
    {
      title: 'Start with a few non-critical workloads.',
      body: 'Pick scheduled jobs and pipelines that fail in familiar ways and that have an owner, a Git repo, and a tested path to production. Add tables and ML workloads after the first fixes land cleanly.',
    },
    {
      title: 'Route fixes through your existing CI.',
      body: 'Ask whether ZeroOps can open pull requests. Where it cannot, treat its proposal as a ticket and have an engineer open the change. Either way the fix passes review and your tests before it deploys.',
    },
    {
      title: 'Keep alerts, data quality monitoring, and runbooks.',
      body: 'ZeroOps adds investigation and fix proposals. It does not replace a job notification that pages someone at 2 a.m., a SQL alert on a business metric, or a runbook.',
    },
    {
      title: 'Write down what is unknown.',
      body: 'Pricing, regions, limits, the exact permission model, and whether it opens PRs are not in public sources. The questions at the end go to your account team.',
    },
  ],
  prerequisites: [
    {
      slug: 'monitoring',
      title: 'Platform observability',
      why: 'ZeroOps reads the platform signals that observability sets up. Gaps in logs, events, and system tables become gaps in what it can see.',
    },
    {
      slug: 'github-cicd',
      title: 'GitHub-based CI/CD',
      why: 'A proposed fix is only as safe as the review and test path it enters.',
    },
  ],
  sections: [
    {
      id: 'what-it-is',
      heading: 'What Genie ZeroOps is',
      prose:
        'The announcement describes ZeroOps as an agent for operating data and AI workloads. In the private preview it covers jobs, pipelines, tables, and ML workloads, and Databricks lists apps and Lakebase databases as roadmap items. It reads metrics, events, logs, and run history from the platform observability layer, plus Unity Catalog lineage. It shows issues in an inbox-style view ranked by severity, each with a root cause and a proposed fix. For ML models, the announcement says it trains a candidate on corrected features and scores it against the same evaluation suite used for production. It also uses development context such as GitHub pull requests and Jira tickets when it proposes a fix.',
      points: [
        {
          strong: 'Covered today, per the announcement.',
          text: 'Jobs, pipelines, tables, and ML workloads. Apps and Lakebase databases are planned.',
        },
        {
          strong: 'Root causes named.',
          text: 'The announcement says it can trace a failure to a code bug, a schema change three tables upstream, or bad data introduced by another pipeline. It also lists late-arriving data, silent corruption, and model drift as failure types.',
        },
        {
          strong: 'Not stated in public sources.',
          text: 'Pricing, supported regions or clouds, quotas, the audit trail format, and whether fixes can be opened as pull requests automatically.',
        },
      ],
      links: [
        {
          label: 'Introducing Genie ZeroOps (Databricks blog, June 16, 2026)',
          url: 'https://www.databricks.com/blog/introducing-genie-zeroops',
        },
      ],
    },
    {
      id: 'the-loop',
      heading: 'The loop: monitor, investigate, validate, approve',
      prose:
        'The announcement describes four steps: detect an issue, find the root cause with lineage, generate a fix, and verify it. Approval sits between the verified fix and production.',
      diagram: {
        type: 'flow',
        title: 'From signal to approved fix',
        description:
          'Platform signals feed ZeroOps, which monitors them and opens an investigation. The investigation uses Unity Catalog lineage to find the root cause and proposes a fix. The fix is tested in a sandbox on shallow clones of the data. A person approves, and only then does the change reach production, ideally through a pull request and CI.',
        nodes: [
          {
            id: 'signals',
            label: 'Platform signals',
            sub: 'metrics, logs, events',
            col: 0,
            row: 0,
            kind: 'store',
            icon: 'event-stream',
            domain: 'data',
            detail:
              'Metrics, events, logs, run history, and data quality metrics from the platform observability layer. This is the input the agent watches.',
          },
          {
            id: 'monitor',
            label: 'Monitor',
            sub: 'jobs, tables, ML',
            col: 1,
            row: 0,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'ai',
            detail:
              'Watches the workloads in scope, including silent failures that show up in data quality metrics, and ranks issues by severity in an inbox.',
          },
          {
            id: 'investigate',
            label: 'Investigate',
            sub: 'root cause',
            col: 2,
            row: 0,
            icon: 'data-search',
            domain: 'ai',
            detail:
              'Traces the failure to its source, such as a code bug or an upstream schema change, and proposes a fix with the supporting evidence.',
          },
          {
            id: 'validate',
            label: 'Validate',
            sub: 'sandbox, shallow clones',
            col: 3,
            row: 0,
            icon: 'checklist',
            domain: 'ai',
            detail:
              'Runs the proposed fix in an isolated sandbox with scoped permissions and network isolation, against shallow clones of production data.',
          },
          {
            id: 'approve',
            label: 'Approve',
            sub: 'a person decides',
            col: 4,
            row: 0,
            kind: 'gate',
            domain: 'governance',
            detail:
              'Nothing applies to production without approval. Databricks says what was tested in the sandbox is exactly what gets applied.',
          },
          {
            id: 'lineage',
            label: 'Unity Catalog lineage',
            sub: 'dependency graph',
            col: 2,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'governance',
            detail:
              'The full dependency graph across tables, jobs, and pipelines. It lets the agent follow a failure upstream to the change that caused it.',
          },
          {
            id: 'context',
            label: 'Dev context',
            sub: 'GitHub PRs, Jira',
            col: 1,
            row: 1,
            icon: 'saas',
            domain: 'apps',
            detail:
              'Pull requests and tickets give the agent context on recent changes. Databricks lists them as inputs when it proposes a fix.',
          },
          {
            id: 'prod',
            label: 'Production',
            sub: 'via CI where possible',
            col: 4,
            row: 1,
            kind: 'surface',
            icon: 'workflow',
            domain: 'orchestration',
            detail:
              'The approved change deploys here. Whether ZeroOps opens a pull request for your CI to run is not in public sources, so confirm it before you design around it.',
          },
        ],
        edges: [
          { from: 'signals', to: 'monitor' },
          { from: 'monitor', to: 'investigate', label: 'issue' },
          { from: 'investigate', to: 'validate', label: 'fix' },
          { from: 'validate', to: 'approve', label: 'tested' },
          { from: 'lineage', to: 'investigate' },
          { from: 'context', to: 'investigate', dashed: true },
          { from: 'approve', to: 'prod', label: 'approved' },
        ],
        legend: [
          { kind: 'highlight', label: 'The agent' },
          { kind: 'gate', label: 'Human approval' },
          { kind: 'store', label: 'Data it reads' },
        ],
        caption:
          'Built from the June 16, 2026 announcement. The hand-off to CI is the part the public sources leave open.',
      },
    },
    {
      id: 'change-and-approval',
      heading: 'What it can and cannot change',
      prose:
        'The public statements are short, so the safest reading is narrow. The agent proposes and tests. A person approves. Anything beyond that is a question for your account team.',
      table: {
        caption: 'What the announcement says, and what it leaves open',
        columns: ['Topic', 'Public statement or gap'],
        rows: [
          ['Production changes', 'Require approval. The tested change is the change applied.'],
          ['Data access', 'Limited to what your credentials allow, under Unity Catalog governance.'],
          ['Validation data', 'Shallow clones in an isolated sandbox with scoped permissions and network isolation.'],
          ['Who can approve', 'Not stated. Decide this with your change-control owners.'],
          [
            'Pull request automation',
            'Not confirmed in the announcement. It names GitHub PRs and Jira as context only.',
          ],
          ['Audit trail', 'Not stated. Ask what is logged and where you can query it.'],
          ['Scope limits', 'Not stated. Ask whether you can exclude workloads, schemas, or environments.'],
        ],
      },
      points: [
        {
          strong: 'Treat approval as a control, not a click.',
          text: 'An approver needs the root cause, the diff, and the sandbox result in front of them. If the inbox does not show all three, push the fix through a pull request.',
        },
        {
          strong: 'Shallow clones read production data.',
          text: 'The Delta clone docs say a shallow clone copies metadata and points at the source files. Inference, not stated by Databricks: whatever identity runs the sandbox then needs read access to the tables it tests against. The public material does not say which identity that is. Check it, with your account team, against any table with row filters, column masks, or restricted access before you put that table in scope.',
        },
      ],
    },
    {
      id: 'fit-with-practice',
      heading: 'How it fits with what you already run',
      prose:
        'ZeroOps reads the same signals your current tooling produces, so it adds to that tooling. The matrix shows where each piece stays in charge.',
      diagram: {
        type: 'matrix',
        title: 'What stays, and what ZeroOps adds',
        description:
          'A comparison of on-call and alerting, data quality monitoring, CI/CD and bundles, and Unity Catalog lineage against the role each plays with and without ZeroOps.',
        corner: 'Practice',
        columns: ['Role today', 'With ZeroOps'],
        rows: [
          {
            label: 'Alerts and on-call',
            sub: 'SQL alerts, job notifications',
            cells: [
              {
                state: 'own',
                text: 'Detects and pages',
                detail: 'Job notifications and SQL alerts tell a person that something broke or crossed a threshold.',
              },
              {
                state: 'optional',
                text: 'Keep paging',
                sub: 'ZeroOps investigates',
                detail:
                  'Keep the pager path. ZeroOps adds a root cause and a proposed fix, but the public sources do not describe it as a paging system.',
              },
            ],
          },
          {
            label: 'Data quality monitoring',
            sub: 'Table health',
            cells: [
              {
                state: 'own',
                text: 'Measures table health',
                detail: 'Tracks freshness, completeness, and metric drift on the tables you enable it for.',
              },
              {
                state: 'optional',
                text: 'Feeds the agent',
                sub: 'Silent failures',
                detail:
                  'Databricks says the agent reads data quality metrics, so a drift finding can open an investigation.',
              },
            ],
          },
          {
            label: 'CI/CD and bundles',
            sub: 'Review and deploy',
            cells: [
              {
                state: 'own',
                text: 'Gates every change',
                detail: 'Pull request review, tests, and bundle deploys decide what reaches production.',
              },
              {
                state: 'own',
                text: 'Still gates fixes',
                detail:
                  'A proposed fix should enter the same review and deploy path. Confirm with Databricks how it hands the change to CI.',
              },
            ],
          },
          {
            label: 'Unity Catalog lineage',
            sub: 'Dependencies',
            cells: [
              {
                state: 'own',
                text: 'Shows dependencies',
                detail: 'Lineage shows which tables, jobs, and dashboards depend on a table.',
              },
              {
                state: 'optional',
                text: 'Read by the agent',
                sub: 'Root cause',
                detail: 'The agent uses the dependency graph to trace a failure back to its source.',
              },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Owns the job' },
          { state: 'optional', label: 'Complements it' },
        ],
      },
      links: [
        { label: 'Job notifications', url: 'https://docs.databricks.com/aws/en/jobs/notifications' },
        { label: 'SQL alerts', url: 'https://docs.databricks.com/aws/en/sql/user/alerts' },
        { label: 'Data quality monitoring', url: 'https://docs.databricks.com/aws/en/data-quality-monitoring/' },
        { label: 'Databricks Asset Bundles', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/' },
        {
          label: 'Unity Catalog data lineage',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage',
        },
        { label: 'Delta clone (shallow and deep)', url: 'https://docs.databricks.com/aws/en/delta/clone' },
      ],
    },
    {
      id: 'scope-first',
      heading: 'Which workloads to put in scope first',
      prose: 'A preview earns trust on workloads where a wrong proposal costs little and a right one saves real time.',
      options: {
        caption: 'First scope for a ZeroOps preview',
        rows: [
          {
            option: 'Non-critical scheduled jobs and pipelines',
            when: 'Teams that already have a Git repo, an owner, and repeatable failures such as schema drift or a bad parameter.',
            tradeoffs:
              'Low risk and easy to judge a proposal. The feedback covers fewer failure types, so it says little about tier-one pipelines.',
          },
          {
            option: 'Tier-one production pipelines',
            when: 'Only after several accepted fixes on lower tiers, and when the on-call cost of these pipelines is the reason you want the preview.',
            tradeoffs:
              'Largest payoff and largest blast radius. Approvals need the strictest review, and the sandbox reads production-sized data.',
          },
          {
            option: 'Tables with data quality monitoring',
            when: 'You already track freshness and drift and want to see whether the agent catches silent failures.',
            tradeoffs:
              'Tests the claim that sets ZeroOps apart from job alerts. Needs clean monitoring baselines, or you get noise.',
          },
          {
            option: 'ML workloads',
            when: 'Models with an evaluation suite and a retraining path you trust.',
            tradeoffs:
              'The announcement says candidates are scored against the production evaluation suite, so a weak suite weakens the check. Compute for candidate training is a cost to ask about.',
          },
        ],
        recommendation:
          'Start with non-critical scheduled jobs and pipelines that have an owner and a Git repo, and add one monitored table set. Move to tier-one workloads after you have a record of accepted and rejected fixes.',
      },
    },
    {
      id: 'propose-or-pr',
      heading: 'Auto-propose or require pull requests',
      prose:
        'The public sources do not say how a fix moves from the agent to your code. These options describe the policies you can choose between once you know what the preview supports.',
      options: {
        caption: 'How a fix reaches production',
        rows: [
          {
            option: 'Require a pull request for every fix',
            when: 'Code, pipeline definitions, and bundle config live in Git and already go through review and CI.',
            tradeoffs:
              'Keeps one audit trail and one test path. Slower than approving in an inbox, and it only works if the preview can produce a change you can commit.',
          },
          {
            option: 'Approve in the ZeroOps inbox, then apply',
            when: 'The fix is a one-time data repair or a setting change that has no source file.',
            tradeoffs: 'Fast. The change can bypass your CI, so record it in a ticket and keep a rollback step.',
          },
          {
            option: 'Propose only, engineer applies by hand',
            when: 'The preview cannot open pull requests, or your change policy forbids machine-authored changes.',
            tradeoffs: 'Safest and slowest. You still get the root cause, which is most of the time saved.',
          },
        ],
        recommendation:
          'Require a pull request for anything stored in Git, and use inbox approval only for data repairs with a ticket. If the preview cannot open pull requests, use propose-only and have the engineer commit the change.',
      },
    },
    {
      id: 'who-approves',
      heading: 'Who approves',
      options: {
        caption: 'Approval ownership',
        rows: [
          {
            option: 'The workload owner',
            when: 'The owning team knows the pipeline and carries its on-call.',
            tradeoffs:
              'Fastest and best informed. The same person who benefits from the fix also signs off, so use pull request review as a second check.',
          },
          {
            option: 'On-call engineer during an incident',
            when: 'A fix is time-sensitive and a runbook already gives on-call authority to change the workload.',
            tradeoffs:
              'Quick during an incident. Tired reviewers approve more, so require the sandbox result in the ticket.',
          },
          {
            option: 'Platform or change-advisory group',
            when: 'Regulated workloads or shared tables that feed many teams.',
            tradeoffs: 'Strongest control and slowest turnaround. Use it for tier-one and shared assets only.',
          },
        ],
        recommendation:
          'Let the workload owner approve by default, add a second reviewer through pull request rules for shared or regulated tables, and send tier-one changes to the change group. Confirm whether the preview supports approval roles at all.',
      },
    },
    {
      id: 'zeroops-vs-existing',
      heading: 'ZeroOps or existing monitoring',
      prose:
        'Each existing tool answers a different question. Use the table to see where it is enough and where ZeroOps would add something.',
      options: {
        caption: 'Where existing monitoring is enough',
        rows: [
          {
            option: 'Data quality monitoring',
            when: 'You need freshness, completeness, and drift checks on named tables, with results you can query.',
            tradeoffs:
              'Enough when the question is "is this table healthy?". It detects and does not trace the cause or propose a fix.',
          },
          {
            option: 'Lakeflow job alerts and notifications',
            when: 'You need someone paged when a run fails, runs long, or misses a schedule.',
            tradeoffs:
              'Enough for detection and escalation. A human still reads logs and decides the fix. Retries and repair runs cover transient failures.',
          },
          {
            option: 'System tables',
            when: 'You want your own queries and dashboards over billing, job runs, lineage, and audit data.',
            tradeoffs:
              'Full control and no preview risk. You build and maintain the analysis, and nothing proposes a fix.',
          },
          {
            option: 'Genie ZeroOps',
            when: 'Root-cause time is the bottleneck, failures cross several tables or jobs, or silent data problems slip past alerts.',
            tradeoffs:
              'Adds investigation and tested fix proposals. It is a private preview with unpublished pricing and limits, so it supplements the rest and replaces none of it.',
          },
        ],
        recommendation:
          'Keep job alerts, data quality monitoring, and system-table dashboards as the baseline. Add ZeroOps where your incident review shows that diagnosis, not detection, takes the time.',
      },
    },
    {
      id: 'rollout',
      heading: 'Rollout plan for a preview',
      steps: [
        {
          title: 'Ask for access and get the facts',
          body: 'Request the preview through your account team and ask the questions below. Confirm the preview stage and your cloud and region before you plan dates.',
        },
        {
          title: 'Pick a pilot scope',
          body: 'Choose five to ten non-critical jobs or pipelines with owners, Git repos, and known failure patterns. Record last quarter’s incidents for them as a baseline.',
        },
        {
          title: 'Check permissions and data access',
          body: 'List the tables the agent would clone and the credentials it would use. Remove restricted tables from the pilot until you know how row filters and masks apply in the sandbox.',
        },
        {
          title: 'Run in propose-only mode',
          body: 'For the first weeks, have engineers apply every fix by hand. Score each proposal as correct, partly correct, or wrong, and note the time saved.',
        },
        {
          title: 'Move accepted fix types into pull requests',
          body: 'For fix types that score well, route the change through your normal pull request and CI path with the workload owner as reviewer.',
        },
        {
          title: 'Review and widen',
          body: 'Compare incident time against the baseline. Widen scope only if proposals were mostly correct and no change bypassed review.',
        },
      ],
    },
    {
      id: 'questions-for-account-team',
      heading: 'Questions to ask your account team',
      points: [
        {
          strong: 'Availability.',
          text: 'What is the current release stage, which clouds and regions are covered, and what is the timeline to a public preview or general availability?',
        },
        {
          strong: 'Cost.',
          text: 'How is it billed, including sandbox compute and ML candidate training, and can you cap spend?',
        },
        {
          strong: 'Permissions.',
          text: 'Which identity runs the agent and the sandbox, and how do row filters, column masks, and restricted tables behave in a shallow clone?',
        },
        {
          strong: 'Change path.',
          text: 'Can it open pull requests against your Git provider and trigger your CI, or does it apply changes itself after approval?',
        },
        {
          strong: 'Approval.',
          text: 'Can you define who approves by workload, and is every approval logged somewhere you can query?',
        },
        {
          strong: 'Scope and limits.',
          text: 'Can you include or exclude workloads, schemas, and environments, and what are the limits on workloads and investigations?',
        },
        {
          strong: 'Data handling.',
          text: 'What does the agent store about your logs and data, where, and for how long?',
        },
        { strong: 'Support.', text: 'What is the support path and the feedback channel during the preview?' },
      ],
      links: [
        {
          label: 'Introducing Genie ZeroOps (Databricks blog)',
          url: 'https://www.databricks.com/blog/introducing-genie-zeroops',
          note: 'Check the Databricks documentation and release notes for the latest status.',
        },
      ],
    },
    {
      id: 'public-vs-unknown',
      heading: 'What is public and what is not',
      table: {
        caption: 'Checked October 22, 2026',
        columns: ['Item', 'Status'],
        rows: [
          ['Announcement', 'Published June 16, 2026 on the Databricks blog.'],
          [
            'Release stage',
            'The announcement says it was entering private preview in the coming weeks. No later public source changed that.',
          ],
          ['Documentation page', 'No dedicated docs.databricks.com page found.'],
          ['Release notes', 'No ZeroOps entry found in the Databricks release notes collection.'],
          [
            'Covered assets',
            'Jobs, pipelines, tables, and ML workloads. Apps and Lakebase databases are on the roadmap.',
          ],
          ['Pricing, regions, limits, audit, PR automation', 'Not published.'],
        ],
      },
    },
  ],
  related: [
    { slug: 'operational-support', title: 'Support and recovery' },
    { slug: 'monitoring', title: 'Platform observability' },
    { slug: 'data-observability', title: 'Lineage and drift detection' },
    { slug: 'data-validation-framework', title: 'Data validation framework' },
    { slug: 'github-cicd', title: 'GitHub-based CI/CD' },
    { slug: 'orchestration-patterns', title: 'Orchestration patterns' },
  ],
};
