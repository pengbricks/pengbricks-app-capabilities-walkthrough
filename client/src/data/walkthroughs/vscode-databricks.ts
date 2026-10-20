import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'vscode-databricks',
  area: 'CI/CD & Version Control Guides',
  title: 'Working with Databricks in VS Code',
  intro:
    'The Databricks extension for Visual Studio Code (the docs call it the Databricks IDE extension, and it also runs in Cursor) ties one local project to one workspace. A CLI profile signs you in with OAuth, a bundle target says where code deploys, and a compute choice says where it runs. Set those three up first, open the project as a bundle, and the rest of the editor workflow follows. This page covers the recommended setup, how to run and debug code, and the mistakes that cost the most time.',
  shortVersion: [
    {
      title: 'Sign in with OAuth, not a token.',
      body: 'Use OAuth user-to-machine (U2M). The extension stores it as a profile in your Databricks CLI config file and refreshes access tokens for you. A personal access token is a legacy option.',
    },
    {
      title: 'Open the project as a bundle.',
      body: 'A folder with a databricks.yml is a Declarative Automation Bundle. The extension then gives you a target selector, a Bundle Resource Explorer, and one-click deploy and run. Start from a bundle template rather than loose files.',
    },
    {
      title: 'Debug with Databricks Connect, deploy with the bundle.',
      body: 'Databricks Connect runs your Python locally while Spark work runs on serverless or a cluster, so breakpoints work. Run on Databricks as a job when you want the real job environment.',
    },
    {
      title: 'Let the extension build the virtual environment.',
      body: 'It creates a .venv whose Python and packages match the compute you picked, and installs a matching databricks-connect. Re-run the setup when you switch compute.',
    },
    {
      title: 'Treat the synced workspace folder as disposable.',
      body: 'Sync is one way, from your machine to the workspace, and only in development mode. Never edit that copy. Real changes go through Git and a bundle deploy.',
    },
  ],
  sections: [
    {
      id: 'map',
      heading: 'What connects to what',
      prose:
        'Four pieces decide where your code goes and where it runs. The profile decides who you are, the bundle target decides which workspace, the virtual environment decides which versions you test against, and the compute decides where Spark executes.',
      diagram: {
        type: 'flow',
        title: 'From the editor to the workspace and compute',
        description:
          'The editor with the Databricks extension signs in through a CLI profile that uses OAuth. The profile maps to a bundle target in databricks.yml, which points at a workspace. The workspace receives synced files and bundle deploys, and shows job runs. Separately, the editor builds a local virtual environment that matches the runtime, installs a pinned Databricks Connect, and sends Spark work to serverless or cluster compute. Results return to the Debug Console.',
        nodes: [
          { id: 'editor', label: 'VS Code or Cursor', sub: 'Databricks extension', col: 0, row: 0, kind: 'surface' },
          { id: 'profile', label: 'CLI profile', sub: 'OAuth U2M, no token', col: 1, row: 0, kind: 'highlight' },
          { id: 'target', label: 'Bundle target', sub: 'databricks.yml', mono: true, col: 2, row: 0 },
          { id: 'ws', label: 'Workspace', sub: 'sync, deploy, jobs', col: 3, row: 0, kind: 'store' },
          { id: 'venv', label: '.venv', sub: 'matches the runtime', mono: true, col: 0, row: 1 },
          { id: 'dbc', label: 'Databricks Connect', sub: 'pinned to X.Y.*', col: 1, row: 1 },
          { id: 'compute', label: 'Compute', sub: 'serverless or cluster', col: 2, row: 1, kind: 'gate' },
          { id: 'out', label: 'Output', sub: 'Debug Console, job run', col: 3, row: 1 },
        ],
        edges: [
          { from: 'editor', to: 'profile' },
          { from: 'profile', to: 'target' },
          { from: 'target', to: 'ws', label: 'deploy' },
          { from: 'editor', to: 'venv' },
          { from: 'venv', to: 'dbc' },
          { from: 'dbc', to: 'compute', label: 'Spark work' },
          { from: 'compute', to: 'out' },
          { from: 'ws', to: 'out', dashed: true, label: 'job runs' },
        ],
        legend: [
          { kind: 'highlight', label: 'Identity, set once' },
          { kind: 'gate', label: 'Pick it, then match the .venv to it' },
          { kind: 'store', label: 'Where deployed code lives' },
        ],
      },
    },
    {
      id: 'starter',
      heading: 'Try it with the starter bundle',
      prose:
        'Download the starter bundle at the top of this page and open the folder in VS Code. It is a small bundle project set up the way the rest of this guide recommends: a Python package of order-cleaning functions, a source-format notebook that calls it, a script to debug with Databricks Connect, pytest tests, and a serverless Lakeflow job with a notebook task and a Python wheel task. The .vscode folder holds the pytest discovery settings, the launch configurations with "databricks": true, and the extension recommendations. The databricks-connect pin is 18.0.*, which matches serverless environment version 5.',
      points: [
        {
          strong: 'The README holds the click path.',
          text: 'Its numbered demo steps follow this page: open the folder, sign in with OAuth, pick serverless, set up the environment, run a notebook cell, debug the script, run the tests, deploy and run the job, change the code and redeploy, deploy to prod, and destroy.',
        },
        {
          strong: 'It needs one value from you.',
          text: 'Set the catalog variable in the Bundle Variables view, or pass --var catalog=<catalog>. The bundle creates its own schema there, prefixed with your user name in the dev target.',
        },
        {
          strong: 'Unit tests need no workspace.',
          text: 'The pandas tests run anywhere. One optional test uses Databricks Connect and skips itself when no sign-in works.',
        },
      ],
      links: [
        {
          label: 'Databricks IDE extension overview',
          url: 'https://docs.databricks.com/aws/en/dev-tools/vscode-ext/',
          note: 'The extension features the starter exercises.',
        },
      ],
    },
    {
      id: 'setup',
      heading: 'Set up once: install, sign in, pick compute',
      prose:
        'Do these in order. Each step writes configuration into the project, so a teammate who clones the repo repeats only the sign-in.',
      steps: [
        {
          title: 'Install the extension',
          body: 'You need Visual Studio Code 1.104.0 or later with a Python interpreter available. In the Extensions view search for Databricks and install the one with Databricks verified ownership. The docs require a workspace with at least one cluster to follow every feature, but serverless works for most of the workflow below. SQL warehouses are not supported.',
        },
        {
          title: 'Create or open a project',
          body: 'Click the Databricks icon, then Create a new project to start from a bundle template, or open a folder that already has a databricks.yml. For an existing non-bundle project, choose Create configuration to convert it. With several bundles in one window, pick the active one with Local Folder; run actions apply only to files in the active bundle.',
        },
        {
          title: 'Sign in with OAuth U2M',
          body: 'In the Configuration view, click Auth Type, then the gear icon, and choose OAuth (user to machine). Name the profile, sign in in the browser, and allow all-apis access if asked. The extension writes the profile to your Databricks CLI config file, so the CLI, SDKs, and Databricks Connect reuse the same sign-in. Pick an existing profile labeled OAuth (User to Machine) if one already points at your workspace.',
          code: `# Equivalent from a terminal, if you prefer the CLI
databricks auth login --host <workspace-url> --profile <profile-name>
databricks auth profiles`,
        },
        {
          title: 'Choose compute',
          body: 'In the Configuration view, click Select compute and pick Serverless, an existing cluster, or Create New Cluster. Serverless needs no start-up and no idle cost, so make it the default. Pick a cluster only when you need a library, an init script, or a Databricks Runtime that serverless does not give you. The view then shows the cluster ID, runtime version, and access mode.',
        },
      ],
      links: [
        {
          label: 'Install the Databricks IDE extension',
          url: 'https://docs.databricks.com/aws/en/dev-tools/vscode-ext/install',
          note: 'Requirements and installing a specific version.',
        },
        {
          label: 'Set up authorization',
          url: 'https://docs.databricks.com/aws/en/dev-tools/vscode-ext/authentication',
          note: 'OAuth U2M and configuration profiles.',
        },
        {
          label: 'Configure your Databricks project',
          url: 'https://docs.databricks.com/aws/en/dev-tools/vscode-ext/configure',
          note: 'Target, compute, sync, and Python environment.',
        },
      ],
    },
    {
      id: 'bundles',
      heading: 'Bundles first',
      prose:
        'Declare jobs and pipelines in databricks.yml and let the extension drive the bundle. You get the same deploy and run you would get from the CLI, with the same targets, so what you test in the editor is what CI deploys. The Running a Declarative Automation Bundle guide walks through the bundle itself; this section covers the editor side.',
      points: [
        {
          strong: 'Pick the target before anything else.',
          text: 'In the Configuration view, the Target gear lists the targets from databricks.yml, usually dev and prod. The view then shows the host and deployment mode. Stay on the dev target in development mode while you work.',
        },
        {
          strong: 'Browse resources in the Bundle Resource Explorer.',
          text: 'It lists the jobs and pipelines the bundle defines, including pipeline datasets and their schemas. Click the cloud icon to deploy the bundle. Select a job and click the play icon to deploy and run it.',
        },
        {
          strong: 'Read the run from the same panel.',
          text: 'Expand a job, open Run Status, and use the external-link icon to jump to the run in the workspace. For a pipeline, the check icon deploys and runs a validation or partial update, shows the events, and reports failures in the PROBLEMS panel.',
        },
        {
          strong: 'Keep environment values in bundle variables.',
          text: 'The Bundle Variables view lists the variables from your bundle and lets you override them locally. Use it for catalog and schema names so the same code runs against each target.',
        },
        {
          strong: 'Use the cluster override sparingly.',
          text: 'Override Jobs cluster in bundle runs bundle jobs on the cluster you selected, which skips job-cluster start-up. It is unavailable on serverless, and the docs limit it, with folder sync and cluster selection, to development mode.',
        },
      ],
      links: [
        {
          label: 'Bundle and explorer features',
          url: 'https://docs.databricks.com/aws/en/dev-tools/vscode-ext/bundles',
          note: 'Resource Explorer, Bundle Variables, workspace files, and Unity Catalog views.',
        },
        {
          label: 'What are Declarative Automation Bundles?',
          url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/',
          note: 'The bundle model and targets.',
        },
      ],
    },
    {
      id: 'run',
      heading: 'Four ways to run code',
      prose:
        'They differ in where your Python executes and what output you get back. Pick by what you are trying to learn: does the logic work, or does it work in the job environment.',
      table: {
        caption: 'Run options in the editor',
        columns: ['Option', 'What happens'],
        rows: [
          [
            'Debug current file with Databricks Connect',
            'Python runs locally with your debugger and breakpoints. DataFrame and SQL work runs on serverless or the selected cluster. Output goes to the Debug Console.',
          ],
          [
            'Upload and Run File',
            'The file uploads and runs on the selected cluster. Output goes to the Debug Console. Not available on serverless compute.',
          ],
          [
            'Run File as Workflow',
            'The file or notebook runs as a Lakeflow Job in the workspace. Output shows in a Databricks Job Run tab, with a link to the run. Works for .py, .ipynb, .sql, .r, and .scala notebooks.',
          ],
          [
            'Bundle Resource Explorer play icon',
            'Deploys the bundle and runs a job or pipeline you defined, with its real settings, parameters, and permissions.',
          ],
        ],
      },
      points: [
        {
          strong: 'Debug logic locally, then prove it as a job.',
          text: 'Step through a failing transform with Databricks Connect, then run it as a workflow or bundle job before you open a pull request. Connect hides differences in libraries, parameters, and permissions that the job run exposes.',
        },
        {
          strong: 'Notebook cells run through Databricks Connect too.',
          text: 'Open a notebook file and each cell shows Run Cell, Run Above, and Debug Cell. Code runs locally and Spark work runs remotely. The docs list Databricks Runtime 13.3 and above for this. The notebook globals spark, sql, udf, display, displayHTML, and dbutils are pre-set, and the %r and %scala magics are not supported.',
        },
        {
          strong: 'Pass arguments with a run configuration.',
          text: 'Add a configuration under Run > Add Configuration to pass arguments such as --prod to a file or notebook run. Add "databricks": true to a Python debugger configuration to get the extension\'s Databricks Connect sign-in.',
        },
      ],
      links: [
        {
          label: 'Run a file or notebook',
          url: 'https://docs.databricks.com/aws/en/dev-tools/vscode-ext/run',
          note: 'Cluster runs, workflow runs, and custom run configurations.',
        },
        {
          label: 'Debug code using Databricks Connect',
          url: 'https://docs.databricks.com/aws/en/dev-tools/vscode-ext/databricks-connect',
          note: 'Enable Databricks Connect and debug a .py file.',
        },
        {
          label: 'Run and debug notebook cells',
          url: 'https://docs.databricks.com/aws/en/dev-tools/vscode-ext/notebooks',
          note: 'Globals, magics, and limits for cells in the editor.',
        },
      ],
    },
    {
      id: 'formats',
      heading: 'Notebooks in the editor: .py source or .ipynb',
      prose:
        'Both formats run in the editor and deploy through bundles. They differ in how they diff and in what they carry. Pick one per repository.',
      points: [
        {
          strong: 'Source format is a plain file with markers.',
          text: 'A Python file becomes a Databricks notebook when its first line is # Databricks notebook source, and each cell starts after a # COMMAND ---------- line. The same applies to Scala and SQL files with their comment style. The file diffs line by line and reviews like any script.',
        },
        {
          strong: '.ipynb carries more.',
          text: 'It keeps the notebook environment, visualization definitions, widgets, and optional outputs. It is the default format for new notebooks in the workspace, and GitHub and GitLab render rich diffs for it. The raw JSON is noisy to review without those diff views.',
        },
        {
          strong: 'Choose by who reviews the diff.',
          text: 'If reviewers read diffs in plain pull request views, use source format so a change is a few lines. If your team relies on notebook visualizations and widgets, use .ipynb and turn on rich diffs. Mixing both in one repository makes reviews inconsistent.',
        },
        {
          strong: 'Put reusable logic in modules either way.',
          text: 'A notebook should call functions from a package, not hold them. That keeps the pytest suite small and the notebook diff small. The IDE developer workflow guide covers the layout.',
        },
      ],
      examples: [
        {
          label: 'A source-format notebook',
          language: 'python',
          code: `# Databricks notebook source
# MAGIC %md
# MAGIC # Daily orders

# COMMAND ----------

from my_pkg.transforms import clean_orders

# COMMAND ----------

df = clean_orders(spark.read.table("orders_raw"))
display(df.limit(20))`,
          notes: [
            'The first line makes the file a notebook. Each COMMAND line starts a new cell.',
            'Locally, spark and display come from the extension. On Databricks they are built in.',
          ],
        },
      ],
      links: [
        {
          label: 'Manage Databricks notebook format',
          url: 'https://docs.databricks.com/aws/en/notebooks/notebook-format',
          note: 'Source vs IPYNB, the default setting, and converting.',
        },
        {
          label: 'Import and export notebooks',
          url: 'https://docs.databricks.com/aws/en/notebooks/notebook-export-import',
          note: 'Convert a script file into a notebook.',
        },
      ],
    },
    {
      id: 'environment',
      heading: 'A virtual environment that matches the target',
      prose:
        'Code that passes on your laptop and fails on the cluster usually has a Python or package version gap. Close the gap by building the local environment from the compute you will run on.',
      steps: [
        {
          title: 'Run Set up Python environment',
          body: 'In the Configuration view, click Set up Python environment and choose the compute to match. The extension uses uv (it installs uv if missing) to create a .venv with the Python version and package set of that Databricks Runtime or serverless environment version, and installs a compatible Databricks Connect.',
        },
        {
          title: 'Review the pyproject.toml change',
          body: 'For an existing project, setup merges its changes into pyproject.toml and writes a pyproject.toml.bak backup. Diff the two before you commit.',
        },
        {
          title: 'Re-run it when you switch compute',
          body: 'If you move from a cluster on one runtime to serverless or another runtime, the extension detects the drift and offers to re-run setup.',
        },
        {
          title: 'Or use the CLI',
          body: 'The CLI can build the same environment, which helps in a terminal-only setup or a dev container. It also needs uv on your PATH.',
          code: `databricks environments setup-local --serverless-version 5`,
        },
      ],
      points: [
        {
          strong: 'Pin databricks-connect to the compute.',
          text: 'Use databricks-connect==X.Y.* where X.Y is the runtime version, for example 17.3.*. Databricks recommends the dot-asterisk form so you get the latest patch. Put the pin in pyproject.toml so every contributor and CI gets the same one.',
        },
        {
          strong: 'Using pip, Poetry, or conda?',
          text: 'The extension then shows a step-by-step checklist instead of the automated uv setup. You can also point it at an existing interpreter with the Change virtual environment gear. With Poetry, sync pyproject.toml with the installed version using poetry add databricks-connect==<version>.',
        },
      ],
      links: [
        {
          label: 'Install Databricks Connect for Python',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-connect/python/install',
          note: 'Version selection and install commands.',
        },
      ],
    },
    {
      id: 'tests',
      heading: 'Run pytest from the test explorer',
      prose:
        'Plain functions run in the Testing panel like any Python tests. Tests that need Spark go through Databricks Connect, which needs one extra step.',
      points: [
        {
          strong: 'Local tests need no setup.',
          text: 'Pure-Python tests and DataFrame tests on in-memory data run with the normal Run button in View > Testing.',
        },
        {
          strong: 'Spark tests need the Debug button.',
          text: 'Add a Python Debugger launch configuration with "databricks": true to .vscode/launch.json, then start tests with the debug icon beside the file or test. The docs warn that the plain run button does not use the modified configuration, so the test has no Databricks Connect.',
        },
        {
          strong: 'Run the same suite in CI.',
          text: 'The editor is a convenience. CI runs pytest from the command line against the same pinned databricks-connect, and that run is the one that gates the merge.',
        },
      ],
      examples: [
        {
          label: 'launch.json entry for Spark tests',
          language: 'json',
          code: `{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Unit Tests (on Databricks)",
      "type": "debugpy",
      "databricks": true,
      "request": "launch",
      "program": "\${file}",
      "args": ["."],
      "env": {},
      "console": "integratedTerminal"
    }
  ]
}`,
          notes: ['"databricks": true turns on Databricks Connect for the debug session.'],
        },
      ],
      links: [
        {
          label: 'Run Python tests',
          url: 'https://docs.databricks.com/aws/en/dev-tools/vscode-ext/pytest',
          note: 'Local tests, Databricks Connect tests, and the on-cluster runner.',
        },
      ],
    },
    {
      id: 'ai',
      heading: 'AI help: where Genie Code runs',
      prose:
        'Genie Code, the new name for Databricks Assistant, runs in the workspace: notebooks, the SQL editor, the Lakeflow Pipelines Editor, AI/BI dashboards, and MLflow. The docs do not list VS Code or Cursor as a Genie Code surface, so do not plan around it there.',
      points: [
        {
          strong: 'In the editor, install AI tools for your coding agent.',
          text: 'The extension has an AI tools section in the Configuration view (Beta). Click Install AI tools, pick a scope, and your coding agents get Databricks skills. The extension reports whether they are installed at the global or project scope. The same install is available from the CLI aitools commands.',
        },
        {
          strong: 'Use Genie Code for workspace-side work.',
          text: 'Ask it to explain a failed run, draft a query, or fix an error in a notebook, and it works within your Unity Catalog permissions. You can also mention it in a notebook comment thread.',
        },
      ],
      links: [
        {
          label: 'Genie Code',
          url: 'https://docs.databricks.com/aws/en/genie-code/',
          note: 'Where it runs, requirements, and data sent to the model.',
        },
        {
          label: 'Agent skills for AI coding assistants',
          url: 'https://docs.databricks.com/aws/en/agent-skills/',
          note: 'What the AI tools install gives your agent.',
        },
      ],
    },
    {
      id: 'choose',
      heading: 'When to use VS Code, the workspace editor, or a Git folder',
      prose:
        'They are not rivals. Most teams use all three on one repository, with Git in the middle.',
      table: {
        caption: 'Pick the surface by the task',
        columns: ['Surface', 'Use it for'],
        rows: [
          [
            'VS Code or Cursor',
            'Packages, tests, refactoring across files, debugging with breakpoints, and bundle work. Best for code you review and ship.',
          ],
          [
            'Workspace notebook editor',
            'Exploring data, trying a query on live tables, charts, and quick fixes. Genie Code lives here, and several people can edit one notebook at once.',
          ],
          [
            'Git folder',
            'The workspace copy of the repository. Use it to run notebooks next to your data, switch branches, and commit and push without leaving the workspace.',
          ],
        ],
      },
      points: [
        {
          strong: 'Git carries work between them.',
          text: 'Commit and push from the editor, pull into your Git folder to run it in the workspace, and the reverse. The extension\'s sync folder is not Git and is not a handoff path.',
        },
        {
          strong: 'Keep one source of truth.',
          text: 'Do not edit the same file in the sync folder, a Git folder, and your editor. The Git collaboration guide covers branch handling across them.',
        },
      ],
    },
    {
      id: 'pitfalls',
      heading: 'Pitfalls',
      points: [
        {
          strong: 'Databricks Connect does not match the compute.',
          text: 'Symptoms are import errors, unsupported-feature errors, and Spark Connect protocol errors that vanish on the cluster. Rebuild the environment from the compute with Set up Python environment, and keep the databricks-connect pin in pyproject.toml.',
        },
        {
          strong: 'A stale profile.',
          text: 'The browser sign-in expires or the profile points at the wrong host, and calls fail with authentication errors. Run databricks auth login again for that profile, or choose another one with Auth Type. Check the host in the Configuration view before you deploy.',
        },
        {
          strong: 'Deploying or syncing from the wrong target.',
          text: 'The Target selector decides which workspace receives the deploy. Read the host and deployment mode in the Configuration view before you click deploy, and keep prod deploys in CI. Sync and the cluster override work only in development mode.',
        },
        {
          strong: 'Editing the synced workspace folder.',
          text: 'Sync is one way and the folder is transient, and the extension only works with workspace folders it created. Changes made in the workspace never come back to your project.',
        },
        {
          strong: 'Code that only works locally or only on Databricks.',
          text: 'In a plain .py file, dbutils is not defined. With Databricks Connect, use WorkspaceClient().dbutils, which gives you only the fs and secrets utilities. Notebooks opened in the extension get dbutils for you, and with a subset of utilities. dbutils.widgets needs databricks-sdk[notebook] installed. %pip and %sh in a local notebook run on your machine, not in the workspace. Wrap these calls in a helper so the code runs in both places.',
        },
        {
          strong: 'Using Upload and Run File on serverless.',
          text: 'It is not available there. On serverless, debug with Databricks Connect or run the file as a workflow.',
        },
      ],
      links: [
        {
          label: 'Databricks Utilities with Databricks Connect',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-connect/python/databricks-utilities',
          note: 'What dbutils offers under Databricks Connect.',
        },
        {
          label: 'Databricks IDE extension overview',
          url: 'https://docs.databricks.com/aws/en/dev-tools/vscode-ext/',
          note: 'The landing page for every topic above.',
        },
      ],
    },
  ],
  related: [
    { slug: 'ide-developer-experience', title: 'Developer workflow in the IDE' },
    { slug: 'dab-starter', title: 'Running a Declarative Automation Bundle' },
    { slug: 'git-collaboration', title: 'Collaborating on Databricks projects with Git' },
    { slug: 'github-cicd', title: 'GitHub-based CI/CD' },
    { slug: 'environment-workspaces-catalogs', title: 'Workspaces and catalogs across dev, test, stage, and prod' },
  ],
};
