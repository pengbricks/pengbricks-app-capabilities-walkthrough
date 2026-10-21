import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Which MCP server should I use: Databricks-provided, custom, or external?',
    answer:
      'Use a Databricks-provided server when one fits the job, such as the Genie One MCP server for business questions or the Databricks SQL MCP server for engineering work. Build a custom server on Databricks Apps when you own the tools, and register an external server only when the tool must stay where it is.',
    links: [{ label: 'MCP on Databricks', url: 'https://docs.databricks.com/aws/en/agents/mcp-tools/' }],
  },
  {
    question: 'Should a tool run as the app service principal or as the user?',
    answer:
      "Choose per tool. Run anything tied to a person as the user, so Unity Catalog applies that person's row filters and column masks. Use the service principal with least privilege for shared actions and background work with no user present.",
    links: [
      {
        label: 'Databricks Apps authorization',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth',
      },
    ],
  },
  {
    question: 'Should I deploy new agents on Model Serving?',
    answer:
      'No. Agents on Model Serving and MLflow AgentServer are Legacy. Host new agents on Agent Runtime with DurableAgentServer on Databricks Apps, built with the Agent Bricks CLI, which is Beta.',
    links: [{ label: 'Legacy agent offerings', url: 'https://docs.databricks.com/aws/en/agents/legacy/' }],
  },
  {
    question: 'Can I swap the model behind an agent without changing its code?',
    answer:
      'Yes. Agents call a Unity Gateway model service by its Unity Catalog name, so you can change the primary model, add a fallback, or set rate limits without touching agent code. Rate limits count usage after a response and run per instance, so expect some overshoot.',
    links: [{ label: 'Unity Gateway', url: 'https://docs.databricks.com/aws/en/unity-gateway' }],
  },
  {
    question: 'Does Databricks have an agent-to-agent (A2A) endpoint?',
    answer:
      'The Databricks docs describe none. For multi-agent work, use a supervisor pattern built in code with the Agent Bricks CLI. Supervisor Agent and Knowledge Assistant are Legacy, and Genie Agents cover low-code needs.',
  },
  {
    question: 'How do I know an agent works before and after release?',
    answer:
      'MLflow tracing records each model call, tool call, and handoff as a span. Before release, run mlflow.genai.evaluate on a labeled set to compare versions. After release, add traces with thumbs-down feedback or wrong answers to that set so each incident becomes a regression test.',
    links: [
      {
        label: 'Evaluate and monitor GenAI apps',
        url: 'https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor',
      },
    ],
  },
];
