import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'github-cicd',
  area: 'CI/CD & Version Control Guides',
  title: 'GitHub-based CI/CD',
  intro:
    'Author in Git folders or your IDE, review in a pull request, and let CI deploy a Declarative Automation Bundle. One commit moves from dev through test, stage, and prod, and a service principal does the deploying. Git folders are where people work; bundles are what production runs from. This page covers that split, the bundle and pipeline practices that make it safe, GitHub sign-in without a stored secret, and the approval gate.',
  businessValue: {
    summary:
      'Every production change passes a pull request, automated tests, and an approval before it deploys. Platform owners get controlled releases without storing deploy secrets in GitHub.',
    outcomes: [
      {
        title: 'Gated releases',
        body: 'Pull requests run unit tests and bundle validate --strict, and later environments require named reviewers. A broken change stops before it reaches production.',
      },
      {
        title: 'One tested commit deploys',
        body: 'The same commit SHA deploys to dev, test, stage, and prod, so what passed testing is what runs in production.',
      },
      {
        title: 'No stored deploy secrets',
        body: 'GitHub signs in as a service principal through OIDC workload identity federation, so no token or client secret sits in GitHub to leak or expire.',
      },
      {
        title: 'Smaller blast radius',
        body: 'Deploy identity and run identity are separate service principals. The account that deploys is not the account that runs production jobs, and neither is a person.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Git folders are for authoring, bundles are for deploying.',
      body: 'People work in their own Git folders or IDE clones on short-lived branches. Jobs, pipelines, dashboards, apps, and schemas reach shared workspaces only through a bundle deploy from CI.',
    },
    {
      title: 'Production runs from bundle deployments, not from a Git folder.',
      body: 'A production Git folder updated on merge syncs files but defines no jobs, run identity, or per-environment settings. A bundle carries all three in one reviewed definition.',
    },
    {
      title: 'Gate every pull request, then promote one commit.',
      body: 'A pull request runs unit tests and bundle validate --strict. After the merge, the same commit SHA deploys to dev, test, stage, and prod, with required reviewers on the later environments.',
    },
    {
      title: 'A service principal deploys, and GitHub signs it in with OIDC.',
      body: 'Workload identity federation means no token or client secret is stored in GitHub. Deploy identity and run identity are separate service principals.',
    },
    {
      title: 'Pin the CLI and keep environment values in variables.',
      body: 'A floating CLI changes behavior between runs. Catalogs, hosts, and identities are bundle variables per target, never edits to resource files.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'From a branch to production',
      prose:
        'Each environment gets the same commit, and nothing reaches a shared workspace except through this path. Dev deploys on its own after the merge, and the later environments wait for an approval.',
      diagram: {
        type: 'flow',
        title: 'One commit through four environments',
        description:
          'A developer works in an IDE or a personal Git folder on a short-lived branch and opens a pull request. CI runs unit tests and bundle validate on the pull request and blocks the merge on failure. After the merge to main, CI deploys the same commit to dev with a smoke run, then to test with an integration run, then to stage, then to prod. Test, stage, and prod each wait for a reviewer to approve.',
        nodes: [
          {
            id: 'dev',
            label: 'IDE or Git folder',
            sub: 'your own short branch',
            col: 0,
            row: 0,
            kind: 'surface',
            domain: 'neutral',
            icon: 'users',
            detail:
              'Where people work: an IDE or a personal Git folder on a short-lived branch. Production never runs from here.',
          },
          {
            id: 'pr',
            label: 'Pull request',
            sub: 'review, required checks',
            col: 1,
            row: 0,
            domain: 'apps',
            icon: 'list',
            detail: 'Opens review and runs the required checks before anything reaches main.',
          },
          {
            id: 'ci',
            label: 'CI checks',
            sub: 'tests, validate --strict',
            col: 2,
            row: 0,
            kind: 'gate',
            domain: 'orchestration',
            detail:
              'Runs unit tests and bundle validate --strict on the pull request. A failure blocks the merge, so a broken change stops here.',
          },
          {
            id: 'merge',
            label: 'Merge to main',
            sub: 'one commit SHA',
            col: 3,
            row: 0,
            domain: 'orchestration',
            icon: 'workflow',
            detail: 'Merging to main fixes one commit SHA. Every environment then deploys that same commit.',
          },
          {
            id: 'denv',
            label: 'Deploy to dev',
            sub: 'smoke run',
            col: 3,
            row: 1,
            kind: 'highlight',
            domain: 'orchestration',
            icon: 'gear-amber',
            detail: 'Deploys the commit to dev on its own after the merge and runs a smoke check.',
          },
          {
            id: 'tenv',
            label: 'Deploy to test',
            sub: 'integration run',
            col: 2,
            row: 1,
            kind: 'highlight',
            domain: 'orchestration',
            icon: 'gear-amber',
            detail: 'Deploys the same commit to test and runs an integration run. It waits for a reviewer to approve.',
          },
          {
            id: 'senv',
            label: 'Deploy to stage',
            sub: 'production-like check',
            col: 1,
            row: 1,
            kind: 'highlight',
            domain: 'orchestration',
            icon: 'gear-amber',
            detail: 'Deploys the same commit to stage for a production-like check, after a reviewer approves.',
          },
          {
            id: 'penv',
            label: 'Deploy to prod',
            sub: 'mode: production',
            col: 0,
            row: 1,
            kind: 'store',
            domain: 'orchestration',
            icon: 'gear-amber',
            detail:
              'Deploys the same commit in production mode under a service principal, after a reviewer approves. Nobody edits a production copy by hand.',
          },
        ],
        edges: [
          { from: 'dev', to: 'pr', label: 'push' },
          { from: 'pr', to: 'ci' },
          { from: 'ci', to: 'merge', label: 'pass' },
          { from: 'merge', to: 'denv', label: 'auto' },
          { from: 'denv', to: 'tenv', label: 'approve' },
          { from: 'tenv', to: 'senv', label: 'approve' },
          { from: 'senv', to: 'penv', label: 'approve' },
        ],
        legend: [
          { kind: 'surface', label: 'Where people edit' },
          { kind: 'gate', label: 'Blocks the merge' },
          { kind: 'highlight', label: 'Same commit, bundle deploy' },
        ],
      },
    },
    {
      id: 'where',
      heading: 'Git folders and bundles: where each belongs',
      prose:
        'They do different jobs, and Databricks recommends both together. Git folders are the visual Git client in the workspace for authoring and review. Bundles are the deployment unit.',
      table: {
        caption: 'Git folders vs bundles',
        columns: ['', 'What it is for'],
        rows: [
          [
            'Git folders',
            'Authoring and collaborating in the workspace: clone, branch, edit, run notebooks next to your data, commit, push. Each person works in their own folder.',
          ],
          [
            'Bundles',
            'Deployment as code for jobs, pipelines, dashboards, apps, and schemas. One definition deploys to dev, test, stage, and prod targets, with run identity, permissions, and variables per target.',
          ],
          [
            'Production',
            'Runs from bundle deployments made by CI under a service principal. Nobody edits a production copy by hand.',
          ],
        ],
      },
      points: [
        {
          strong: 'Why a production Git folder is the weaker pattern.',
          text: "The older pattern keeps a production Git folder on a release branch and updates it through the Git folders API after each merge. That syncs files only. It has no resource definitions, so jobs and pipelines are created and changed separately. It has no run_as, so run identity is whoever owns the job. It has no environment targets, so dev, test, and prod differences live in people's heads. A bundle puts all of these in one reviewed definition.",
        },
        {
          strong: 'When a production Git folder is still acceptable.',
          text: 'Databricks still documents it for teams that deploy only code into the workspace, for example a notebooks-only project whose jobs are managed elsewhere. If you use it, create it as an admin outside user folders, give most people run-only access, let only a service principal update it, and have jobs read from your Git provider rather than a workspace path.',
        },
        {
          strong: 'Bundles in the workspace UI are for development.',
          text: 'A folder with a databricks.yml at its root in a Git folder is recognized as a bundle, and you can edit, commit, deploy, and run it from the UI with serverless compute. You cannot deploy from there to another workspace. Develop in the workspace, sync the Git folder, and let CI deploy elsewhere.',
        },
      ],
      links: [
        {
          label: 'CI/CD with Databricks Git folders',
          url: 'https://docs.databricks.com/aws/en/repos/ci-cd',
          note: 'User, merge, and admin flows, and the production Git folder.',
        },
        {
          label: 'Collaborate on bundles in the workspace',
          url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/workspace',
          note: 'What the workspace bundle editor can and cannot do.',
        },
        {
          label: 'CI/CD on Databricks',
          url: 'https://docs.databricks.com/aws/en/dev-tools/ci-cd/',
          note: 'The overall flow and the tools for each step.',
        },
      ],
    },
    {
      id: 'git-folders',
      heading: 'Git folder practices that support CI',
      prose:
        'CI only works if what people merge is reviewable and what they author is isolated. The Git collaboration guide covers the daily workflow; these are the habits CI depends on.',
      points: [
        {
          strong: 'One person, one Git folder, one branch.',
          text: 'Databricks recommends that each developer work on their own branch in their own folder. A shared folder lets one person switch the branch under everyone else.',
        },
        {
          strong: 'Service principal Git credentials for automation.',
          text: 'Jobs that clone a repository, and CI that updates a Git folder, run as a service principal with its own Git credential, so automation does not depend on a person who may leave.',
        },
        {
          strong: 'Keep logic in files that review well.',
          text: 'Put business logic in importable modules and .sql files, and keep notebooks thin. Notebooks saved in source format (.py, .sql) diff line by line and do not commit outputs. Version everything except build artifacts, tokens, and data with PII.',
        },
        {
          strong: 'No edits in shared or production copies.',
          text: 'If you must change production, do it through a pull request and a deploy. A hotfix merges back to main as soon as it is validated, so the trunk stays the source of truth.',
        },
        {
          strong: 'Private Git servers: the Git server proxy.',
          text: 'A Git server behind a firewall needs the Git server proxy, or Serverless Private Git (Public Preview). Cloud-hosted providers need neither.',
        },
      ],
      links: [
        {
          label: 'Developer best practices on Databricks',
          url: 'https://docs.databricks.com/aws/en/developers/best-practices',
          note: 'Version control, environments, bundles, and testing layers.',
        },
        {
          label: 'Authorize a service principal to access Git folders',
          url: 'https://docs.databricks.com/aws/en/repos/automate-with-sp',
          note: 'Git credentials for automation.',
        },
      ],
    },
    {
      id: 'bundle-practices',
      heading: 'Bundle practices',
      prose:
        "These live in databricks.yml and its resource files, so they are reviewed like code. The dev and test targets in this repository's reference bundle show variables, presets, and release tags.",
      table: {
        caption: 'Bundle configuration practices',
        columns: ['Practice', 'What to do'],
        rows: [
          [
            'Ship everything as a bundle from Git',
            'Jobs, pipelines, schemas, and permissions live in the repository and deploy through CI. Keep Terraform for cloud-level resources such as workspaces and networking.',
          ],
          [
            'One small bundle per deployable project',
            'Put everything one team owns and releases together in one bundle that covers every environment. Split bundles by product, ownership, or lifecycle. Keep them in one repository and share code with sync.paths.',
          ],
          [
            'Variables and targets, not copies',
            'Catalog, host, and identity IDs are bundle variables set per target. CI passes them as BUNDLE_VAR_<name>. Never duplicate a resource file per environment.',
          ],
          [
            'mode: production on stage and prod',
            'It checks that pipelines are not in development mode and, when the target sets git: branch: main, fails a deploy from the wrong branch. Pair it with run_as and a fixed root_path in a team-owned folder, never /Workspace/Shared.',
          ],
          [
            'Split deploy and run identities',
            'The deploy service principal gets little data access. Each production job or pipeline runs as its own service principal through run_as, scoped to the data that workload needs.',
          ],
          [
            'Tag with environment and release',
            'Set presets.tags on each target: environment and release. System tables and billing then report by environment and by commit.',
          ],
          [
            'Use the direct deployment engine',
            'New bundles on CLI 1.3.0 and later use it by default. Preview changes with bundle plan, and deploy a reviewed plan with bundle deploy --plan. Run bundle summary to list the deployed resources.',
          ],
          [
            'Keep secrets out of the bundle',
            'Store them in Databricks secret scopes backed by your cloud secret manager and read them at run time. Never commit tokens, credentials, or files with PII.',
          ],
          [
            'Serverless compute and usage policies',
            'Run jobs and pipelines on serverless compute. Assign a serverless usage policy per environment so its tags land in system.billing.usage.',
          ],
        ],
      },
      examples: [
        {
          label: 'A production target',
          language: 'yaml',
          code: `targets:
  prod:
    mode: production
    git:
      branch: main
    workspace:
      host: <prod-workspace-url>
      root_path: /Workspace/Deployments/\${bundle.name}/\${bundle.target}
    run_as:
      service_principal_name: <run-as-service-principal-application-id>
    variables:
      catalog: prod
    presets:
      tags:
        environment: prod
        release: \${var.release}`,
          notes: [
            'In production mode, a deploy from a branch other than main fails unless you pass --force.',
            'Deploy with a different service principal than the one in run_as. Only jobs and pipelines support that split.',
          ],
        },
      ],
      links: [
        {
          label: 'Declarative Automation Bundles deployment modes',
          url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/deployment-modes',
          note: 'Development and production mode, branch checks, and presets.',
        },
        {
          label: 'Specify a run identity',
          url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/run-as',
          note: 'run_as and the deploy and run split.',
        },
        {
          label: 'Migrate to the direct deployment engine',
          url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/direct',
          note: 'Plans, replayable deploys, and the Terraform engine removal.',
        },
      ],
    },
    {
      id: 'ci-practices',
      heading: 'Pipeline practices',
      prose:
        'These live in the CI workflow. They decide what blocks a merge, how a commit moves forward, and what can change between runs.',
      table: {
        caption: 'CI workflow practices',
        columns: ['Practice', 'What to do'],
        rows: [
          [
            'Trunk-based flow',
            'Short-lived feature branches merge to main, and main stays deployable. CI deploys main forward through the environments.',
          ],
          [
            'Gate every pull request',
            'Run unit tests and databricks bundle validate --strict, and make both required checks on main. Validation catches schema and variable errors. A deploy to a non-production workspace catches the rest.',
          ],
          [
            'Run integration in test',
            'Deploy to test with bundle deploy, run the job with bundle run, and assert row counts, schema, and data-quality results. Passing there is the gate for stage.',
          ],
          [
            'Promote one commit',
            'Dev, then test, then stage, then prod, each from the same SHA. Use one GitHub environment per target, with required reviewers on the later ones. Pass the SHA as the release variable.',
          ],
          [
            'Sign in with OIDC',
            'A federation policy on the service principal replaces a stored token or secret. See the next section.',
          ],
          [
            'Pin the CLI version',
            'Use a release tag or with: version: on databricks/setup-cli, not @main, and set bundle.databricks_cli_version in the bundle. A floating CLI changes behavior between runs.',
          ],
          [
            'Separate data by environment',
            'Run dev and test on generated or masked samples. Bind the production catalog to the production workspace only, in ISOLATED mode, so production data cannot reach lower environments.',
          ],
          [
            'Roll back by redeploying',
            'Check out the last known good release and run the deploy workflow on that tag with workflow_dispatch. A redeploy restores job, pipeline, and notebook definitions. Tables keep what the bad release wrote, so use RESTORE TABLE for those.',
          ],
        ],
      },
      links: [
        {
          label: 'Developer best practices on Databricks',
          url: 'https://docs.databricks.com/aws/en/developers/best-practices',
          note: 'Testing layers, small bundles, and hotfix handling.',
        },
        {
          label: 'GitHub Actions with Databricks',
          url: 'https://docs.databricks.com/aws/en/dev-tools/ci-cd/github',
          note: 'Databricks GitHub Actions examples.',
        },
      ],
    },
    {
      id: 'oidc',
      heading: 'Sign in with GitHub OIDC',
      prose:
        'Use workload identity federation so GitHub proves who it is to Databricks and nothing secret sits in GitHub. Databricks calls this the most secure way to authenticate CI/CD.',
      steps: [
        {
          title: 'Create a federation policy on the service principal',
          body: 'Set the issuer to https://token.actions.githubusercontent.com, and the subject to the repository and GitHub environment, for example repo:<org>/<repo>:environment:<env>. Copy the exact sub claim from GitHub: repositories created, renamed, or transferred on or after July 15, 2026 include numeric organization and repository IDs in it.',
        },
        {
          title: 'Use one GitHub environment per target',
          body: 'The environment name goes into the subject, so a job can sign in only for the target it deploys. Required reviewers on the environment hold the run for an approval.',
        },
        {
          title: 'Grant the job id-token: write',
          body: 'Set DATABRICKS_AUTH_TYPE to github-oidc, plus DATABRICKS_HOST and DATABRICKS_CLIENT_ID as environment variables. There is no token and no client secret to rotate.',
          code: `permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: prod
    env:
      DATABRICKS_AUTH_TYPE: github-oidc
      DATABRICKS_HOST: \${{ vars.DATABRICKS_HOST }}
      DATABRICKS_CLIENT_ID: \${{ vars.DATABRICKS_CLIENT_ID }}`,
        },
      ],
      options: {
        caption: 'How CI signs in to Databricks',
        rows: [
          {
            option: 'OIDC workload identity federation',
            when: 'GitHub Actions, or any CI that can present an OIDC token.',
            tradeoffs:
              'No secret sits in GitHub and nothing needs rotating. You create a federation policy on each service principal, and the subject has to match the repository and environment exactly, including the numeric IDs that newer repositories carry.',
          },
          {
            option: 'OAuth M2M with a service principal secret',
            when: 'A CI system that cannot issue OIDC tokens.',
            tradeoffs:
              'Works with any CI. The client ID and secret live in the CI secret store and have to be rotated, access tokens last one hour, and a leaked secret works from anywhere until you revoke it.',
          },
          {
            option: 'Personal access token',
            when: 'Throwaway tests only.',
            tradeoffs:
              'The token belongs to a person, so the pipeline breaks when that person leaves. Databricks recommends OAuth over PATs where possible, and it revokes PATs unused for 90 days.',
          },
        ],
        recommendation:
          'Use OIDC federation. Fall back to OAuth M2M only where the CI system cannot present OIDC tokens, and avoid PATs in pipelines.',
      },
      links: [
        {
          label: 'Enable workload identity federation for GitHub Actions',
          url: 'https://docs.databricks.com/aws/en/dev-tools/auth/provider-github',
          note: 'Policy fields, the sub format, and the workflow settings.',
        },
        {
          label: 'OAuth token federation',
          url: 'https://docs.databricks.com/aws/en/dev-tools/auth/oauth-federation',
          note: 'How federation works across CI providers.',
        },
        {
          label: 'Authorize service principal access with OAuth (M2M)',
          url: 'https://docs.databricks.com/aws/en/dev-tools/auth/oauth-m2m',
          note: 'Client ID and secret flow, and token lifetime.',
        },
        {
          label: 'Personal access token authentication',
          url: 'https://docs.databricks.com/aws/en/dev-tools/auth/pat',
          note: 'PAT limits and why OAuth is preferred.',
        },
      ],
    },
    {
      id: 'promote',
      heading: 'Promote one commit with an approval gate',
      prose:
        'The gate is a setting on a GitHub environment, not a step in the YAML. The workflow names the environment, and GitHub holds the run until a required reviewer approves.',
      points: [
        {
          strong: 'Each job needs the one before it.',
          text: 'Deploy to the next environment only if the previous job succeeded. A failing test stops everything, so no half-deployed state reaches Databricks.',
        },
        {
          strong: 'Deploy the same SHA everywhere.',
          text: 'Pass github.sha as the release variable and tag resources with it. Do not rebuild between environments. Then the thing you tested in test is the thing that reaches prod.',
        },
        {
          strong: 'Reviewers approve on the environment.',
          text: 'Add required reviewers to the environments for test, stage, and prod. A named person opens each gate. Only the service principal deploys.',
        },
        {
          strong: 'Validate before you deploy, in every job.',
          text: 'Each deploy job runs bundle validate --strict for its own target first, then deploy, then run.',
        },
      ],
      options: {
        caption: 'What starts a production deploy',
        rows: [
          {
            option: 'Deploy on every merge to main, with reviewers on the environment',
            when: 'Trunk-based teams making small, steady changes.',
            tradeoffs:
              'Each merged commit moves toward prod and waits at the approval gate, so changes ship in small steps. It relies on protected main and good tests, because the merge itself starts the pipeline.',
          },
          {
            option: 'Release tag or workflow_dispatch',
            when: 'Fixed release windows, or change management that wants an explicit release.',
            tradeoffs:
              'You choose when prod changes and which SHA ships, and a rollback is the same workflow run on an older tag. Main can run ahead of prod, so releases bundle more changes and test and prod drift further apart.',
          },
        ],
        recommendation:
          'Deploy on merge with required reviewers on stage and prod, and keep a workflow_dispatch run on a tag for rollbacks and hotfixes.',
      },
      links: [
        {
          label: 'GitHub Actions with Databricks',
          url: 'https://docs.databricks.com/aws/en/dev-tools/ci-cd/github',
          note: 'Environments, the setup-cli action, and examples.',
        },
      ],
    },
  ],
  related: [
    { slug: 'git-collaboration', title: 'Collaborating on Databricks projects with Git' },
    { slug: 'vscode-databricks', title: 'Working with Databricks in VS Code' },
    { slug: 'dab-starter', title: 'Running a Declarative Automation Bundle' },
    { slug: 'environment-workspaces-catalogs', title: 'Workspaces and catalogs across dev, test, stage, and prod' },
    { slug: 'ide-developer-experience', title: 'Developer workflow in the IDE' },
  ],
};
