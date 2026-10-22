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
];
