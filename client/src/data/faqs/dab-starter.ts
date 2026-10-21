import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'What permissions do I need to deploy the starter bundle?',
    answer:
      'Your user needs USE CATALOG and CREATE SCHEMA on the catalog you pass in, because the bundle creates its own schema. Serverless compute must also be enabled, since the pipeline and the check notebook run on it and there is no cluster to configure.',
    links: [{ label: 'Install the Databricks CLI', url: 'https://docs.databricks.com/aws/en/dev-tools/cli/install' }],
  },
  {
    question: 'Does bundle deploy read from my Git repo?',
    answer:
      'No. deploy uploads the files in your working folder. Git is where the team reviews and versions the bundle and where CI picks it up, but the CLI does not read from it.',
  },
  {
    question: 'What is different about the dev and prod targets?',
    answer:
      'Dev uses development mode, so names get a [dev <you>] prefix, the schedule is paused, and the schema is dev_<you>_dab_starter. Prod uses production mode, so names have no prefix, the schema is dab_starter, and the daily 06:00 UTC schedule is live. Dev and prod do not share tables.',
    links: [
      { label: 'Deployment modes', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/deployment-modes' },
    ],
  },
  {
    question: 'Should I deploy from the CLI, CI, or the workspace bundle editor?',
    answer:
      'Deploy dev from the CLI or the workspace editor, and deploy every shared target from CI so each release is a reviewed commit. CI runs under a service principal with no personal credentials and leaves a run log. The workspace editor cannot deploy to another workspace, so promotion still goes through CI.',
    links: [
      {
        label: 'Bundles in the workspace',
        url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/workspace-bundles',
      },
    ],
  },
  {
    question: 'How does CI sign in to Databricks without a stored token?',
    answer:
      'The workflow signs in as a service principal through GitHub OIDC, so CI stores no token and no client secret. You add a federation policy to the service principal with the issuer https://token.actions.githubusercontent.com and a subject such as repo:<org>/<repo>:environment:prod. Copy the exact sub from a GitHub run, because newer repositories include numeric IDs in it.',
    links: [
      {
        label: 'Sign in from GitHub Actions with OIDC',
        url: 'https://docs.databricks.com/aws/en/dev-tools/auth/provider-github',
      },
    ],
  },
  {
    question: 'Does redeploying the previous tag undo a bad release?',
    answer:
      'It restores code but not data. A redeploy puts back the job, pipeline, and notebook definitions of that commit, while tables keep what the bad release wrote. Use RESTORE TABLE on Delta history for the tables.',
  },
];
