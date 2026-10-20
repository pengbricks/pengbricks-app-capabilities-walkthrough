import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'reusability-templatization',
  area: 'Ingestion',
  title: 'Reusable ingestion templates',
  intro:
    'Build an ingestion job once and stamp it out for many sources, tenants, and environments. This page covers the layers that carry parameters from deploy time to a single task, how to package shared code and project scaffolding, and how to override settings per target without copying files.',
  shortVersion: [
    {
      title: 'Parameterize in layers.',
      body: 'Bundle variables set values at deploy. Job parameters set them per run. Task parameters pass them on, for_each fans out over a list, and pipeline configuration reaches SQL and Python. Nothing source-specific is hard-coded below the top layer.',
    },
    {
      title: 'Override with targets, not copies.',
      body: 'One bundle holds dev, staging, and prod. Each target overrides variables, run_as, and compute settings. A second copy of a job file is a bug waiting to happen.',
    },
    {
      title: 'Share code as a wheel.',
      body: 'Package common logic as a Python wheel, build it in the bundle, and attach it to jobs and pipelines. Notebooks then hold only the parameters and the call.',
    },
    {
      title: 'Scaffold new projects from a template.',
      body: 'databricks bundle init with a custom template creates a new project with the same layout, jobs, and CI settings. Teams start from a reviewed baseline.',
    },
    {
      title: 'Onboard by configuration.',
      body: 'A new source is a config entry that a check validates in CI. If onboarding needs a code change, move the difference into configuration or an adapter.',
    },
  ],
  sections: [
    {
      id: 'registry',
      heading: 'Parameters at each layer',
      prose:
        'Each layer takes its values from the one above it. A reader can change a value at the right level without editing the layers below.',
      table: {
        caption: 'Where a value is set and how it flows down',
        columns: ['Layer', 'Set when and how'],
        rows: [
          [
            'Bundle variables',
            'At deploy. Declare under variables, set per target, override with --var or a BUNDLE_VAR_ environment variable. Typical values: catalog, schema, warehouse ID, notification address.',
          ],
          [
            'Job parameters',
            'At each run. Defaults come from bundle variables ("${var.catalog}"). Override with bundle run --params, or Run now with different parameters.',
          ],
          [
            'Task parameters',
            'At each task. Reference job parameters with {{job.parameters.name}} and run metadata with {{job.run_id}}.',
          ],
          [
            'for_each inputs',
            'At run time. A task iterates a JSON list, either static or from an upstream task value ({{tasks.name.values.key}}), and runs one child task per item.',
          ],
          [
            'Child job parameters',
            'At run time. A run job task passes parameters to another job, so a parent job can reuse a framework job.',
          ],
          [
            'Pipeline configuration',
            'At deploy. Key-value pairs under configuration are read in SQL as ${key} and in Python with spark.conf.get. Use them for source paths and target names.',
          ],
          [
            'Tags',
            'At deploy. Set custom_tags on jobs and pipelines, and tags on budget policies, so usage and ownership appear in system tables.',
          ],
        ],
      },
      links: [
        { label: 'Bundle variables', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/variables' },
        { label: 'Job parameters', url: 'https://docs.databricks.com/aws/en/jobs/parameters' },
        { label: 'Run a parameterized job task in a loop (for_each)', url: 'https://docs.databricks.com/aws/en/jobs/for-each' },
      ],
    },
    {
      id: 'flow',
      heading: 'How the layers connect',
      diagram: {
        type: 'flow',
        title: 'From deploy-time variable to one task',
        description:
          'A bundle variable is set at deploy and becomes the default of a job parameter. The job parameter is passed to each task. An upstream task writes a list of sources as a task value, and a for-each task runs the shared ingestion task once per item. A pipeline reads its own configuration values set from the same bundle variables.',
        nodes: [
          { id: 'var', label: 'Bundle variables', sub: 'set per target', col: 0, row: 0, kind: 'surface' },
          { id: 'jobp', label: 'Job parameters', sub: 'defaults from variables', col: 1, row: 0 },
          { id: 'taskp', label: 'Task parameters', sub: '{{job.parameters.x}}', col: 2, row: 0 },
          { id: 'list', label: 'Source list', sub: 'task value or static', col: 2, row: 1 },
          { id: 'each', label: 'for_each task', sub: 'one run per item', col: 3, row: 1, kind: 'highlight' },
          { id: 'pipe', label: 'Pipeline configuration', sub: '${key} in SQL', col: 1, row: 1 },
        ],
        edges: [
          { from: 'var', to: 'jobp' },
          { from: 'jobp', to: 'taskp' },
          { from: 'taskp', to: 'list' },
          { from: 'list', to: 'each' },
          { from: 'var', to: 'pipe', dashed: true },
        ],
        legend: [
          { kind: 'surface', label: 'Deploy-time input' },
          { kind: 'highlight', label: 'Fan-out per source' },
        ],
      },
      examples: [
        {
          label: 'Variables to job parameters to a for_each task',
          language: 'yaml',
          code: `variables:
  catalog: { default: dev }
  sources: { default: '["provider_a", "provider_b"]' }

resources:
  jobs:
    ingest:
      parameters:
        - { name: catalog, default: "\${var.catalog}" }
        - { name: sources, default: "\${var.sources}" }
      tasks:
        - task_key: ingest_each
          for_each_task:
            inputs: "{{job.parameters.sources}}"
            task:
              task_key: ingest_one
              notebook_task:
                notebook_path: ../src/ingest.py
                base_parameters:
                  catalog: "{{job.parameters.catalog}}"
                  source: "{{input}}"`,
          notes: [
            'Add a source by adding a name to the list; no task is duplicated.',
            'Set concurrency on the for_each task to bound how many sources run at once.',
          ],
        },
      ],
    },
    {
      id: 'targets',
      heading: 'Override per target, not per copy',
      points: [
        {
          strong: 'One bundle, several targets.',
          text: 'Define dev, staging, and prod under targets. Each overrides only what differs: variables such as catalog, the workspace host, run_as, schedules, and cluster or serverless settings.',
        },
        {
          strong: 'Development mode for dev.',
          text: 'mode: development prefixes resource names with the user and pauses schedules, so developers deploy the same bundle without colliding.',
        },
        {
          strong: 'Run as a service principal in prod.',
          text: 'Set run_as per target so production jobs and pipelines do not depend on one person’s credentials. Deploy from CI with OAuth M2M or workload identity federation.',
        },
        {
          strong: 'Look up IDs by name.',
          text: 'A variable of type lookup resolves a warehouse, cluster policy, or other object by name per workspace, so the same file works in each target.',
        },
      ],
      examples: [
        {
          label: 'Target overrides',
          language: 'yaml',
          code: `targets:
  dev:
    mode: development
    default: true
    variables: { catalog: dev }
  prod:
    mode: production
    workspace: { host: https://<prod-workspace>.cloud.databricks.com }
    variables: { catalog: prod }
    run_as: { service_principal_name: "<service-principal-application-id>" }`,
        },
      ],
      links: [
        { label: 'Declarative Automation Bundles settings', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/settings' },
        { label: 'Deployment modes', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/deployment-modes' },
      ],
    },
    {
      id: 'template',
      heading: 'Templates and shared code',
      prose:
        'Parameters reuse one deployment. Templates and packages reuse the project across teams.',
      points: [
        {
          strong: 'Custom bundle templates.',
          text: 'Write a template with databricks_template_schema.json for the prompts, and Go-template files for the bundle, jobs, pipeline, and tests. Teams run databricks bundle init <git-url-or-path> and get the same layout and CI settings each time. Version the template in Git and tag releases.',
        },
        {
          strong: 'Python wheels for shared logic.',
          text: 'Put validation, adapters, and helpers in a package. Declare it under artifacts with type: whl, build it on bundle deploy, and attach it to a job or pipeline as a dependency. One tested version serves every ingestion job.',
        },
        {
          strong: 'Generated configuration.',
          text: 'When each source needs a config file with the same skeleton, render the files from one spec and run the renderer with a --check flag in CI to fail when committed files drift from the spec.',
        },
        {
          strong: 'Govern shared templates.',
          text: 'Review changes to a template or a wheel like application code. Pin the version each project uses so an upgrade is a pull request, not a surprise.',
        },
      ],
      examples: [
        {
          label: 'Build and attach a wheel',
          language: 'yaml',
          code: `artifacts:
  ingestion_lib:
    type: whl
    build: uv build --wheel
    path: .

resources:
  jobs:
    ingest:
      environments:
        - environment_key: default
          spec:
            environment_version: "4"
            dependencies:
              - ./dist/*.whl
      tasks:
        - task_key: ingest_one
          environment_key: default
          spark_python_task:
            python_file: ../src/main.py`,
          notes: ['Check the current serverless environment version in the docs when you set environment_version.'],
        },
      ],
      links: [
        { label: 'Custom bundle templates', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/templates' },
        { label: 'Build a Python wheel with a bundle', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/python-wheel' },
      ],
    },
    {
      id: 'onboarding',
      heading: 'Onboarding a new source',
      prose:
        'Measure reuse by what a new source costs. The target is a config entry and a review, not a new job.',
      steps: [
        { title: 'Add the source to the spec', body: 'Format, mapping, keys, and rules go in the shared spec or a new file.' },
        { title: 'Render and check', body: 'Run the renderer and the drift check locally. CI runs the same check on the pull request.' },
        { title: 'Deploy', body: 'Deploy the bundle. The for_each list or the pipeline configuration picks the source up with no new job.' },
        {
          title: 'Escalate only when needed',
          body: 'If the source needs behavior the spec cannot express, add an adapter to the shared package instead of forking a job.',
        },
      ],
    },
  ],
  related: [
    { slug: 'configuration-vs-code', title: 'Metadata-driven ingestion' },
    { slug: 'dab-starter', title: 'Running a Declarative Automation Bundle' },
    { slug: 'batch-real-time-ingestion', title: 'Batch and streaming ingestion' },
  ],
};
