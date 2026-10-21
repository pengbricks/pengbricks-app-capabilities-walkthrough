import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'legacy-conversion',
  area: 'General Guides',
  title: 'Legacy workload migration',
  intro:
    'Lakebridge is the Databricks Labs toolkit for migrating SQL workloads and data to Databricks. It covers the whole path: assess the estate, convert code, and reconcile the results against the legacy system. This page teaches that loop, a six-phase plan to run it, and the patterns to land on after conversion.',
  businessValue: {
    summary:
      'Lakebridge assesses, converts, and reconciles SQL workloads moving off a legacy warehouse. Program owners get a sized plan up front and evidence that migrated results match.',
    outcomes: [
      {
        title: 'Size the work before committing',
        body: 'The Profiler surveys the source environment and the Analyzer scans SQL and orchestration code. Together they size the migration and flag problem constructs, so budget rests on a count.',
      },
      {
        title: 'People spend time where it counts',
        body: 'Transpilers convert the bulk of ordinary SQL. Staff review what is flagged, mainly cursors, dynamic SQL, and vendor features with no direct equivalent.',
      },
      {
        title: 'Evidence the results match',
        body: 'Lakebridge Reconcile compares schema, rows, and values between the legacy system and Databricks, so sign-off rests on a comparison.',
      },
      {
        title: 'Cutover with a way back',
        body: 'Parallel runs, and keeping the legacy system until reconciliation passes for a full business cycle, limit the risk of switching over.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Assess before you convert.',
      body: 'The Lakebridge Profiler surveys the source environment, and the Analyzer scans SQL and orchestration code. They size the migration, estimate effort, and flag problem constructs so you can prioritize.',
    },
    {
      title: 'Automate the conversion.',
      body: 'Lakebridge transpilers (BladeBridge, Morpheus, and Switch) and the agentic code converter turn legacy SQL into Databricks SQL or notebooks. Plan for human review of what they flag.',
    },
    {
      title: 'Reconcile against the legacy system’s own output.',
      body: 'Lakebridge Reconcile compares schema, rows, and values between the source and Databricks. A test against a reference you wrote yourself proves your reference, not the migration.',
    },
    {
      title: 'Migrate in phases.',
      body: 'Inventory, prioritize, pilot, run in parallel, cut over, then decommission. Keep the legacy system until reconciliation passes for a full business cycle.',
    },
    {
      title: 'Land on set-based SQL and Lakeflow.',
      body: 'Replace cursors and loops with set-based SQL, run pipelines as Lakeflow Spark Declarative Pipelines or Lakeflow Jobs, and govern the output in Unity Catalog.',
    },
  ],
  sections: [
    {
      id: 'lakebridge',
      heading: 'Lakebridge: assess, convert, reconcile',
      prose:
        'Lakebridge has a component for each stage. Use them in order, and feed what each learns into the next.',
      diagram: {
        type: 'matrix',
        title: 'Migration stage by Lakebridge component',
        description:
          'Assessment uses the Profiler, which connects to the source environment and reports workload size, complexity, and features used, and the Analyzer, which scans SQL and orchestration code and flags problem constructs. Conversion uses one of three transpilers: BladeBridge, which handles a wide range of dialects and some ETL; Morpheus, a next-generation transpiler for fewer dialects with experimental dbt support; or Switch, an LLM-powered transpiler that produces Databricks notebooks. Reconciliation uses Reconcile, which compares source and target at the schema, row, and data level.',
        corner: 'Stage ↓ · Component →',
        columns: ['Component', 'What it does'],
        rows: [
          {
            label: 'Assess: workload',
            cells: [
              { state: 'own', text: 'Profiler' },
              { state: 'own', text: 'Size, complexity, and features used in the source environment' },
            ],
          },
          {
            label: 'Assess: code',
            cells: [
              { state: 'own', text: 'Analyzer' },
              { state: 'own', text: 'Scans SQL and orchestration; flags problem constructs and effort' },
            ],
          },
          {
            label: 'Convert',
            sub: 'wide dialect coverage',
            cells: [
              { state: 'own', text: 'BladeBridge' },
              { state: 'own', text: 'Mature; many dialects and some ETL or orchestration' },
            ],
          },
          {
            label: 'Convert',
            sub: 'next generation',
            cells: [
              { state: 'optional', text: 'Morpheus' },
              { state: 'optional', text: 'Fewer dialects; experimental dbt support' },
            ],
          },
          {
            label: 'Convert',
            sub: 'LLM-powered',
            cells: [
              { state: 'optional', text: 'Switch' },
              { state: 'optional', text: 'Uses LLMs to produce Databricks notebooks' },
            ],
          },
          {
            label: 'Reconcile',
            cells: [
              { state: 'own', text: 'Reconcile' },
              { state: 'own', text: 'Compares source and Databricks at schema, row, and data level' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Core component' },
          { state: 'optional', label: 'Option with narrower scope' },
        ],
        caption:
          'Component names follow the Lakebridge documentation. Check it for the dialects each transpiler and Reconcile support.',
      },
      examples: [
        {
          label: 'Run Lakebridge on a real source folder',
          language: 'sh',
          code: 'databricks labs install lakebridge\ndatabricks labs lakebridge install-transpile\ndatabricks labs lakebridge transpile \\\n  --transpiler-config-path <path> --input-source <path> \\\n  --source-dialect <dialect> --output-folder <path> \\\n  --catalog-name <catalog> --schema-name <schema>',
          notes: ['Transpilers handle a whole folder of source files, not one script.'],
        },
      ],
      links: [
        {
          label: 'Lakebridge documentation',
          url: 'https://databrickslabs.github.io/lakebridge/docs/overview/',
          note: 'Assessment, transpile, and reconcile guides.',
        },
      ],
    },
    {
      id: 'phases',
      heading: 'A phase model for the migration',
      prose:
        'Run the migration as six phases. Each has an exit test, so you do not carry unknowns into the next one.',
      diagram: {
        type: 'flow',
        title: 'From inventory to decommission',
        description:
          'Inventory the workloads, prioritize by business value and effort, pilot one workload end to end, run old and new in parallel with reconciliation, cut over consumers, then decommission the legacy system.',
        nodes: [
          { id: 'inv', label: 'Inventory', sub: 'Profiler and Analyzer', col: 0, row: 0 },
          { id: 'pri', label: 'Prioritize', sub: 'value, usage, effort', col: 1, row: 0 },
          { id: 'pilot', label: 'Pilot', sub: 'one workload, end to end', col: 2, row: 0, kind: 'highlight' },
          { id: 'par', label: 'Parallel run', sub: 'reconcile every cycle', col: 0, row: 1, kind: 'gate' },
          { id: 'cut', label: 'Cutover', sub: 'repoint consumers', col: 1, row: 1 },
          { id: 'dec', label: 'Decommission', sub: 'retire the legacy system', col: 2, row: 1 },
        ],
        edges: [
          { from: 'inv', to: 'pri' },
          { from: 'pri', to: 'pilot' },
          { from: 'pilot', to: 'par' },
          { from: 'par', to: 'cut', label: 'reconciled' },
          { from: 'cut', to: 'dec' },
        ],
        legend: [
          { kind: 'highlight', label: 'Proves the pattern' },
          { kind: 'gate', label: 'Exit gate' },
        ],
      },
      table: {
        columns: ['Phase', 'Exit test'],
        rows: [
          ['Inventory', 'Every workload, job, and consumer is listed with owner, size, and complexity'],
          ['Prioritize', 'Waves are ordered by business value, usage, dependencies, and conversion effort; retire unused workloads instead of migrating them'],
          ['Pilot', 'One representative workload runs on Databricks, reconciles, and teaches the team the pattern and the real effort per role'],
          ['Parallel run', 'Legacy and Databricks outputs reconcile over a full business cycle, including month-end if it matters'],
          ['Cutover', 'Consumers read from Databricks; rollback is rehearsed; data and code freeze on the legacy side'],
          ['Decommission', 'Legacy access is removed after the agreed retention period, and archives are in place'],
        ],
      },
    },
    {
      id: 'convert',
      heading: 'Convert: automate, then review what is flagged',
      prose:
        'Automatic conversion handles the bulk of ordinary SQL. The remainder is procedural code that has no direct equivalent: cursors, loops, dynamic SQL, and vendor features. Sort converted statements into clean, needs-review, and manual, and spend human time on the last two.',
      points: [
        {
          strong: 'Pick the converter by source and target.',
          text: 'Lakebridge transpilers run from the command line on source folders. The agentic code converter in Genie Code (generally available for SQL conversion) converts T-SQL, Snowflake, Redshift, Oracle, BigQuery, and Teradata in a migration project and validates its output. Its Notebooks target is Beta.',
        },
        {
          strong: 'Expect warnings and manual rewrites.',
          text: 'Temp tables, identity columns, TOP, MERGE, cursors, WHILE loops, DML against CTEs, and TRY/CATCH need a check or a rewrite. Track each as a work item with an owner.',
        },
        {
          strong: 'Keep conversion repeatable.',
          text: 'Treat the converter output as source: commit it, review it, and rerun the converter when the source changes during the project.',
        },
        {
          strong: 'Use a small script to learn the loop.',
          text: 'The reference bundle runs the same assess, convert, reconcile loop on one T-SQL batch with the open-source sqlglot library. Its README has the numbers and the code; it is a teaching stand-in, not a replacement for Lakebridge.',
        },
      ],
      options: {
        caption: 'Which converter to run',
        rows: [
          {
            option: 'Lakebridge BladeBridge',
            when: 'You have many dialects, large folders of scripts, or ETL and orchestration code to convert in bulk.',
            tradeoffs:
              'Described in the Lakebridge docs as mature, with wide dialect coverage, and run from the command line on whole source folders. Output still needs review for the constructs it flags, and redesign for the platform stays your job.',
          },
          {
            option: 'Lakebridge Morpheus',
            when: 'Your source dialect is one that Morpheus supports and you want to try the next-generation transpiler, or you need its experimental dbt support.',
            tradeoffs:
              'Newer, with fewer dialects, and dbt support is experimental. Check the Lakebridge docs for the dialects it covers before you plan around it.',
          },
          {
            option: 'Lakebridge Switch',
            when: 'The source has no transpiler support or the logic is too irregular for rules, and you want Databricks notebooks as output.',
            tradeoffs:
              'Uses LLMs, so it can attempt code that fixed translation rules do not cover. Treat the output as a draft, because model output can vary between runs and every file needs review and reconciliation.',
          },
          {
            option: 'Agentic code converter in Genie Code',
            when: 'You convert SQL from T-SQL, Snowflake, Redshift, Oracle, BigQuery, or Teradata and want to work interactively in a workspace migration project.',
            tradeoffs:
              'Generally available for SQL conversion. It validates its output and fixes errors before writing results to a workspace folder, and you can keep chatting with it about the converted files. The Notebooks target is Beta. Check the docs for size limits before you point it at a very large estate.',
          },
        ],
        recommendation:
          'Run BladeBridge for bulk SQL and ETL conversion, and use the agentic code converter for interactive, validated SQL conversion in a migration project. Use Switch for code the others cannot handle, and plan more review time for it.',
      },
      links: [
        {
          label: 'Lakebridge transpile',
          url: 'https://databrickslabs.github.io/lakebridge/docs/transpile/',
        },
        {
          label: 'Convert SQL with the agentic code converter',
          url: 'https://docs.databricks.com/aws/en/migration/agentic-code-converter',
        },
        {
          label: 'Migrate your data warehouse to the lakehouse',
          url: 'https://docs.databricks.com/aws/en/migration/warehouse-to-lakehouse',
        },
      ],
    },
    {
      id: 'targets',
      heading: 'Target patterns to land on',
      prose:
        'A literal translation runs, but it keeps the legacy design. Move to patterns that fit the platform.',
      table: {
        columns: ['Legacy construct', 'Databricks pattern'],
        rows: [
          ['Cursor or WHILE loop over rows', 'Set-based SQL, or a window function or join'],
          ['Stored procedure that chains steps', 'Lakeflow Jobs tasks, or a Lakeflow Spark Declarative Pipeline for table-to-table logic'],
          ['Temp tables between steps', 'Views, CTEs, or intermediate pipeline tables'],
          ['Nightly full reload', 'Incremental streaming tables or materialized views'],
          ['Identity column or sequence', 'Generated identity columns on Delta, or a deterministic key'],
          ['Permissions in the warehouse', 'Unity Catalog grants, row filters, and column masks'],
          ['Scheduler outside the warehouse', 'Lakeflow Jobs with retries, alerts, and repair runs'],
        ],
      },
      points: [
        {
          strong: 'Tune after you reconcile.',
          text: 'Get correct output first, then tune. Use liquid clustering, predictive optimization, and serverless compute instead of replicating the legacy indexes and partitions.',
        },
        {
          strong: 'Move the data deliberately.',
          text: 'Use Lakeflow Connect or Lakehouse Federation to land source data while both systems run, and reconcile what lands.',
        },
      ],
    },
    {
      id: 'reconcile',
      heading: 'Reconcile against the legacy system’s own output',
      prose:
        'The only proof that a migrated workload is right is that it produces what the legacy system produces on the same inputs. Lakebridge Reconcile does that comparison.',
      points: [
        {
          strong: 'Choose the report type.',
          text: 'Schema compares column names and types. Row compares row hashes when there is no key. Data compares values by join columns, with per-column mismatches. All runs data and schema together.',
        },
        {
          strong: 'Compare the same inputs.',
          text: 'Run both systems on the same input snapshot, and compare results for the same period. Include edge cases: nulls, empty periods, rounding, time zones, and late data.',
        },
        {
          strong: 'Do not reconcile only against your own reference.',
          text: 'A reference that you wrote in Python proves the conversion matches that reference. It does not show the output matches the legacy system.',
        },
        {
          strong: 'Keep reconciling through the parallel run.',
          text: 'Schedule Reconcile every cycle, and treat a new mismatch as a defect until explained.',
        },
      ],
      options: {
        caption: 'Reconcile report types',
        rows: [
          {
            option: 'Schema',
            when: 'An early check that column names and types match after conversion.',
            tradeoffs:
              'Cheapest, since no data is compared. It cannot find wrong values, so it never proves a workload correct on its own.',
          },
          {
            option: 'Row',
            when: 'The table has no reliable key, so you can only compare whole rows by hash.',
            tradeoffs:
              'Flags rows that exist on one side only or differ, with no key needed. It does not say which column differs, so diagnosis is slower.',
          },
          {
            option: 'Data',
            when: 'The table has join columns you trust, and you want to see which columns mismatch.',
            tradeoffs:
              'Compares values by key and reports per-column mismatches, which makes defects easy to trace. It depends on a correct key, and reading both sides costs compute and source load.',
          },
          {
            option: 'All',
            when: 'Final sign-off before cutover on critical tables.',
            tradeoffs:
              'Runs schema and data checks together for the strongest evidence, at the highest compute cost. Reserve it for tables where an error is expensive.',
          },
        ],
        recommendation:
          'Run schema reports early and often, data reports on keyed tables through the parallel run, and row reports where no key exists. Use all for sign-off on critical tables.',
      },
      links: [
        {
          label: 'Lakebridge Reconcile',
          url: 'https://databrickslabs.github.io/lakebridge/docs/reconcile/',
        },
      ],
    },
    {
      id: 'effort',
      heading: 'Estimate effort by role',
      prose:
        'Estimate per role, not as one number: hours = fixed + clean x a + warning x b + manual x c, with the fixed and per-status hours as stated assumptions that each role reviews. Count the statuses from the assessment. Treat the result as a planning input for one workload, and exclude data migration, cutover, and performance tuning, which you estimate separately.',
      table: {
        caption: 'Roles to estimate',
        columns: ['Role', 'Typical work'],
        rows: [
          ['Data engineer', 'Reviews converted SQL, rewrites manual steps, builds the pipelines and jobs'],
          ['Analytics engineer', 'Validates business logic and outputs against the legacy definitions'],
          ['QA', 'Builds reconciliation checks and triages differences'],
          ['Platform admin', 'Unity Catalog structure and grants, compute, and job permissions'],
        ],
      },
    },
  ],
  related: [
    { slug: 'dataops', title: 'Pipeline operations' },
    { slug: 'platform-administration', title: 'Workspace and account administration' },
  ],
};
