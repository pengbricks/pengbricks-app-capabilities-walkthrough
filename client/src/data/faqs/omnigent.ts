import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Do we need Databricks to use Omnigent?',
    answer:
      'No. Omnigent is open source under Apache 2.0 and runs with your own machine and model keys. Databricks adds identity, governed models, tracing, and a managed server.',
    links: [{ label: 'Omnigent on Databricks', url: 'https://docs.databricks.com/aws/en/omnigent/' }],
  },
  {
    question: 'Should we use the managed service or self-manage on Databricks Apps?',
    answer:
      'Start with the managed service (Beta) when your region supports Unity Gateway. Self-manage on Databricks Apps when you need custom YAML policies, your own provider API keys, custom egress controls, or your region is not covered. Self-managing means you own upgrades and operations.',
    links: [{ label: 'Omnigent on Databricks', url: 'https://docs.databricks.com/aws/en/omnigent/' }],
  },
  {
    question: 'Can a prompt injection talk an agent past a policy?',
    answer:
      'No. The server enforces policies around each action, outside the prompt, so instructions cannot turn a DENY into an ALLOW. A policy that runs after a tool call cannot undo it, so put the gate for destructive actions before the call.',
    links: [{ label: 'Contextual policies', url: 'https://omnigent.ai/docs/policies/overview' }],
  },
  {
    question: 'How do Omnigent policies relate to Unity Gateway?',
    answer:
      'They cover different things. Omnigent policies gate the whole run, including local actions like rm -rf that never cross the network. Unity Gateway governs and audits each request that reaches a model or an MCP service.',
    links: [{ label: 'Unity Gateway', url: 'https://docs.databricks.com/aws/en/unity-gateway/' }],
  },
  {
    question: 'Is it safe to give a teammate Edit access to a session?',
    answer:
      'Only if you trust them with the host. Edit lets a teammate send messages and edit files, and the session runs commands on whatever machine hosts it. Move shared sessions to a sandbox host first. MCP servers, the agent bundle, the permission mode, and the raw shell stay owner-only.',
    links: [{ label: 'Pair programming and permission levels', url: 'https://omnigent.ai/docs/collaborate' }],
  },
  {
    question: 'Is Omnigent ready for production?',
    answer:
      'Not yet for a wide rollout. The project labels itself alpha and the Databricks offering is in Beta. Pilot with a small group and re-check the release notes first. The Databricks Sandbox host is also Beta, and Databricks may purge sandbox data at the end of the Beta period.',
  },
  {
    question: 'Which models can we use?',
    answer:
      'Your own API keys, Claude or ChatGPT plans, compatible gateways, or a Databricks workspace. A Databricks Sandbox host allows only models through Unity Gateway.',
  },
  {
    question: 'Where do the audit records live?',
    answer:
      'Policy decisions are visible in the session. On Databricks, model calls are audited at Unity Gateway, traces go to MLflow Tracing, and data access appears in Unity Catalog audit logs.',
  },
  {
    question: 'GitHub App, fine-grained token, or OAuth: how should users connect GitHub to Omnigent?',
    answer:
      'Use the GitHub App connect on a shared server. Each user authorizes once, Omnigent keeps a short-lived token, and the App permissions cap what a session can do. Use a fine-grained token on one repository for a solo trial on your own host. Install the App on the account that owns the repository, or private repositories return 404 after you connect. The connect flow needs the Omnigent credential store, which encrypts the stored tokens.',
    links: [
      { label: 'Connect GitHub', url: 'https://omnigent.ai/docs/deploy/github-connect' },
      {
        label: 'GitHub App setup',
        url: 'https://github.com/omnigent-ai/omnigent/blob/main/docs/GITHUB_APP_SETUP.md',
      },
    ],
  },
  {
    question: 'Do we need both an Omnigent GitHub connection and a Databricks Git credential?',
    answer:
      'They do different jobs. Omnigent uses its connection to push branches and open pull requests. Databricks needs a Git credential only when the workspace pulls from the repository, for a Git folder or a job that runs from Git. Create the Databricks credential for the identity that runs the code, and prefer a service principal for automation so it does not depend on one person.',
    links: [
      {
        label: 'Connect your Git provider to Databricks',
        url: 'https://docs.databricks.com/aws/en/repos/get-access-tokens-from-git-provider',
      },
    ],
  },
  {
    question: 'Does github_policy stop the agent from deploying to production?',
    answer:
      'No. github_policy governs git and gh commands and GitHub MCP calls, so it limits which repositories and branches the agent writes to. The Databricks CLI is outside it. Limit the deploy with the grants of the identity Omnigent uses, give that identity access to dev only, and pair github_policy with the blast_radius policy so a person approves risky shell commands.',
    links: [{ label: 'Policy guide', url: 'https://github.com/omnigent-ai/omnigent/blob/main/docs/POLICIES.md' }],
  },
  {
    question: 'Why a feature branch and a pull request instead of letting Omnigent push to main?',
    answer:
      'A branch limits the damage and the pull request puts a person between the agent and production. Set write_branches to feature/* so a push to main is blocked, deploy to a dev target first, and merge only after review. The cost is one human review step, which is the point.',
  },
];
