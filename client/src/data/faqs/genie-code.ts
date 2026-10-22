import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    kind: 'decision',
    question: 'Should I build the data prep in Lakeflow Designer or with Genie Code?',
    answer:
      'Use Designer when a business user owns the prep and the steps are filter, join, aggregate and derive. Use Genie Code when an engineer or analyst will review and edit code. Genie Code is built into Designer and every visual data prep is backed by generated code, so you can start in one and finish in the other.',
    links: [
      { label: 'Lakeflow Designer: no-code data preparation', url: '/walkthroughs/no-code-data-prep' },
      { label: 'Lakeflow Designer', url: 'https://docs.databricks.com/aws/en/designer/' },
    ],
  },
  {
    kind: 'decision',
    question: 'Agent mode or chat?',
    answer:
      'Agent mode is the default and fits multi-step work, because it runs code, reads output and fixes errors. Ask for chat when you want an explanation or a snippet without actions on your workspace. In either mode, read the code before you run it.',
    links: [{ label: 'Genie Code', url: 'https://docs.databricks.com/aws/en/genie-code/' }],
  },
  {
    kind: 'tradeoff',
    question: 'Why does Genie Code give different code for the same prompt?',
    answer:
      'Model output varies between runs. The prompt and the check are the reproducible parts. Put the table names, the grain, the output name and an assert in the prompt, then compare totals and grain instead of wording.',
    links: [{ label: 'Tips for Genie Code responses', url: 'https://docs.databricks.com/aws/en/genie-code/tips' }],
  },
  {
    kind: 'decision',
    question: 'When can I run generated code without a full review?',
    answer:
      'Read-only profiling and charts can run after a skim. Code that writes a table gets a line-by-line review and a reconciliation. Code that changes a shared object gets a copy, a second reviewer and a test on sample data first. Databricks recommends you always review generated code.',
    links: [{ label: 'Genie Code', url: 'https://docs.databricks.com/aws/en/genie-code/' }],
  },
  {
    question: 'Whose permissions does generated code use?',
    answer:
      'Yours. Genie Code works within your Unity Catalog permissions, so it cannot read a table you cannot read, and row filters and column masks still apply.',
    links: [{ label: 'Genie Code', url: 'https://docs.databricks.com/aws/en/genie-code/' }],
  },
  {
    kind: 'tradeoff',
    question: 'What does Genie Code send to the model?',
    answer:
      'Your prompt and relevant context: table and column names, descriptions, the code you are working with, data samples from tables and cell outputs, within your Unity Catalog permissions. That helps accuracy and means sample rows can leave the notebook, so decide whether that is acceptable for sensitive tables.',
    links: [
      { label: 'Partner-powered AI features', url: 'https://docs.databricks.com/aws/en/databricks-ai/partner-powered' },
    ],
  },
  {
    question: 'Do I need to turn on partner-powered AI features?',
    answer:
      'For Genie Code agentic capabilities, yes: the setting must be on at the account and workspace level, and with it off the agentic capabilities are not available. Genie Code Autocomplete is hosted by Databricks either way. The docs say Databricks will remove the setting on November 1, 2026, and after that you contact your account team to change it.',
    links: [
      { label: 'Partner-powered AI features', url: 'https://docs.databricks.com/aws/en/databricks-ai/partner-powered' },
    ],
  },
  {
    kind: 'decision',
    question: 'Where should I keep the prompts?',
    answer:
      'In Git, in a prompts file next to the check that validates the result. Put stable team rules, such as naming and the default schema, in Genie Code instructions or skills, and keep a copy in Git so a reader can see them.',
    links: [{ label: 'Genie Code instructions', url: 'https://docs.databricks.com/aws/en/genie-code/instructions' }],
  },
  {
    question: 'Does Genie Code build dashboards?',
    answer:
      'The docs say Genie Code can plan and generate production-ready dashboards, and dashboards also offer AI-assisted authoring for individual visualizations. The public pages do not describe a click path for a whole-dashboard draft, so confirm the entry point in your workspace.',
    links: [{ label: 'AI/BI dashboards', url: 'https://docs.databricks.com/aws/en/dashboards/' }],
  },
  {
    question: 'Is there a terminal version?',
    answer:
      'Yes. The Genie Code CLI is in Beta as of October 6, 2026. You start it with the genie command in a project folder. It works with local files, uses the Databricks CLI to discover data and build pipelines, models and apps, and gets model access through Unity Gateway. The docs list Databricks CLI 1.0.0 or later, Unity Catalog, and a Unity Gateway region as requirements, and sign-in through an existing Databricks CLI profile.',
    links: [{ label: 'Genie Code CLI', url: 'https://docs.databricks.com/aws/en/genie-code/genie-code-cli' }],
  },
  {
    kind: 'decision',
    question: 'Should a rule go in instructions, a skill, a tool or a Genie Agent?',
    answer:
      'Use instructions for short rules that apply to every request, such as naming and the default schema. Use a skill for knowledge that applies to one kind of task, because it loads only when the description matches. Use an MCP server or Unity Catalog function when the agent must reach a system or run logic that notebook code cannot. Use a Genie Agent for business questions on stable tables. Instructions cap at 20,000 characters, so move anything long into a skill.',
    links: [
      { label: 'Agent skills', url: 'https://docs.databricks.com/aws/en/genie-code/skills' },
      { label: 'Genie Agents', url: '/walkthroughs/genie-agents' },
    ],
  },
  {
    kind: 'decision',
    question: 'Should skills be per-user or shared across the workspace?',
    answer:
      'Draft in your own folder under /Users/<you>/.assistant/skills, then publish reviewed skills to Workspace/.assistant/skills. Shared skills give one reviewed copy and one place to fix, and they reach everyone in the workspace, so deploy them from Git through CI. The docs describe no group-level scope, so a pilot group means a separate workspace or per-user installs.',
    links: [{ label: 'Agent skills', url: 'https://docs.databricks.com/aws/en/genie-code/skills' }],
  },
  {
    kind: 'tradeoff',
    question: 'Should we allow external MCP servers in Genie Code?',
    answer:
      'Managed connectors and Databricks tools keep the data path small. An external server gives reach to systems with no connector, and it adds a data path, per-user OAuth and a Model Serving region limit. Workspace admins control which servers are available, so start with an approved list, grant Unity Catalog privileges by group and review each server. Unity Gateway can screen MCP tool calls for jailbreaks (Beta, October 21, 2026).',
    links: [{ label: 'Connect to MCP servers', url: 'https://docs.databricks.com/aws/en/genie-code/mcp' }],
  },
  {
    question: 'Does Genie Code have hooks?',
    answer:
      'The public docs and release notes as of October 22, 2026 describe no hooks feature, so there are no documented commands that run before or after an action. The documented alternatives are asserts in the prompt, instructions that require a plan before a write, Unity Catalog permissions that limit writes, scheduled tasks (generally available September 1, 2026) and the Genie Code task in Lakeflow Jobs (generally available October 21, 2026).',
    links: [{ label: 'Genie Code', url: 'https://docs.databricks.com/aws/en/genie-code/' }],
  },
  {
    kind: 'decision',
    question: 'How do we deploy skills from Git, and who needs access?',
    answer:
      'Keep each skill as a folder with a SKILL.md in a repository, review changes in pull requests, and have CI copy merged folders to Workspace/.assistant/skills with the Databricks CLI as a service principal. Workspace admins can grant access to that folder. For Markdown-only skills, workspace import-dir with --overwrite is enough. Skills with .py or .sql scripts are safer with workspace import --format RAW, because import-dir can import those files as notebooks and strip their extensions (the CLI help says notebook extensions are stripped).',
    links: [{ label: 'Agent skills', url: 'https://docs.databricks.com/aws/en/genie-code/skills' }],
  },
  {
    kind: 'tradeoff',
    question: 'Can we see who used Genie Code and what it cost?',
    answer:
      'Partly. Genie budgets set limits at account, workspace and user level. Generated code runs as the user, so table access shows under that user in your existing audit sources. The system.ai_gateway.usage system table added coding-agent session metadata in Public Preview on September 27, 2026, but the docs do not say it records usage from the Genie Code pane. Check what your workspace logs before you promise a report.',
    links: [{ label: 'Genie budgets', url: 'https://docs.databricks.com/aws/en/genie/budgets' }],
  },
];
