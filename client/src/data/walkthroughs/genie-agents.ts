import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'genie-agents',
  area: 'AI Guides',
  title: 'Genie Agents: setup, instructions, and data handling',
  intro:
    'A Genie Agent answers business questions over Unity Catalog data in plain language. This page covers how to create one, how to write the instructions that decide its accuracy, which compute and identity run each question, and what Databricks stores about the agent and its conversations. Rollout and benchmarks are in the assistant user experience guide, and metric views and synonyms are in the business terms guide.',
  shortVersion: [
    {
      title: 'One agent per business domain.',
      body: 'Attach a few gold tables or one metric view, aim for five sources or fewer, and hide columns the domain does not need. The hard limit is 50 tables, views, or metric views.',
    },
    {
      title: 'Put definitions in SQL.',
      body: 'Revenue belongs in a metric view or a SQL expression. Example SQL covers the hard questions. Text instructions carry only defaults, clarification rules, and formatting.',
    },
    {
      title: 'The warehouse runs the SQL; the asker owns the data access.',
      body: 'The agent runs read-only SQL on a pro or serverless SQL warehouse using the author’s embedded credential. Unity Catalog checks every table against the asking user, so grants, row filters, and column masks apply.',
    },
    {
      title: 'Conversations live in the control plane.',
      body: 'The definition, messages, generated SQL, and feedback are stored by Databricks. Query results expire after seven days. The data itself stays in Unity Catalog and is never copied into the agent.',
    },
    {
      title: 'Create it in the UI, then keep it in Git.',
      body: 'Iterate in the UI with Genie Code. Move the final definition into a bundle with the genie_spaces resource, or script it with the REST API.',
    },
    {
      title: 'Test as a non-admin before anyone else does.',
      body: 'Admins and authors see more than users do. Ask the benchmark questions as a user with only CAN RUN and the Unity Catalog grants you plan to give.',
    },
  ],
  sections: [
    {
      id: 'what-it-is',
      heading: 'What a Genie Agent is',
      prose:
        'A Genie Agent is a chat interface over governed data. Users ask in natural language and get a generated SQL query, a results table, and often a chart. Data analysts configure each agent with Unity Catalog data, example SQL, and instructions. The name changed from Genie Spaces to Genie Agents, and the API paths still say spaces.',
      diagram: {
        type: 'flow',
        title: 'From question to governed data',
        description:
          'A business user asks a question. The Genie Agent sends the question and its curated context to a large language model, which writes SQL. A SQL warehouse runs the SQL against Unity Catalog tables with the asking user’s permissions. The author defines the agent and saves a warehouse credential that lets the warehouse run it.',
        nodes: [
          { id: 'user', label: 'Business user', sub: 'Genie One or the API', col: 0, row: 0, kind: 'surface' },
          { id: 'agent', label: 'Genie Agent', sub: 'instructions, examples', col: 1, row: 0, kind: 'highlight' },
          { id: 'llm', label: 'LLM', sub: 'writes the SQL', col: 2, row: 0 },
          { id: 'wh', label: 'SQL warehouse', sub: 'runs read-only SQL', col: 3, row: 0 },
          { id: 'uc', label: 'Unity Catalog', sub: 'asker’s grants apply', col: 4, row: 0, kind: 'store' },
          { id: 'author', label: 'Author', sub: 'CAN EDIT or CAN MANAGE', col: 1, row: 1 },
        ],
        edges: [
          { from: 'user', to: 'agent', label: 'question' },
          { from: 'agent', to: 'llm', label: 'context' },
          { from: 'llm', to: 'wh', label: 'SQL' },
          { from: 'wh', to: 'uc', label: 'as the asker' },
          { from: 'author', to: 'agent', label: 'defines' },
          { from: 'author', to: 'wh', label: 'compute credential', dashed: true },
        ],
        legend: [
          { kind: 'surface', label: 'Where users ask' },
          { kind: 'highlight', label: 'What you curate' },
          { kind: 'store', label: 'Governed data' },
        ],
      },
      table: {
        caption: 'The Genie family',
        columns: ['Name', 'What it is'],
        rows: [
          ['Genie Agents', 'Domain agents that data teams configure with data, SQL, and instructions. Formerly Genie Spaces.'],
          ['Genie One', 'The interface for business users to find and ask agents, dashboards, and apps. It routes questions to the agents a user can access.'],
          ['Genie Code', 'The assistant for developers and analysts inside the workspace. When you create an agent, Genie Code suggests descriptions and example queries for you to accept or reject.'],
        ],
      },
      points: [
        {
          strong: 'Chat mode answers with one SQL query.',
          text: 'Agent mode (formerly Research Agent) plans, runs several queries, and writes a report. It can also read Unity Catalog volumes and MCP connectors.',
        },
        {
          strong: 'Genie reads only what you attach.',
          text: 'It does not query tables or functions that are missing from the agent’s sources, even when an instruction mentions them.',
        },
      ],
      links: [
        { label: 'Genie overview', url: 'https://docs.databricks.com/aws/en/genie/', note: 'Genie One, Genie Agents, and Genie Code.' },
        { label: 'Genie Agents concepts', url: 'https://docs.databricks.com/aws/en/genie-agents/concepts', note: 'How a response is generated.' },
      ],
    },
    {
      id: 'compute',
      heading: 'How the compute works',
      prose:
        'Genie uses two separate credentials. Compute access comes from the author, and data access comes from the person asking.',
      points: [
        {
          strong: 'The SQL runs on a pro or serverless SQL warehouse.',
          text: 'Classic warehouses are not supported. Databricks recommends serverless, which starts quickly and scales clusters with the queue. Generated queries are read-only, and the warehouse handles retries, concurrency, and scale.',
        },
        {
          strong: 'The author’s credential opens the warehouse.',
          text: 'Saving the warehouse selection embeds the author’s compute credential in the agent, so users need no warehouse permission. If another author changes the warehouse, that author’s credential replaces it. Only the author needs CAN USE on the warehouse.',
        },
        {
          strong: 'The asker’s identity decides the data.',
          text: 'Unity Catalog evaluates every table as the person who asked. Row filters and column masks apply, a question about data the user cannot see returns an empty answer, and query history attributes the statement to that user.',
        },
        {
          strong: 'Size for the busiest hour.',
          text: 'Start with one serverless warehouse, larger rather than smaller (Databricks says it is easier to size down than to scale up), and set the maximum cluster count for peak concurrency. Watch Peak Queued Queries on the warehouse monitoring page and queue time in query history during the pilot. Agent mode runs several queries per question, so it needs more headroom than Chat mode. If queries spill to disk, raise the cluster size.',
        },
        {
          strong: 'The LLM runs on Databricks-managed endpoints.',
          text: 'With the partner-powered AI features setting on, Chat mode uses Azure OpenAI Service and OpenAI on Databricks, and Agent mode uses OpenAI and Anthropic models on Databricks. With the setting off, Chat mode is not available. Partners keep no prompts or responses and Databricks does not train on them. The setting is being removed on November 1, 2026, and each workspace keeps its current value.',
        },
        {
          strong: 'Data sent to the model respects Unity Catalog.',
          text: 'Genie sends the prompt, table and column names and descriptions, relevant values, instructions, example SQL, and function definitions the asker can access. Genie Agents are Designated Services, so they follow Geo data residency. When cross-Geo processing is enabled, requests can run outside the workspace’s Geo, and some features, such as Agent mode Flash, need it outside the US and EU.',
        },
        {
          strong: 'Billing has two parts.',
          text: 'Warehouse DBUs bill as SQL compute. Genie’s LLM usage bills separately and appears in system.billing.usage with billing_origin_product = GENIE and usage_metadata.genie.surface = GENIE_AGENTS. Usage by users is free through January 31, 2027, under the GENIE_FREE_USAGE SKU. Service principals are billed.',
        },
      ],
      links: [
        { label: 'Create and manage a Genie Agent', url: 'https://docs.databricks.com/aws/en/genie-agents/set-up', note: 'Warehouse, credentials, and permissions.' },
        { label: 'Size and scale a SQL warehouse', url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/warehouse-behavior' },
        { label: 'Partner-powered AI features', url: 'https://docs.databricks.com/aws/en/databricks-ai/partner-powered', note: 'Which provider hosts each feature.' },
        { label: 'AI assistive features trust and safety', url: 'https://docs.databricks.com/aws/en/databricks-ai/databricks-ai-trust', note: 'What is sent to the models and where.' },
        { label: 'Designated Services', url: 'https://docs.databricks.com/aws/en/resources/designated-services' },
        { label: 'Monitor and understand your Genie cost', url: 'https://docs.databricks.com/aws/en/genie/monitor-cost' },
      ],
    },
    {
      id: 'stored',
      heading: 'What Databricks stores, and where',
      prose:
        'The agent stores its own definition and the conversations. It never stores your table data. A few derived values, such as entity matching lists, sit in your workspace storage.',
      diagram: {
        type: 'flow',
        title: 'What is stored where',
        description:
          'The Genie Agent writes its definition, conversations, generated SQL, and feedback to the Databricks control plane database. Entity matching values go to the workspace storage bucket. The SQL warehouse reads Unity Catalog tables, which stay where they are, and each statement is logged in system tables.',
        nodes: [
          { id: 'agent', label: 'Genie Agent', sub: 'definition and chats', col: 0, row: 1, kind: 'highlight' },
          { id: 'cp', label: 'Control plane database', sub: 'chats, SQL, feedback', col: 1, row: 0, kind: 'store' },
          { id: 'bucket', label: 'Workspace storage', sub: 'entity matching values', col: 1, row: 1, kind: 'store' },
          { id: 'wh', label: 'SQL warehouse', sub: 'runs the SQL', col: 1, row: 2 },
          { id: 'uc', label: 'Unity Catalog tables', sub: 'data is never copied', col: 2, row: 2, kind: 'store' },
          { id: 'sys', label: 'System tables', sub: 'query history, billing', col: 2, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'agent', to: 'cp', label: 'writes' },
          { from: 'agent', to: 'bucket', label: 'writes' },
          { from: 'agent', to: 'wh', label: 'SQL' },
          { from: 'wh', to: 'uc', label: 'reads' },
          { from: 'wh', to: 'sys', label: 'logs each statement' },
        ],
        legend: [
          { kind: 'highlight', label: 'The agent' },
          { kind: 'store', label: 'Where data sits' },
        ],
      },
      table: {
        caption: 'What each piece is, and who can reach it',
        columns: ['Item', 'Where it lives and who sees it'],
        rows: [
          ['Definition: tables, instructions, example SQL, sample questions, benchmarks', 'Control plane. Anyone with CAN EDIT or CAN MANAGE edits it. Export it as JSON through the API.'],
          ['Conversations and messages, including generated SQL, descriptions, and feedback', 'Control plane database, AES-256 encrypted. Stored until the user, a manager, or the agent is deleted.'],
          ['Who sees other people’s conversations', 'Users with CAN MANAGE see every prompt on the Monitor tab. They see full conversations and results only when the user set the chat to Reviewable by agent managers, which is the default for new chats. Private chats show prompts only.'],
          ['Query results', 'Kept for seven days. After that the message reports QUERY_RESULT_EXPIRED; regenerate the answer or rerun the SQL.'],
          ['Entity matching values', 'Your workspace storage bucket. Up to 120 columns, 1,024 values per column, 127 characters each. Genie skips tables with row filters and columns with masks.'],
          ['Statements the agent ran', 'system.query.history, with query_source.genie_space_id set. The statement text is redacted unless you are an account admin or in databricks_pii_access.'],
          ['Audit events', 'Audit logs, service name aibiGenie for Genie Agents and genieChat for Genie One chats.'],
        ],
      },
      points: [
        {
          strong: 'To delete: a user deletes their chat; a manager deletes any chat.',
          text: 'Managers use the Monitor tab. Scripts use DELETE /api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}. Deleting an agent deletes its conversation history for good.',
        },
        {
          strong: 'Customer-managed keys.',
          text: 'The trust page states AES-256 encryption for the control plane database and mentions customer-managed keys only for Databricks-hosted models. Check with your account team before you promise CMK coverage for Genie conversations.',
        },
      ],
      links: [
        { label: 'Use a Genie Agent to explore business data', url: 'https://docs.databricks.com/aws/en/genie-agents/talk-to-genie', note: 'Chat history, sharing, and result retention.' },
        { label: 'Test and monitor a Genie Agent', url: 'https://docs.databricks.com/aws/en/genie-agents/monitor', note: 'Monitor tab, conversation review, and deleting chats.' },
        { label: 'Query history system table', url: 'https://docs.databricks.com/aws/en/admin/system-tables/query-history' },
        { label: 'Audit log reference', url: 'https://docs.databricks.com/aws/en/admin/account-settings/audit-logs' },
      ],
    },
    {
      id: 'create',
      heading: 'Create the agent: UI, REST API, or bundle',
      prose:
        'Use the UI to explore, and the API or a bundle once the definition settles. All three produce the same object.',
      steps: [
        {
          title: 'UI',
          body: 'Open Genie Agents in the sidebar, click New, choose tables or metric views, and click Create. Genie Code opens with suggested descriptions and example queries. Under Configure, Settings, pick the default warehouse, then set a title, description, and common questions.',
        },
        {
          title: 'REST API',
          body: 'POST /api/2.0/genie/spaces with title, description, warehouse_id, and serialized_space, a JSON string. Use version 2, 32-character lowercase hex IDs, sorted collections, and at most one text instruction. PATCH the same path to update.',
        },
        {
          title: 'Bundle',
          body: 'Declare a genie_spaces resource. It needs the direct deployment engine, the default for new bundles on CLI 1.3.0 and later. Put serialized_space inline as YAML or point file_path at a .geniespace.json file. Run databricks bundle generate genie-space --existing-id <id> to pull a UI-built agent into the bundle.',
        },
      ],
      examples: [
        {
          label: 'A genie_spaces bundle resource',
          language: 'yaml',
          code: `resources:
  genie_spaces:
    sales_agent:
      title: Sales questions
      description: Revenue and customers by region, segment, and channel.
      warehouse_id: \${var.warehouse_id}
      serialized_space:
        version: 2
        config:
          sample_questions:
            - id: "0a1b2c3d4e5f60718293a4b5c6d7e8f9"
              question: ["What is revenue by sales channel?"]
        data_sources:
          metric_views:
            - identifier: \${var.catalog}.\${var.schema}.sales_metrics
        instructions:
          text_instructions:
            - id: "1b2c3d4e5f60718293a4b5c6d7e8f90a"
              content: ["Show business names, never codes. Round money to two decimals."]
      permissions:
        - level: CAN_RUN
          group_name: users`,
          notes: [
            'Quote the IDs. An all-digit hex ID parses as a number in YAML and the API rejects it.',
            'In a development-mode target the title gets a [dev <user>] prefix.',
            'The agent needs its tables to exist at deploy time, so create the data first or deploy it from a later pipeline step.',
          ],
        },
      ],
      table: {
        caption: 'Permissions to set',
        columns: ['Who', 'What they need'],
        rows: [
          ['Author', 'Databricks SQL entitlement, CAN USE on a pro or serverless warehouse, SELECT on the data, and CAN EDIT on the agent. The creator gets CAN MANAGE.'],
          ['Business user', 'Consumer access or the Databricks SQL entitlement, SELECT on every table in the agent, EXECUTE on any SQL function, and CAN RUN on the agent. No warehouse permission.'],
          ['CAN VIEW and CAN RUN', 'Both let a user see the agent, ask questions, give feedback, and upload files.'],
          ['CAN EDIT', 'Adds instructions, sample questions, and tables, and running benchmarks.'],
          ['CAN MANAGE', 'Adds the Monitor tab, sharing, deleting the agent, and viewing other users’ conversations.'],
        ],
      },
      links: [
        { label: 'Create and manage a Genie Agent', url: 'https://docs.databricks.com/aws/en/genie-agents/set-up' },
        { label: 'Genie Agents API', url: 'https://docs.databricks.com/aws/en/genie-agents/conversation-api', note: 'The serialized_space format and validation rules.' },
        { label: 'Bundle resources: genie_spaces', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/resources' },
        { label: 'Access control lists', url: 'https://docs.databricks.com/aws/en/security/auth/access-control/', note: 'The Genie Agent ACL table.' },
      ],
    },
    {
      id: 'instructions',
      heading: 'Write instructions that Genie follows',
      prose:
        'Treat Genie as a new analyst. Give it structure first and prose last. The order below follows how reliably each input changes the SQL Genie writes.',
      diagram: {
        type: 'flow',
        title: 'Where each kind of context belongs',
        description:
          'Five kinds of context in priority order: Unity Catalog comments for what data means, a metric view for measures and joins, SQL expressions for business terms, example SQL for hard questions, and text instructions as the last resort.',
        nodes: [
          { id: 'uc', label: 'UC comments', sub: 'what a column means', col: 0, row: 0, kind: 'store' },
          { id: 'mv', label: 'Metric view', sub: 'measures and joins', col: 1, row: 0, kind: 'highlight' },
          { id: 'expr', label: 'SQL expressions', sub: 'terms, filters, fields', col: 2, row: 0 },
          { id: 'ex', label: 'Example SQL', sub: 'hard questions', col: 3, row: 0 },
          { id: 'text', label: 'Text instructions', sub: 'defaults, tone, asking', col: 4, row: 0 },
        ],
        edges: [
          { from: 'uc', to: 'mv' },
          { from: 'mv', to: 'expr' },
          { from: 'expr', to: 'ex' },
          { from: 'ex', to: 'text' },
        ],
        caption: 'Reach for the next box only when the previous one cannot say it.',
      },
      table: {
        caption: 'Each kind of context',
        columns: ['Input', 'How to write it'],
        rows: [
          ['Unity Catalog comments', 'State what each column holds, its units, and what each code means: "seg_cd: E = Enterprise, M = Mid-Market, S = SMB". Do this once in Unity Catalog so dashboards, notebooks, and every agent benefit. Review AI-generated comments before you keep them.'],
          ['Metric view', 'Define revenue, active customers, and average order value once, with joins, filters, and synonyms. The agent then uses MEASURE() and cannot drift from the definition.'],
          ['Agent-level metadata', 'In the agent, add column descriptions and synonyms, hide columns, and turn on format assistance and entity matching. These stay in the agent and do not change Unity Catalog.'],
          ['SQL expressions', 'Name a measure, filter, or field with synonyms and one line of guidance, such as "High-value orders: amount > 10000". They count against the 200-snippet limit.'],
          ['Example SQL', 'Title each with the question as a user would ask it, and show the logic that is specific to your data. Add parameters for values that change, with a type and a comment. A parameterized query that Genie uses verbatim returns a verified answer.'],
          ['SQL functions', 'Register a Unity Catalog function for logic you do not want Genie to see or change. Users need EXECUTE on it.'],
          ['Join relationships', 'Define them when tables are not joined in a view. Choose one-to-one, one-to-many, or many-to-one. Primary and foreign keys in Unity Catalog become join relationships automatically. A metric view makes most of these unnecessary.'],
          ['Sample questions', 'A few starter prompts that show users what the agent covers. Use the questions the pilot cohort asks.'],
          ['Text instructions', 'One block that applies to every question: the default year, when to ask a clarifying question, rounding, and language. Keep it short.'],
        ],
      },
      points: [
        {
          strong: 'Name a trigger, an action, and the exact words.',
          text: 'Put clarification rules at the end of the text block, where Genie weighs them most. Never let two sources disagree: if the text says round to two decimals, every example query must too.',
        },
        {
          strong: 'An example can override the text.',
          text: 'In an early draft of the reference agent, an example query with no date parameters answered a vague revenue question directly and skipped the clarifying question the text asked for. Adding date parameters to the example fixed it.',
        },
        {
          strong: 'Customize summaries with a dedicated heading.',
          text: 'Add a section titled "Instructions you must follow when providing summaries" at the end of the text block. Only text instructions change summaries.',
        },
      ],
      examples: [
        {
          label: 'Weak and strong, side by side',
          language: 'text',
          code: `Weak:   Be accurate about revenue.
Strong: (metric view) Revenue = SUM(net_amt) FILTER (WHERE ord_st = 'C'), synonyms: sales, net sales

Weak:   Ask clarifying questions when needed.
Strong: When a question asks for revenue, orders, or customers without a period, ask:
        "Which period do you want, for example Q3 2026 or August 2026?"

Weak:   Handle dates properly.
Strong: Orders run from 2026-07-01 to 2026-09-30. When a question names a month or
        quarter without a year, use 2026.

Weak:   Format the output well.
Strong: Show business names, never codes. Round money to two decimals.

Weak:   (a 40-line glossary pasted into the text block)
Strong: Column comments in Unity Catalog, plus synonyms in the metric view.`,
        },
        {
          label: 'A join relationship in serialized_space',
          language: 'json',
          code: `"join_specs": [
  {
    "id": "2c3d4e5f60718293a4b5c6d7e8f90a1b",
    "left":  { "identifier": "sales.analytics.orders",    "alias": "orders" },
    "right": { "identifier": "sales.analytics.customers", "alias": "customers" },
    "sql": [
      "\`orders\`.\`customer_id\` = \`customers\`.\`customer_id\`",
      "--rt=FROM_RELATIONSHIP_TYPE_MANY_TO_ONE--"
    ],
    "comment": ["Join orders to customers on customer_id"]
  }
]`,
          notes: ['The sql field takes exactly two elements: the condition and the relationship type.'],
        },
      ],
      links: [
        { label: 'Tune Genie Agent quality', url: 'https://docs.databricks.com/aws/en/genie-agents/tune-quality', note: 'Example SQL, functions, joins, SQL expressions, and prompt matching.' },
        { label: 'Curate an effective Genie Agent', url: 'https://docs.databricks.com/aws/en/genie-agents/best-practices' },
        { label: 'Unity Catalog metric views', url: 'https://docs.databricks.com/aws/en/metric-views/' },
      ],
    },
    {
      id: 'limits',
      heading: 'Limits to design around',
      table: {
        columns: ['Limit', 'Value'],
        rows: [
          ['Tables, views, and metric views per agent', '50. Aim for five or fewer.'],
          ['Instructions per agent', '100. Each example query, each SQL function, and the whole text block counts as one.'],
          ['Knowledge store snippets', '200, shared by table descriptions, join relationships, and SQL expressions.'],
          ['Text instruction blocks through the API', '1'],
          ['Conversations per agent and messages per conversation', '200,000 and 10,000'],
          ['Benchmark questions', '500 per agent. Benchmark result details stay visible for one week.'],
          ['Strings and repeated fields in serialized_space', '25,000 characters and 10,000 items'],
          ['Query results kept', 'Seven days'],
        ],
      },
      prose:
        'Too many instructions lower accuracy, especially in long conversations, because Genie struggles to rank them. Prune before you add.',
    },
    {
      id: 'practices',
      heading: 'Best practices',
      table: {
        columns: ['Practice', 'What to do and why'],
        rows: [
          ['Scope one agent to one business domain', 'Sales, support, or finance, each with a small curated table set. A narrow agent has less to confuse and fewer columns to misread.'],
          ['Curate the sources', 'Prefer metric views or gold tables. Pre-join and aggregate in a view so Genie writes simpler SQL and the warehouse scans less.'],
          ['Start with example SQL for the top questions', 'Add five tested queries for what people ask most. Examples change the SQL more than text does.'],
          ['Benchmark before rollout', 'Save real questions with gold SQL, at least five to start and two to four phrasings of each, and rerun after every change.'],
          ['Review feedback weekly', 'Feedback does not change the agent by itself. Turn each flagged answer into an expression, an example, or a comment.'],
          ['Grant least privilege', 'Share with groups at CAN RUN, grant SELECT only on the attached tables, and use row filters and column masks for per-user limits.'],
          ['Use a serverless warehouse sized for concurrency', 'Set the maximum clusters for the busiest hour and watch queued queries.'],
          ['Version the definition in Git', 'Keep it in a bundle, deploy from a service principal, and promote dev to prod. Do not edit the production agent in the UI.'],
          ['Test as a non-admin', 'Ask the benchmark questions as a user with only CAN RUN and the planned grants, and check that masked or filtered data behaves as expected.'],
        ],
      },
      links: [
        { label: 'Curate an effective Genie Agent', url: 'https://docs.databricks.com/aws/en/genie-agents/best-practices' },
        { label: 'Test and monitor a Genie Agent', url: 'https://docs.databricks.com/aws/en/genie-agents/monitor', note: 'Benchmarks and feedback.' },
      ],
    },
    {
      id: 'reference-run',
      heading: 'What the reference run shows',
      prose:
        'The job built an agent over the sales metric view and asked it four questions as the author. Everything below comes from its results table. The author and the asker were the same user here, so this run cannot show the embedded warehouse credential and the asker’s identity apart.',
      table: {
        columns: ['Finding', 'Result'],
        rows: [
          ['Definition stored', 'One metric view, one text instruction, two example queries (one parameterized), three sample questions, three benchmarks, and three column settings. The API returned the metric view under tables.'],
          ['Warehouse', 'A serverless SQL warehouse of type PRO, Small, one cluster. Genie ran every statement on it.'],
          ['Answers', 'Three of three questions with expected rows matched, including a follow-up in the same conversation. The vague question drew the clarifying question the text instruction asks for.'],
          ['Stored message fields', 'Message ID, conversation ID, user ID, status, content, creation and update times, feedback.rating, the generated SQL with its description and statement ID, thought steps, and a row count and statement ID for the result.'],
          ['Stored conversation fields', 'Conversation ID, title, type, and creation time. The API has no call that reads a single conversation; use the list call.'],
          ['Query history', 'Six statements with query_source.genie_space_id set arrived within about four minutes, for three questions that returned SQL. All ran on the agent’s warehouse, with executed_by and executed_as both the asking user and client_application set to Databricks SQL Genie Space.'],
          ['Billing', 'system.billing.usage held GENIE_AGENTS rows for the account, but the run did not isolate its own usage because billing lags by hours. Check again the next day.'],
        ],
      },
      links: [
        { label: 'Query history system table', url: 'https://docs.databricks.com/aws/en/admin/system-tables/query-history' },
      ],
    },
  ],
  related: [
    { slug: 'user-experience', title: 'Assistant user experience' },
    { slug: 'ontology', title: 'Business terms and synonyms' },
    { slug: 'in-platform-visualization', title: 'Charts and dashboards in the platform' },
  ],
};
