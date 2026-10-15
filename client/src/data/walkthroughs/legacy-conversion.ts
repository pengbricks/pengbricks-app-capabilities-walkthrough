import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'legacy-conversion',
  area: 'General Guides',
  title: 'Legacy workload migration',
  intro:
    'A serverless job takes one nightly T-SQL sales batch through four tasks: assess, convert, reconcile, and record. It writes how much converts automatically, what needs hand remediation, whether the converted pipeline matches a Python reference, and how many hours each role should expect. Every number comes from the run. Lakebridge is the supported toolkit for production-scale migrations, and the guide shows the same loop on one workload.',
  shortVersion: [
    {
      title: 'Four tasks, one workload.',
      body: 'assess, convert, test, and record run in order against nightly_sales_batch.sql, a 13-step legacy script.',
    },
    {
      title: '69.2% converts automatically.',
      body: 'Of 13 steps, 5 are clean, 4 are warnings that need a check, and 4 are manual rewrites.',
    },
    {
      title: 'Results are checked, not assumed.',
      body: 'The converted pipeline runs on 120 generated rows and 26 of 26 reconcile checks pass against an independent Python reference.',
    },
    {
      title: 'Effort is computed per role.',
      body: 'Data engineer 23.25 h, analytics engineer 9.5 h, QA 13.5 h, and platform admin 3.4 h, from assumptions in the use-case spec.',
    },
    {
      title: 'Lakebridge covers the estate.',
      body: 'Analyzer, the transpilers, and Reconciler do the same three stages at scale. This bundle shows each step end to end.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'Assess, convert, reconcile, record',
      prose:
        'Each task reads the previous task output and writes tables to the shared guide schema. The convert task also reads hand-written replacements for steps it cannot convert, and the test task also reads generated sample data.',
      diagram: {
        type: 'flow',
        title: 'The four tasks and the tables they write',
        description:
          'The assess task splits and classifies the legacy SQL and writes assessment_classification. The convert task uses sqlglot, plus hand-written remediation SQL, and writes assessment_conversion. The test task runs the converted pipeline on dbldatagen sample data, compares the output with a Python reference, and writes assessment_test_results. The record task writes assessment_statements, assessment_summary, and assessment_effort.',
        nodes: [
          { id: 'legacy', label: 'Legacy workload', sub: 'nightly_sales_batch.sql', col: 0, row: 1 },
          { id: 'assess', label: 'assess', sub: 'split and classify', mono: true, col: 1, row: 1, kind: 'highlight' },
          { id: 'convert', label: 'convert', sub: 'T-SQL to Databricks SQL', mono: true, col: 2, row: 1, kind: 'highlight' },
          { id: 'test', label: 'test', sub: 'run and compare', mono: true, col: 3, row: 1, kind: 'highlight' },
          { id: 'record', label: 'record', sub: 'summary and effort', mono: true, col: 4, row: 1, kind: 'highlight' },
          { id: 'manual', label: 'Manual remediations', sub: 'manual_remediations.sql', col: 2, row: 0 },
          { id: 'data', label: 'Sample data', sub: 'dbldatagen, fixed seed', col: 3, row: 0 },
          { id: 'cls', label: 'Classification table', sub: 'assessment_classification', mono: true, col: 1, row: 2, kind: 'store' },
          { id: 'conv', label: 'assessment_conversion', mono: true, col: 2, row: 2, kind: 'store' },
          { id: 'res', label: 'assessment_test_results', mono: true, col: 3, row: 2, kind: 'store' },
          { id: 'sum', label: 'Summary tables', sub: 'statements, summary, hours', col: 4, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'legacy', to: 'assess' },
          { from: 'assess', to: 'convert' },
          { from: 'convert', to: 'test' },
          { from: 'test', to: 'record' },
          { from: 'manual', to: 'convert' },
          { from: 'data', to: 'test' },
          { from: 'assess', to: 'cls' },
          { from: 'convert', to: 'conv' },
          { from: 'test', to: 'res' },
          { from: 'record', to: 'sum' },
        ],
        legend: [
          { kind: 'highlight', label: 'Job task' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
        caption:
          'The job is capability_guides_legacy_conversion_assessment. The reconcile code runs as the task named test.',
      },
    },
    {
      id: 'status',
      heading: 'How each step gets a status',
      prose:
        'The assess task splits the script on its step markers and classifies each step by rule. The convert task tries sqlglot on every step and assigns one of three statuses. Procedural code is always flagged manual.',
      diagram: {
        type: 'flow',
        title: 'From legacy step to executed SQL',
        description:
          'Each legacy step goes to sqlglot. A construct check sorts the step into clean, warning, or manual. Clean and warning steps run as converted. Manual steps run the hand-written replacement. All three feed the executed SQL that the test task runs.',
        nodes: [
          { id: 'step', label: 'Legacy step', sub: '13 steps', col: 0, row: 1 },
          { id: 'glot', label: 'sqlglot', sub: 'T-SQL to Databricks SQL', mono: true, col: 1, row: 1, kind: 'highlight' },
          { id: 'gate', label: 'Construct check', col: 2, row: 1, kind: 'gate' },
          { id: 'clean', label: 'clean: 5 steps', sub: 'nothing to review', col: 3, row: 0 },
          { id: 'warn', label: 'warning: 4 steps', sub: 'temp table, IDENTITY, TOP', col: 3, row: 1 },
          { id: 'man', label: 'manual: 4 steps', sub: 'cursor, WHILE, CTE DML', col: 3, row: 2 },
          { id: 'run', label: 'Executed SQL', sub: 'in assessment_conversion', col: 4, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'step', to: 'glot' },
          { from: 'glot', to: 'gate' },
          { from: 'gate', to: 'clean' },
          { from: 'gate', to: 'warn' },
          { from: 'gate', to: 'man', label: 'hand-written' },
          { from: 'clean', to: 'run' },
          { from: 'warn', to: 'run' },
          { from: 'man', to: 'run' },
        ],
        legend: [
          { kind: 'highlight', label: 'Automatic conversion' },
          { kind: 'gate', label: 'Status decision' },
          { kind: 'store', label: 'Table' },
        ],
        caption:
          'Warnings also cover MERGE. Manual steps also cover TRY/CATCH. Their replacements are set-based rewrites kept in the remediation file.',
      },
      table: {
        caption: 'Reference run: 13 steps, 69.2% automated coverage, 4 remediations.',
        columns: ['Status', 'Meaning'],
        rows: [
          ['clean (5)', 'sqlglot converts the step and nothing needs review.'],
          ['warning (4)', 'Converted, but a semantic difference needs a check: temp table, IDENTITY, TOP, MERGE.'],
          ['manual (4)', 'No safe automatic conversion: cursor, WHILE loop, DML against a CTE, TRY/CATCH.'],
        ],
      },
    },
    {
      id: 'lakebridge',
      heading: 'Where this bundle maps to Lakebridge',
      prose:
        'Lakebridge is the Databricks Labs toolkit for migrating to Databricks, and it covers the same three stages at estate scale. assess.py stands in for Analyzer on one workload, convert.py with sqlglot stands in for a transpiler, and reconcile.py stands in for Reconciler. Use this bundle to explain the loop and its artifacts, and use Lakebridge for a real estate.',
      diagram: {
        type: 'matrix',
        title: 'Bundle steps by Lakebridge component',
        description:
          'The assess task stands in for Lakebridge Analyzer; Profiler has no bundle counterpart. The convert task is a stand-in for a transpiler, with BladeBridge, Morpheus, and Switch as the Lakebridge options. The reconcile task stands in for Reconciler. The record task has no Lakebridge counterpart.',
        corner: 'Bundle step ↓ · Lakebridge →',
        columns: ['Profiler', 'Analyzer', 'BladeBridge', 'Morpheus', 'Switch', 'Reconciler'],
        rows: [
          {
            label: 'assess',
            sub: 'assess.py',
            cells: [
              { state: 'none', text: 'no counterpart' },
              { state: 'own', text: 'stands in' },
              { state: 'none', text: 'none' },
              { state: 'none', text: 'none' },
              { state: 'none', text: 'none' },
              { state: 'none', text: 'none' },
            ],
          },
          {
            label: 'convert',
            sub: 'convert.py, sqlglot',
            cells: [
              { state: 'none', text: 'none' },
              { state: 'none', text: 'none' },
              { state: 'optional', text: 'wide dialects, some ETL' },
              { state: 'optional', text: 'next generation, dbt' },
              { state: 'optional', text: 'LLM-powered, notebooks' },
              { state: 'none', text: 'none' },
            ],
          },
          {
            label: 'test',
            sub: 'reconcile.py',
            cells: [
              { state: 'none', text: 'none' },
              { state: 'none', text: 'none' },
              { state: 'none', text: 'none' },
              { state: 'none', text: 'none' },
              { state: 'none', text: 'none' },
              { state: 'own', text: 'stands in' },
            ],
          },
          {
            label: 'record',
            sub: 'record.py',
            cells: [
              { state: 'none', text: 'no counterpart' },
              { state: 'none', text: 'none' },
              { state: 'none', text: 'none' },
              { state: 'none', text: 'none' },
              { state: 'none', text: 'none' },
              { state: 'none', text: 'none' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Bundle step stands in for this component' },
          { state: 'optional', label: 'Lakebridge transpiler option for this stage' },
          { state: 'none', label: 'No match' },
        ],
        caption:
          'Profiler connects to the source environment and reports workload size, complexity, and features used. Analyzer scans SQL and orchestration code to size the migration and flag problem constructs.',
      },
    },
    {
      id: 'reconcile',
      heading: 'What the reconcile task checks',
      prose:
        'The test task runs each step, then compares four output tables with an independent pure-Python reference computed from the same 120 generated rows. In the reference run, 26 of 26 checks passed.',
      points: [
        {
          strong: 'Execution.',
          text: 'Each step runs, using the converted SQL or the hand-written replacement.',
        },
        {
          strong: 'Counts and keys.',
          text: 'Row counts and key sets match for dim_customer, fact_daily_sales, region_summary, and dim_date.',
        },
        {
          strong: 'Values.',
          text: 'Column values and sums match the reference. The expected results are defined in use_cases/general.yml.',
        },
        {
          strong: 'Scope.',
          text: 'The checks run against sample data. They do not compare output from the legacy system.',
        },
      ],
    },
    {
      id: 'effort',
      heading: 'Effort by role',
      prose:
        'The record task applies hours = fixed + clean x a + warning x b + manual x c for each role. The per-status and fixed hours are assumptions in use_cases/general.yml, reviewed by each role. They are planning inputs for one workload, not a quote, and they exclude data migration, cutover, and performance tuning.',
      table: {
        caption: 'Reference run, from the assessment_effort table.',
        columns: ['Role', 'Hours and assumption'],
        rows: [
          ['Data engineer', '23.25 h. Reviews converted SQL, rewrites manual steps, wires the job. Fixed 2 h.'],
          ['Analytics engineer', '9.5 h. Validates business logic and outputs against legacy definitions. Fixed 1 h.'],
          ['QA', '13.5 h. Builds reconciliation checks and triages differences. Fixed 3 h.'],
          ['Platform admin', '3.4 h. Unity Catalog schema and grants, serverless job and permissions. Fixed 2 h.'],
        ],
      },
    },
    {
      id: 'limits',
      heading: 'Limits of a one-workload guide',
      points: [
        {
          strong: 'Scale.',
          text: 'One workload with 13 steps. A real estate needs Lakebridge Analyzer to inventory thousands of objects, and the transpilers and Reconciler to run at that scale.',
        },
        {
          strong: 'Parsing.',
          text: 'Step splitting relies on step markers, and classification is regex on the step text. Lakebridge parses the original source files directly.',
        },
        {
          strong: 'Reuse.',
          text: 'To use the bundle for another workload, copy use_cases/general.yml and change the workload paths, sample columns, expected block, and effort model. The code in src/ does not change while the legacy script keeps the step markers.',
        },
      ],
    },
  ],
  related: [
    { slug: 'dataops', title: 'Pipeline operations' },
    { slug: 'platform-administration', title: 'Workspace and account administration' },
  ],
};
