import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    kind: 'decision',
    question: 'Which Databricks MCP endpoint should an outside assistant use for Genie?',
    answer:
      'Use the Genie One MCP server, system.ai.genie_one_mcp, for most assistants. It is generally available since September 25, 2026 and goes through Unity Gateway. Use the Genie Agent MCP server when one curated agent must be the only source. It is a preview, takes the agent ID in the URL, and skips the gateway.',
    links: [
      { label: 'Genie One MCP server', url: 'https://docs.databricks.com/aws/en/agents/mcp-tools/genie-mcp' },
      { label: 'Genie Agent MCP server', url: 'https://docs.databricks.com/aws/en/agents/mcp-tools/genie-agent' },
    ],
  },
  {
    kind: 'decision',
    question: 'Should users sign in with their own account or should the assistant use a service principal?',
    answer:
      'Use per-user OAuth for any assistant a person types into, so Unity Catalog applies that person’s grants, row filters, and column masks. A service principal gives every caller the same view. Keep it for unattended agents and scheduled workflows with least-privilege grants.',
    links: [{ label: 'Agents, MCP, and model gateway', url: '/walkthroughs/agent-framework-support' }],
  },
  {
    kind: 'tradeoff',
    question: 'Why does ChatGPT or Gemini need an account admin to set up the connection?',
    answer:
      'Databricks MCP endpoints do not support dynamic client registration. A client that cannot register itself needs a client ID from a custom OAuth app connection, and an account admin creates that in the account console under Settings, App connections. Changes can take up to 30 minutes. The vendor side needs its own admin too.',
    links: [
      {
        label: 'Authentication for MCP clients',
        url: 'https://docs.databricks.com/aws/en/agents/mcp-tools/authentication-networking',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'Should I expose a Genie Agent or SQL tools to an outside assistant?',
    answer:
      'Expose Genie for business users. The agent carries curated definitions and returns read-only answers. SQL tools let the assistant run any statement the user may run, so keep them for developer assistants, and note that system.ai.dbsql is Beta.',
    links: [{ label: 'Govern an MCP', url: 'https://docs.databricks.com/aws/en/ai-gateway/govern-mcp-service' }],
  },
  {
    kind: 'tradeoff',
    question: 'What does the Genie app in Teams give up compared with a custom MCP connection?',
    answer:
      'It is the fastest path for Microsoft 365 users, but it is Genie only and in Public Preview since July 17, 2026. It needs an account admin toggle and a Microsoft 365 admin install. A custom MCP connection reaches more tools and more assistants, at the cost of OAuth registration and a connector to maintain.',
    links: [
      { label: 'Genie app in Microsoft Teams', url: 'https://docs.databricks.com/aws/en/integrations/msft-teams' },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'When is a custom MCP server on Databricks Apps worth building?',
    answer:
      'Build one when you own tools that Genie and the managed servers do not cover, such as a write action or a versioned metric API. You control tool names and identity, and you run the app, which bills while it runs. Callers need CAN USE on the app, and the URL ends in /mcp.',
    links: [
      { label: 'Custom MCP servers on Apps', url: 'https://docs.databricks.com/aws/en/agents/mcp-tools/custom-mcp' },
    ],
  },
  {
    question: 'How do I see which outside calls reached Genie?',
    answer:
      'For gateway endpoints such as Genie One, query system.ai_gateway.usage with service_type = MCP_SERVICE. For a Genie Agent endpoint, query system.query.history by query_source.genie_space_id to see executed_as, the warehouse, and client_application.',
    links: [{ label: 'Govern an MCP', url: 'https://docs.databricks.com/aws/en/ai-gateway/govern-mcp-service' }],
  },
  {
    question: 'What does the assistant vendor keep from a Genie answer?',
    answer:
      'The answer, generated SQL, and result rows travel to the assistant, and the vendor’s terms apply from there. Databricks does not document what each vendor retains. Check the policy for the plan you license: OpenAI, Google, Microsoft, or Anthropic.',
    links: [
      { label: 'OpenAI privacy policy', url: 'https://openai.com/policies/privacy-policy/' },
      { label: 'Google privacy policy', url: 'https://policies.google.com/privacy' },
      { label: 'Microsoft privacy statement', url: 'https://privacy.microsoft.com/en-us/privacystatement' },
    ],
  },
  {
    question: 'Which release stages apply today?',
    answer:
      'Genie One MCP is generally available since September 25, 2026, and its Beta endpoint sunsets October 31, 2026. Managed MCP servers have been in Public Preview since January 27, 2026. Genie in Copilot Studio is Public Preview from November 14, 2025, Copilot Cowork is Beta from June 16, 2026, and the Teams app is Public Preview from July 17, 2026.',
    links: [{ label: 'Release notes', url: 'https://docs.databricks.com/aws/en/release-notes/' }],
  },
  {
    question: 'How do I limit what a connected assistant can call?',
    answer:
      'Choose tools when you register the MCP, because unselected tools do not appear in tools/list. Grant EXECUTE on the MCP and USE on its catalog and schema only to the groups that need it. On the assistant side, use includeTools in Gemini CLI or enable only chosen actions in Gemini Enterprise. Set a queries-per-minute limit on tools/call.',
    links: [{ label: 'Govern an MCP', url: 'https://docs.databricks.com/aws/en/ai-gateway/govern-mcp-service' }],
  },
];
