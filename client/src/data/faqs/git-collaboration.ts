import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Can several people share one Git folder?',
    answer:
      'No. Switching the branch changes it for everyone with access, and uncommitted work mixes. Give each person a folder under their own user area and have them work on a short-lived branch. To share a setup, use Share > Copy link to create Git folder so a collaborator clones their own.',
  },
  {
    question: 'Which Git credential should I use?',
    answer:
      'Link the Databricks GitHub app for hosted GitHub, use a scoped personal access token for providers without OAuth linking, and run every job and pipeline as a service principal with its own Git credential. GitHub Enterprise Server cannot link the app, and Azure DevOps does not accept Microsoft Entra ID tokens for Git folders.',
    links: [
      {
        label: 'Connect your Git provider to Databricks',
        url: 'https://docs.databricks.com/aws/en/repos/get-access-tokens-from-git-provider',
      },
    ],
  },
  {
    question: 'How do I connect a private or on-premises Git server?',
    answer:
      'Use the Git server proxy, which routes Git commands through a compute resource in your workspace. Serverless Private Git, in Public Preview, does the same through serverless compute and private connectivity. Cloud-hosted providers on the public internet need neither.',
    links: [{ label: 'Git server proxy for Git folders', url: 'https://docs.databricks.com/aws/en/repos/git-proxy' }],
  },
  {
    question: 'Are notebook outputs committed to Git?',
    answer:
      'Not for source-format notebooks (.py, .sql, .scala, .r). For .ipynb, output commits are off by default, and a workspace admin must allow them. Leave them off unless you have a reason, because outputs can hold query results with real data.',
    links: [
      {
        label: 'Manage Databricks notebook format',
        url: 'https://docs.databricks.com/aws/en/notebooks/notebook-format',
      },
    ],
  },
  {
    question: 'Should production code live in a Git folder?',
    answer:
      'No. Databricks recommends Declarative Automation Bundles for CI/CD and production deployments. A merge to main deploys through CI under a service principal. A production Git folder that people edit drifts from main, so use one only if you deploy without bundles, and then give people Can Run only.',
    links: [{ label: 'CI/CD with Databricks Git folders', url: 'https://docs.databricks.com/aws/en/repos/ci-cd' }],
  },
  {
    question: 'What size limits apply to a Git folder?',
    answer:
      'Working branches are limited to 1 GB, and each Git operation supports up to 2 GB of memory and 4 GB of disk writes. Databricks recommends keeping workspace assets and files under 20,000, and the UI will not display files over 10 MB. For large monorepos, use sparse checkout or split the repository.',
    links: [{ label: 'Git folder limits and reference', url: 'https://docs.databricks.com/aws/en/repos/limits' }],
  },
];
