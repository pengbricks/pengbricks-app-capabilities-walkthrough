import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Where should I change a value, in a bundle variable or a job parameter?',
    answer:
      'Set it as a bundle variable when it differs by environment, such as the catalog, warehouse ID, or notification address. Job parameters take their defaults from those variables and can be overridden per run with bundle run --params or Run now. Each layer takes its values from the one above it, so you can change a value at the right level without editing the layers below.',
    links: [{ label: 'Bundle variables', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/variables' }],
  },
  {
    question: 'How do I run one ingestion task for many sources without copying it?',
    answer:
      'Use a for_each task. It iterates a JSON list, either static or taken from an upstream task value, and runs one child task per item. Adding a source means adding a name to the list, and you can set concurrency on the for_each task to bound how many sources run at once.',
    links: [
      {
        label: 'Run a parameterized job task in a loop (for_each)',
        url: 'https://docs.databricks.com/aws/en/jobs/for-each',
      },
    ],
  },
  {
    question: 'Should dev, staging, and prod be separate workspaces?',
    answer:
      'Start with a catalog per environment in one workspace and bind catalogs to workspaces when you split. Move to a workspace per environment when prod needs separate admins, networking, or compliance scope. The tradeoff is that a single workspace shares compute, quotas, and settings, so a heavy dev job can compete with prod.',
    links: [
      {
        label: 'Limit catalog access to specific workspaces',
        url: 'https://docs.databricks.com/aws/en/catalogs/binding',
      },
    ],
  },
  {
    question: 'Where should shared ingestion code live?',
    answer:
      'Package it as a Python wheel built by the bundle once more than one job uses it. Move to a package from an internal repository when several bundles or teams need the same release. Source modules deployed with the bundle suit small, single-project code, but each bundle carries its own copy, so a fix does not reach the others.',
    links: [
      {
        label: 'Build a Python wheel with a bundle',
        url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/python-wheel',
      },
    ],
  },
  {
    question: 'How do I give every new project the same layout and CI settings?',
    answer:
      'Write a custom bundle template with databricks_template_schema.json for the prompts and Go-template files for the bundle, jobs, pipeline, and tests. Teams run databricks bundle init with the template path or Git URL. Version the template in Git, tag releases, and have each project pin the version so an upgrade is a pull request.',
    links: [
      { label: 'Custom bundle templates', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/templates' },
    ],
  },
  {
    question: 'What should I do when a new source needs behavior my config cannot express?',
    answer:
      'Add an adapter to the shared package instead of forking a job. If onboarding a source needs a code change, move the difference into configuration or an adapter so the next source stays a config entry plus a review.',
    links: [{ label: 'Metadata-driven ingestion', url: '/walkthroughs/configuration-vs-code' }],
  },
];
