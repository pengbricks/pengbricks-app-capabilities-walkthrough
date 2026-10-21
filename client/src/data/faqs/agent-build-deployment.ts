import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Is the Agent Bricks CLI ready for production?',
    answer:
      'It is Beta, so expect changes and check the release notes. It is still the current path for new custom agents, which deploy to Agent Runtime on Databricks Apps.',
    links: [
      {
        label: 'Agent Bricks CLI',
        url: 'https://docs.databricks.com/aws/en/agents/custom-agents/agent-bricks-cli',
      },
    ],
  },
  {
    question: 'We already deploy agents to Model Serving. What should we do?',
    answer:
      'Build new agents on Agent Runtime. Model Serving agents are Legacy as of October 12, 2026, so leave existing ones running only until you can follow the documented migration. Move the tools and resources into agent.toml and rerun your evaluation set against the new deployment before switching traffic.',
    links: [{ label: 'Legacy agent offerings', url: 'https://docs.databricks.com/aws/en/agents/legacy/' }],
  },
  {
    question: 'What does Agent Runtime on Apps give me that I would otherwise build?',
    answer:
      'A stable OAuth-protected URL, an agent identity, durable run state, tracing, and 1 to 5 instances. The recommended agent server, DurableAgentServer, serves synchronous, streaming, and background runs from one invocation API and recovers runs that a crash interrupted.',
    links: [{ label: 'Agent Runtime', url: 'https://docs.databricks.com/aws/en/agents/deploy/agent-runtime' }],
  },
  {
    question: 'How big should the evaluation set be, and what gates a release?',
    answer:
      'Start with 30 to 100 realistic questions, including hard cases, refusals, and questions with no answer. Score them with mlflow.genai.evaluate, set a minimum per scorer, and fail the deploy step below it. Keep the gate in CI so a promotion needs a passing run on record.',
    links: [
      {
        label: 'Evaluate and monitor GenAI apps',
        url: 'https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor',
      },
    ],
  },
  {
    question: 'What access does the deployed agent have?',
    answer:
      "It runs as its app's service principal. Grant that principal EXECUTE on the functions, SELECT on the tables, and CAN USE on the warehouse it needs, and nothing more. Use user authorization for tools that must run as the caller.",
    links: [
      {
        label: 'Databricks Apps authorization',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth',
      },
    ],
  },
  {
    question: 'Why should my tools be idempotent?',
    answer:
      'DurableAgentServer can start a replacement attempt after a crash, and clients retry with an invocation ID. A tool that writes should tolerate being called twice with the same input.',
  },
];
