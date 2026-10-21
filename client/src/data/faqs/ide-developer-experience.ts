import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Should I run Databricks Connect on serverless or on a cluster?',
    answer:
      'Default to serverless. There is no cluster to start or keep warm. Move to a cluster only when you need libraries, init scripts, instance types, or GPUs that serverless does not allow.',
    links: [
      {
        label: 'Databricks Connect cluster and serverless configuration',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-connect/cluster-config',
      },
    ],
  },
  {
    question: 'What does not work over Databricks Connect?',
    answer:
      'Libraries that reach the Spark JVM or RDDs do not work over Spark Connect, and on serverless, Python UDFs cannot ship custom libraries. Keep that code behind a thin wrapper you can skip locally.',
    links: [
      {
        label: 'Limitations of Databricks Connect for Python',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-connect/python/limitations',
      },
    ],
  },
  {
    question: 'How do I make code testable with pytest?',
    answer:
      'Put logic in functions in a module, not only in a notebook. Pure-Python rules need no Spark, and DataFrame functions take a DataFrame in and return one. Create the Spark session once in a session-scoped fixture so the suite pays the connection cost once.',
    links: [
      {
        label: 'Databricks Connect testing',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-connect/python/testing',
      },
    ],
  },
  {
    question: 'When should shared code be a wheel instead of workspace files?',
    answer:
      'Use a wheel once more than one job or team shares the code, because it gives one version, one test suite, and one install path. Workspace-file modules work inside a single repository, and %run is for prototypes you plan to replace.',
    links: [
      {
        label: 'Build a Python wheel with a bundle',
        url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/python-wheel',
      },
    ],
  },
  {
    question: 'Where do Git folders fit if I work in an IDE?',
    answer:
      'Git folders put the same repository in the workspace for exploration and review. Notebook edits and IDE edits go through the same branches and pull requests. Use a service principal and a production Git folder only if you deploy code without bundles.',
    links: [{ label: 'Git folders', url: 'https://docs.databricks.com/aws/en/repos' }],
  },
  {
    question: 'How should CI authenticate to Databricks?',
    answer:
      'Use OAuth workload identity federation instead of a stored token. On each pull request, CI runs ruff, pytest, and databricks bundle validate.',
    links: [
      { label: 'GitHub Actions with Databricks', url: 'https://docs.databricks.com/aws/en/dev-tools/ci-cd/github' },
    ],
  },
];
