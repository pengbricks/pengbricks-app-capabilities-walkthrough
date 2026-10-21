import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Why not keep a production Git folder updated on every merge?',
    answer:
      'A production Git folder syncs files only. It has no resource definitions, no run_as, and no environment targets, so jobs are changed separately and run identity is whoever owns the job. A bundle carries all of these in one reviewed definition. Databricks still documents the Git folder for teams that deploy only code, such as a notebooks-only project.',
    links: [{ label: 'CI/CD with Databricks Git folders', url: 'https://docs.databricks.com/aws/en/repos/ci-cd' }],
  },
  {
    question: 'How does GitHub sign in to Databricks without a stored secret?',
    answer:
      'Use OIDC workload identity federation. Create a federation policy on the service principal with the GitHub issuer and a subject of repository plus GitHub environment, then grant the job id-token: write. No token or client secret sits in GitHub. Fall back to OAuth M2M only where the CI system cannot present OIDC tokens.',
    links: [
      {
        label: 'Enable workload identity federation for GitHub Actions',
        url: 'https://docs.databricks.com/aws/en/dev-tools/auth/provider-github',
      },
    ],
  },
  {
    question: 'Why use separate service principals for deploying and running?',
    answer:
      'It shrinks the blast radius. The deploy service principal gets little data access, and each production job or pipeline runs as its own service principal through run_as, scoped to the data that workload needs. Only jobs and pipelines support this split.',
    links: [{ label: 'Specify a run identity', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/run-as' }],
  },
  {
    question: 'How does the approval gate work?',
    answer:
      'It is a setting on a GitHub environment, not a step in the YAML. Add required reviewers to the test, stage, and prod environments, and GitHub holds the run until a named person approves. The same commit SHA deploys to every environment.',
  },
  {
    question: 'How do I roll back a bad release?',
    answer:
      'Check out the last known good release and run the deploy workflow on that tag with workflow_dispatch. A redeploy restores job, pipeline, and notebook definitions. Tables keep what the bad release wrote, so use RESTORE TABLE for those.',
  },
  {
    question: 'Does a repository behind a firewall work with Git folders?',
    answer:
      'Yes, with the Git server proxy or Serverless Private Git (Public Preview). Cloud-hosted Git providers need neither.',
  },
];
