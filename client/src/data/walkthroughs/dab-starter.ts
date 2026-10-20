import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'dab-starter',
  area: 'CI/CD & Version Control Guides',
  title: 'Running a Declarative Automation Bundle',
  intro:
    'A Declarative Automation Bundle (formerly Databricks Asset Bundles) puts jobs, pipelines, and schemas in YAML next to the code they run. The Databricks CLI validates the folder, deploys it to a workspace, and runs it. This page walks one small bundle end to end: download it, push it to your own Git repo, deploy it to a development target, run it, change it, deploy it to a second target, and take it down. The bundle holds a serverless Lakeflow Spark Declarative Pipeline that builds bronze, silver, and gold tables from synthetic orders, and a job that runs it.',
  shortVersion: [
    {
      title: 'A bundle is a folder with a databricks.yml.',
      body: 'The file names the bundle, declares variables and targets, and includes resource files. Resources are the jobs, pipelines, and schemas it deploys.',
    },
    {
      title: 'Four commands do the work.',
      body: 'validate checks the YAML and your access, deploy uploads files and creates resources, run starts a job or pipeline, destroy removes everything the bundle made.',
    },
    {
      title: 'Targets change how it deploys, not what it is.',
      body: 'dev (development mode) prefixes names with your user, pauses schedules, and gives you your own schema. prod (production mode) deploys one shared copy with live schedules.',
    },
    {
      title: 'Git holds the bundle; the CLI does not read from it.',
      body: 'deploy uploads the files in your folder. Git is where the team reviews and versions them, and where CI picks them up.',
    },
    {
      title: 'CI runs the same commands.',
      body: 'A GitHub Actions workflow validates every pull request and deploys main, signing in as a service principal through secrets.',
    },
  ],
  sections: [
    {
      id: 'what-is-a-bundle',
      heading: 'What a bundle is',
      prose:
        'A bundle has three parts you will touch. Resources are the things it creates: a schema, a pipeline, and a job. Targets are the places it deploys to: dev and prod. Variables are the values that differ between those places, such as the catalog. The CLI reads databricks.yml, merges every file it includes, applies the target you pick, and calls the Databricks APIs to make the workspace match.',
      diagram: {
        type: 'flow',
        title: 'From folder to workspace',
        description:
          'The Databricks CLI reads the bundle folder from your Git repo, applies the chosen target and its variables, and creates a schema, a pipeline, and a job in the workspace. The job runs the pipeline, and the pipeline writes bronze, silver, and gold tables to the schema.',
        nodes: [
          { id: 'repo', label: 'Your Git repo', sub: 'databricks.yml + code', col: 0, row: 1, kind: 'store' },
          { id: 'target', label: 'Target + variables', sub: 'dev or prod, catalog', col: 0, row: 0 },
          { id: 'cli', label: 'Databricks CLI', sub: 'validate, deploy, run', col: 1, row: 1, kind: 'highlight' },
          { id: 'job', label: 'Job', sub: 'runs pipeline, then check', col: 2, row: 0 },
          { id: 'pipeline', label: 'Pipeline', sub: 'serverless, dbldatagen', col: 2, row: 1, kind: 'highlight' },
          { id: 'schema', label: 'Schema', sub: 'dev_<you>_dab_starter', col: 2, row: 2, kind: 'store' },
          { id: 'tables', label: 'Bronze, silver, gold', sub: 'Unity Catalog tables', col: 3, row: 1, kind: 'surface' },
        ],
        edges: [
          { from: 'repo', to: 'cli', label: 'files' },
          { from: 'target', to: 'cli', dashed: true },
          { from: 'cli', to: 'job', label: 'creates' },
          { from: 'cli', to: 'pipeline', label: 'creates' },
          { from: 'cli', to: 'schema', label: 'creates' },
          { from: 'job', to: 'pipeline', label: 'runs' },
          { from: 'pipeline', to: 'tables' },
          { from: 'schema', to: 'tables', dashed: true },
        ],
        legend: [
          { kind: 'highlight', label: 'Runs on serverless compute' },
          { kind: 'store', label: 'Source or storage' },
        ],
      },
      table: {
        caption: 'The starter bundle, file by file',
        columns: ['File', 'What it holds'],
        rows: [
          ['databricks.yml', 'Bundle name, variables (catalog, schema, row_count), and the dev and prod targets.'],
          ['resources/orders.pipeline.yml', 'The serverless pipeline, with dbldatagen as a dependency and row_count as a setting.'],
          ['resources/orders.job.yml', 'The job: run the pipeline, then check the tables. A daily schedule.'],
          ['resources/orders.schema.yml', 'The schema the tables land in.'],
          ['guides/dab-starter/pipeline/orders.py', 'The pipeline source: bronze, silver with expectations, and gold.'],
        ],
      },
      links: [
        { label: 'What are Declarative Automation Bundles?', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles' },
        { label: 'Bundle configuration', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/settings' },
        { label: 'Bundle variables', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/variables' },
      ],
    },
    {
      id: 'download-and-push',
      heading: 'Download it and push it to your Git repo',
      prose:
        'Use Download the starter bundle at the top of this page. Unzip it, then make it a Git repo of your own. Create an empty repo on GitHub first. The download has a .gitignore that keeps the CLI\'s local state (.databricks/) out of Git.',
      steps: [
        {
          title: 'Unzip and commit',
          body: 'This makes the folder your repo and commits everything in it.',
          code: `unzip dab-starter.zip
cd dab-starter
git init -b main
git add .
git commit -m "Add the dab-starter bundle"`,
        },
        {
          title: 'Push to your remote',
          body: 'Replace the URL with your empty repo.',
          code: `git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main`,
        },
      ],
      points: [
        {
          strong: 'Nothing reads from Git yet.',
          text: 'bundle deploy uploads the files in your working folder. Pushing gives you review, history, and a place for CI to start from.',
        },
        {
          strong: 'Keep secrets out.',
          text: 'The bundle holds no tokens. The CI step later uses repository secrets, never files in the repo.',
        },
      ],
    },
    {
      id: 'authenticate',
      heading: 'Authenticate the CLI',
      prose:
        'The CLI needs a recent version (tested with v1.17.0) and a profile for your workspace. databricks auth login opens a browser, signs you in with OAuth, and saves the profile. Nothing secret lands in the bundle.',
      steps: [
        {
          title: 'Check the version and sign in',
          body: 'Use the latest CLI: the pipeline environment setting this bundle relies on is recent.',
          code: `databricks --version
databricks auth login --host https://<your-workspace-host>
databricks auth profiles`,
        },
        {
          title: 'Point commands at the profile',
          body: 'With one profile the CLI uses it. With several, add --profile to every command, or export DATABRICKS_CONFIG_PROFILE once.',
          code: 'export DATABRICKS_CONFIG_PROFILE=<profile-name>',
        },
      ],
      points: [
        { strong: 'You need a catalog.', text: 'The bundle creates its own schema, so your user needs USE CATALOG and CREATE SCHEMA on the catalog you pass in.' },
        { strong: 'Serverless must be on.', text: 'The pipeline and the check notebook run on serverless compute. There is no cluster to configure.' },
      ],
      links: [
        { label: 'Install the Databricks CLI', url: 'https://docs.databricks.com/aws/en/dev-tools/cli/install' },
        { label: 'CLI authentication', url: 'https://docs.databricks.com/aws/en/dev-tools/cli/authentication' },
        { label: 'OAuth for a user (U2M)', url: 'https://docs.databricks.com/aws/en/dev-tools/auth/oauth-u2m' },
      ],
    },
    {
      id: 'validate',
      heading: 'Validate',
      prose:
        'validate parses databricks.yml and every included file, fills in variables, and checks the result against the bundle schema and your workspace. It changes nothing. Run it before every deploy; CI runs it on every pull request. --strict turns warnings into errors.',
      steps: [
        {
          title: 'Validate with your catalog',
          body: 'catalog has no default, because it belongs to your workspace. Pass it with --var, or set BUNDLE_VAR_catalog once.',
          code: 'databricks bundle validate --strict --var catalog=<catalog>',
        },
      ],
      points: [
        { strong: 'What a pass looks like.', text: 'The bundle name, target, workspace path, and Validation OK!' },
        { strong: 'Typical failures.', text: 'A missing variable, a misspelled key, or a catalog you cannot use. The message names the file and line.' },
      ],
      links: [{ label: 'Bundle CLI commands', url: 'https://docs.databricks.com/aws/en/dev-tools/cli/bundle-commands' }],
    },
    {
      id: 'deploy',
      heading: 'Deploy to dev',
      prose:
        'deploy uploads the bundle files to your workspace folder and creates the resources. dev is the default target and uses development mode. That mode makes the deploy safe to repeat and safe to share a workspace: every resource is yours alone.',
      steps: [
        {
          title: 'Deploy',
          body: 'The first deploy creates a schema, a pipeline, and a job. Later deploys change only what differs.',
          code: 'databricks bundle deploy --var catalog=<catalog>',
        },
      ],
      table: {
        caption: 'What development mode does',
        columns: ['Change', 'What you see'],
        rows: [
          ['Name prefix', 'Jobs and pipelines are named [dev <you>] dab-starter-orders.'],
          ['Paused schedules', 'The job has a daily 06:00 UTC schedule, and it shows as paused. Nothing runs until you start it.'],
          ['Per-user schema', 'The schema is dev_<you>_dab_starter, so two people can deploy the same bundle without colliding.'],
          ['Your own copy of the files', 'Files go to a folder under your user, named for the bundle and target.'],
        ],
      },
      points: [
        {
          strong: 'Read the schema from the resource.',
          text: 'The pipeline uses ${resources.schemas.starter.name}, which includes the dev prefix. ${var.schema} would point at a schema that does not exist.',
        },
      ],
      links: [
        { label: 'Deployment modes', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/deployment-modes' },
        { label: 'Bundle resources', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/resources' },
      ],
    },
    {
      id: 'run',
      heading: 'Run it and read the run',
      prose:
        'bundle run starts the job and waits for it. The job runs the pipeline, then the check notebook. The CLI prints a run URL; open it to see both tasks. The pipeline generates 100,000 orders with dbldatagen. Silver drops the rows that break a rule, and gold totals revenue per day and category.',
      diagram: {
        type: 'flow',
        title: 'What the job runs',
        description:
          'dbldatagen generates 100,000 seeded orders into the bronze table. The silver table keeps the orders that pass three drop rules and one warning rule. The gold table totals orders, units, and revenue per day and category. A check notebook then reads all three tables and the pipeline event log.',
        nodes: [
          { id: 'gen', label: 'dbldatagen', sub: 'seeded, 100,000 orders', col: 0, row: 0, kind: 'box' },
          { id: 'bronze', label: 'orders_bronze', sub: 'raw, bad rows included', col: 1, row: 0, kind: 'store', mono: true },
          { id: 'silver', label: 'orders_silver', sub: '3 drop rules, 1 warning', col: 2, row: 0, kind: 'gate', mono: true },
          { id: 'gold', label: 'orders_daily_revenue', sub: 'day x category', col: 3, row: 0, kind: 'store', mono: true },
          { id: 'check', label: 'check_gold', sub: 'counts + expectations', col: 3, row: 1, kind: 'surface', mono: true },
        ],
        edges: [
          { from: 'gen', to: 'bronze' },
          { from: 'bronze', to: 'silver' },
          { from: 'silver', to: 'gold' },
          { from: 'gold', to: 'check', dashed: true },
        ],
        legend: [
          { kind: 'gate', label: 'Expectations' },
          { kind: 'store', label: 'Table' },
        ],
      },
      steps: [
        {
          title: 'Run the job',
          body: 'Expect about two minutes on serverless compute.',
          code: 'databricks bundle run capability_guides_dab_starter --var catalog=<catalog>',
        },
        {
          title: 'Query the gold table',
          body: 'Catalog Explorer lists the tables under your catalog and the dev_<you>_dab_starter schema.',
          code: `SELECT product_category, sum(orders) AS orders, round(sum(revenue), 2) AS revenue
FROM <catalog>.dev_<you>_dab_starter.orders_daily_revenue
GROUP BY product_category ORDER BY revenue DESC;`,
        },
      ],
      points: [
        {
          strong: 'Reference run.',
          text: 'Bronze 100,000 rows. Silver 77,328 rows, with 22,672 dropped: 2,023 had no customer, 16,465 had a quantity of zero or less, and 5,510 had an unknown status. Gold 450 rows (90 days by 5 categories) for 68,137 orders. Price in range passed all 100,000.',
        },
        {
          strong: 'Same numbers every run.',
          text: 'The generator is seeded, so a rerun gives the same counts. You can compare your run to these.',
        },
        {
          strong: 'Where to look.',
          text: 'In the pipeline graph, select orders_silver to see the expectation counts. The check_gold task prints row counts and the same expectation results from the event log.',
        },
      ],
      links: [
        { label: 'Manage data quality with expectations', url: 'https://docs.databricks.com/aws/en/ldp/expectations' },
        { label: 'Lakeflow Spark Declarative Pipelines', url: 'https://docs.databricks.com/aws/en/ldp' },
        { label: 'Pipeline dependencies', url: 'https://docs.databricks.com/aws/en/ldp/developer/external-dependencies' },
      ],
    },
    {
      id: 'change-and-redeploy',
      heading: 'Change something and redeploy',
      prose:
        'Edit a value in the YAML or a rule in the pipeline source, deploy, and run again. deploy compares your folder with the last deploy and updates only what changed. Both changes below touch the pipeline, so run the job after each.',
      steps: [
        {
          title: 'Change a variable',
          body: 'row_count is a bundle variable passed to the pipeline as a setting. Override it for one deploy without editing a file.',
          code: `databricks bundle deploy --var catalog=<catalog> --var row_count=250000
databricks bundle run capability_guides_dab_starter --var catalog=<catalog> --var row_count=250000`,
        },
        {
          title: 'Change a rule',
          body: 'Open guides/dab-starter/pipeline/orders.py and edit an expectation in orders_silver, for example raise the minimum quantity. Deploy and run again, then compare the dropped count.',
          code: `databricks bundle deploy --var catalog=<catalog>
databricks bundle run capability_guides_dab_starter --var catalog=<catalog>`,
        },
      ],
      points: [
        {
          strong: 'Commit what you change.',
          text: 'Make the change on a branch, open a pull request, and let the validate check run before anyone deploys it.',
        },
        {
          strong: 'Pass the same variables each time.',
          text: 'A variable given only on the command line is not remembered. Put a default in databricks.yml or set BUNDLE_VAR_catalog in your shell.',
        },
      ],
    },
    {
      id: 'prod',
      heading: 'Deploy to prod',
      prose:
        'The second target is the same bundle in production mode. It makes a separate copy: no name prefix, the schema is dab_starter, and the schedule is live. Dev and prod do not share tables. Production mode also requires a fixed workspace root_path that names the target, so only one copy exists.',
      steps: [
        {
          title: 'Validate, deploy, and run prod',
          body: 'Add -t prod to each command.',
          code: `databricks bundle validate --strict -t prod --var catalog=<catalog>
databricks bundle deploy -t prod --var catalog=<catalog>
databricks bundle run capability_guides_dab_starter -t prod --var catalog=<catalog>`,
        },
      ],
      table: {
        caption: 'The same bundle in each target',
        columns: ['Target', 'What you get'],
        rows: [
          ['dev', 'Names start with [dev <you>], the schema is dev_<you>_dab_starter, and the schedule is paused.'],
          ['prod', 'Names have no prefix, the schema is dab_starter, and the schedule runs daily at 06:00 UTC.'],
        ],
      },
      points: [
        { strong: 'Schedule.', text: 'Remove the schedule block in resources/orders.job.yml if you do not want a daily run in prod.' },
        {
          strong: 'Before you rely on prod.',
          text: 'Deploy as a service principal and add run_as to the prod target, so scheduled runs do not depend on one person.',
        },
      ],
      links: [
        { label: 'Run as a service principal', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/run-as' },
        { label: 'Bundle permissions', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/permissions' },
      ],
    },
    {
      id: 'ci',
      heading: 'CI with GitHub Actions',
      prose:
        'The bundle ships .github/workflows/bundle.yml. On a pull request it runs validate. On a push to main it deploys to prod and runs the job. It signs in as a service principal with OAuth, using repository secrets, so no person\'s token sits in CI.',
      table: {
        caption: 'Add these under Settings, Secrets and variables, Actions',
        columns: ['Name', 'Value'],
        rows: [
          ['DATABRICKS_HOST (secret)', 'Your workspace URL.'],
          ['DATABRICKS_CLIENT_ID (secret)', 'Application ID of a service principal.'],
          ['DATABRICKS_CLIENT_SECRET (secret)', 'An OAuth secret for that service principal.'],
          ['DATABRICKS_CATALOG (variable)', 'The catalog the bundle creates its schema in.'],
        ],
      },
      points: [
        { strong: 'Grant the service principal what it needs.', text: 'USE CATALOG and CREATE SCHEMA on the catalog, and permission to create jobs and pipelines.' },
        { strong: 'DATABRICKS_BUNDLE_ENV picks the target.', text: 'The workflow sets it to prod, so the same commands you ran by hand run in CI.' },
        { strong: 'Protect main.', text: 'Require the validate check and a review before merge, so a deploy only follows a reviewed change.' },
      ],
      links: [
        { label: 'GitHub Actions with Databricks', url: 'https://docs.databricks.com/aws/en/dev-tools/ci-cd/github' },
        { label: 'OAuth for a service principal (M2M)', url: 'https://docs.databricks.com/aws/en/dev-tools/auth/oauth-m2m' },
        { label: 'Service principals', url: 'https://docs.databricks.com/aws/en/admin/users-groups/service-principals' },
      ],
    },
    {
      id: 'ci-best-practices',
      heading: 'CI/CD best practices',
      prose:
        'The starter workflow keeps setup short: it signs in with an OAuth client secret and installs the CLI from the floating main branch. Before a team relies on it, change those two things and add the gates below. This list follows the Databricks developer best-practices page.',
      table: {
        caption: 'What to put in place, in the order a change travels',
        columns: ['Practice', 'What to do'],
        rows: [
          ['Ship everything as a bundle from Git', 'Jobs, pipelines, schemas, and permissions live in the repo and deploy through CI. Nobody edits prod by hand. Keep Terraform for cloud-level resources such as workspaces and networking.'],
          ['Trunk-based flow', 'Short-lived feature branches merge to main, and main stays deployable. CI deploys main forward through the environments.'],
          ['Sign in to Databricks with OIDC', 'Add a federation policy to the service principal (issuer https://token.actions.githubusercontent.com, subject repo:<org>/<repo>:environment:<env>), set DATABRICKS_AUTH_TYPE=github-oidc, and grant the job id-token: write. No PAT and no stored client secret. Copy the exact sub from GitHub: repositories created after July 15, 2026 include numeric IDs in it.'],
          ['Split deploy and run identities', 'The deploy service principal gets little data access. Each stage and prod job or pipeline runs as its own service principal through run_as, scoped to the data that workload needs.'],
          ['mode: production on stage and prod', 'It checks that pipelines are not in development mode, leaves schedules live, and fails a deploy from the wrong branch when the target sets git: branch: main. Pair it with run_as and a fixed root_path; never deploy to /Workspace/Shared.'],
          ['Gate every pull request', 'Run unit tests and databricks bundle validate --strict, and make both required checks on main. Validation catches schema and variable errors. A deploy to a non-prod workspace catches the rest.'],
          ['Run integration in test', 'Deploy to test, run the job, and assert row counts, schema, and data-quality results. The starter\'s check_gold task is the pattern. Passing there is the gate for stage.'],
          ['Promote one commit', 'dev, then test, then stage, then prod, each from the same SHA. One GitHub environment per target, with required reviewers on stage and prod. Pass the SHA as the release variable.'],
          ['Pin the CLI version', 'Use databricks/setup-cli@v1.21.0 (a release tag) or with: version:, not @main. A floating CLI changes behavior between runs: the direct deployment engine became the default for new bundles in CLI 1.3.0.'],
          ['Variables for environment values', 'Catalog, host, and service principal IDs are bundle variables set per target. CI passes them as BUNDLE_VAR_<name>. Nothing environment-specific is hard-coded in resource files.'],
          ['Tag with environment and release', 'Set presets.tags on each target: environment and release. System tables and billing then report by environment and by commit.'],
          ['Keep secrets out of the bundle', 'Store them in Databricks secret scopes backed by your cloud secret manager, and read them at run time. Never commit tokens, credentials, or files with PII.'],
          ['Serverless compute and usage policies', 'Run jobs and pipelines on serverless compute. Assign a serverless usage policy (Public Preview, formerly budget policy) per environment so its tags land in system.billing.usage.'],
          ['Generated data outside prod', 'Dev and test run on generated or masked samples. Bind the prod catalog to the prod workspace only, so prod data cannot reach lower environments.'],
        ],
      },
      steps: [
        {
          title: 'Roll back by redeploying the previous tag',
          body: 'Check out the last known good release and deploy that commit to the affected target. In CI, run the deploy workflow on the tag with workflow_dispatch. Merge any hotfix back to main afterwards.',
          code: `git checkout <previous-tag>
databricks bundle deploy -t prod --var catalog=<catalog> --var release=<previous-tag>`,
        },
      ],
      points: [
        {
          strong: 'A redeploy restores code, not data.',
          text: 'It puts back the job, pipeline, and notebook definitions of that commit. Tables keep what the bad release wrote. Use RESTORE TABLE on Delta history for those.',
        },
        {
          strong: 'Keep bundles small.',
          text: 'One bundle per team and lifecycle lets you roll back one workload without touching the others.',
        },
      ],
      links: [
        { label: 'Developer best practices', url: 'https://docs.databricks.com/aws/en/developers/best-practices' },
        { label: 'Workload identity federation for GitHub Actions', url: 'https://docs.databricks.com/aws/en/dev-tools/auth/provider-github' },
        { label: 'Specify a run identity', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/run-as' },
        { label: 'Deployment modes', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/deployment-modes' },
        { label: 'Pin the CLI with setup-cli', url: 'https://github.com/databricks/setup-cli#github-actions' },
        { label: 'GitHub environments and required reviewers', url: 'https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments' },
        { label: 'Secret management', url: 'https://docs.databricks.com/aws/en/security/secrets/' },
        { label: 'Serverless usage policies', url: 'https://docs.databricks.com/aws/en/admin/usage/budget-policies' },
      ],
    },
    {
      id: 'destroy',
      heading: 'Clean up with destroy',
      prose:
        'destroy deletes what the bundle deployed: the job, the pipeline, the files in the workspace, and the schema with its tables. It lists them and asks you to confirm. Run it once per target.',
      steps: [
        {
          title: 'Destroy each target',
          body: 'This is permanent for the tables. Use --auto-approve only in scripts.',
          code: `databricks bundle destroy --var catalog=<catalog>
databricks bundle destroy -t prod --var catalog=<catalog>`,
        },
      ],
      points: [
        { strong: 'Only bundle resources.', text: 'destroy removes what this bundle created. Anything you made by hand in the same schema goes with the schema, so keep your own tables elsewhere.' },
        { strong: 'The repo stays.', text: 'Your Git repo and local folder are untouched. Deploy again any time.' },
      ],
    },
  ],
  related: [
    { slug: 'github-cicd', title: 'GitHub-based CI/CD' },
    { slug: 'ide-developer-experience', title: 'Developer workflow in the IDE' },
    { slug: 'medallion-architecture', title: 'Medallion architecture' },
  ],
};
