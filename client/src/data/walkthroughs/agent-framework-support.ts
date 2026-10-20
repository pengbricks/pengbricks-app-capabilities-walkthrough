import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'agent-framework-support',
  area: 'AI Guides',
  title: 'Agents, MCP, and model gateway',
  intro:
    'An agent calls models and tools. On Databricks, Unity Gateway governs both: model services for inference, and MCP servers for tools. You host custom MCP servers and agents on Databricks Apps, call Databricks-provided MCP servers without hosting anything, authenticate as the app or as the user, and trace and evaluate every run with MLflow. This page covers the current pattern for each piece and a status table so you can see what is GA, in preview, or Legacy.',
  shortVersion: [
    {
      title: 'Host MCP servers and agents on Databricks Apps.',
      body: 'Apps gives the server compute, an HTTPS URL, and OAuth. Build a custom MCP server from a template, expose a REST API as tools, or deploy a server you already have.',
    },
    {
      title: 'Tools come from three places.',
      body: 'Databricks-provided MCP servers in system.ai (Genie One is GA), external servers you register in Unity Gateway, and custom servers on Apps. Unity Catalog permissions govern all three.',
    },
    {
      title: 'Choose whose identity runs the tool.',
      body: 'The app’s service principal for shared actions, or the signed-in user for on-behalf-of access, so row filters and column masks apply to that person.',
    },
    {
      title: 'Build agents with the Agent Bricks CLI.',
      body: 'The CLI (Beta) scaffolds LangGraph or OpenAI Agents SDK projects and deploys them to Agent Runtime on Apps with DurableAgentServer. Model Serving agent deployment is Legacy.',
    },
    {
      title: 'Route models through Unity Gateway.',
      body: 'Model services add routing, fallback, rate limits, inference tables, and a usage system table, so changing a model does not change agent code.',
    },
    {
      title: 'Trace everything and evaluate before you ship.',
      body: 'MLflow tracing records each model and tool call. mlflow.genai.evaluate scores a labeled set so you can compare versions.',
    },
  ],
  sections: [
    {
      id: 'hosting',
      heading: 'Where tools and agents run',
      prose:
        'Databricks Apps is the host for both custom MCP servers and agents. Unity Gateway is the single place to find, share, and govern the MCP servers, whoever runs them.',
      diagram: {
        type: 'flow',
        title: 'Agent, gateway, and tool sources',
        description:
          'An agent running on Agent Runtime on Databricks Apps calls tools through Unity Gateway. Gateway reaches three kinds of MCP server: Databricks-provided servers in the system.ai schema, custom servers hosted on Databricks Apps, and external servers registered in the gateway with their credentials held in a Unity Catalog connection.',
        lanes: [
          { label: 'Agent', fromRow: 0, toRow: 0 },
          { label: 'Tool sources', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'agent', label: 'Agent', sub: 'Agent Runtime on Apps', col: 1, row: 0, kind: 'highlight' },
          { id: 'gw', label: 'Unity Gateway', sub: 'access, policies, audit', col: 2, row: 0, kind: 'gate' },
          { id: 'managed', label: 'Databricks-provided', sub: 'system.ai MCP services', col: 0, row: 1, kind: 'surface' },
          { id: 'custom', label: 'Custom MCP server', sub: 'hosted on Databricks Apps', col: 2, row: 1, kind: 'surface' },
          { id: 'external', label: 'External MCP server', sub: 'self-hosted or partner', col: 3, row: 1, kind: 'surface' },
          { id: 'uc', label: 'Unity Catalog', sub: 'functions, data, grants', col: 0, row: 2, kind: 'store' },
          { id: 'conn', label: 'UC connection', sub: 'holds credentials', col: 3, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'agent', to: 'gw' },
          { from: 'gw', to: 'managed' },
          { from: 'gw', to: 'custom' },
          { from: 'gw', to: 'external' },
          { from: 'managed', to: 'uc' },
          { from: 'external', to: 'conn', dashed: true },
        ],
        legend: [
          { kind: 'gate', label: 'Governance point' },
          { kind: 'surface', label: 'MCP server' },
          { kind: 'store', label: 'Unity Catalog object' },
        ],
      },
      points: [
        {
          strong: 'Pick the MCP server by the job.',
          text: 'For business questions in natural language, use the Genie One MCP server. For specific SQL and engineering work, use the Databricks SQL MCP server. Build a custom server when you own the tools.',
        },
        {
          strong: 'Name custom servers with the mcp- prefix.',
          text: 'The prefix lets AI Playground find the server on Apps.',
        },
        {
          strong: 'External servers use a Unity Catalog connection.',
          text: 'Register the server in Unity Gateway so credentials and OAuth flows sit in a connection instead of agent code, and share it by grant. Check the current status of external MCP servers in the release notes before you depend on them.',
        },
      ],
      links: [
        {
          label: 'MCP on Databricks',
          url: 'https://docs.databricks.com/aws/en/agents/mcp-tools/',
          note: 'Choosing, registering, and governing MCP servers.',
        },
        {
          label: 'Custom MCP servers on Apps',
          url: 'https://docs.databricks.com/aws/en/agents/mcp-tools/custom-mcp',
        },
        {
          label: 'Databricks-provided MCP servers',
          url: 'https://docs.databricks.com/aws/en/agents/mcp-tools/managed-mcp',
        },
      ],
    },
    {
      id: 'tool',
      heading: 'A governed MCP tool call',
      prose:
        'A Unity Catalog function becomes an MCP tool. The client sends initialize, tools/list, and tools/call with an OAuth token, so Unity Catalog decides which functions the caller sees and which data they return. A column mask on a sensitive column hides it from callers outside the allowed group.',
      diagram: {
        type: 'flow',
        title: 'One tool call, checked by Unity Catalog',
        description:
          'The client authenticates with OAuth and sends JSON-RPC requests to the MCP server for the schema. The server lists the Unity Catalog functions the caller has EXECUTE on. The tools/call request runs the function, which reads a table. A column mask hides sensitive columns from callers outside the allowed group.',
        lanes: [
          { label: 'Caller', fromRow: 0, toRow: 0 },
          { label: 'Unity Catalog', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'task', label: 'MCP client', sub: 'OAuth token', col: 0, row: 0 },
          { id: 'rpc', label: 'JSON-RPC', sub: 'tools/list, tools/call', col: 1, row: 0, kind: 'highlight' },
          { id: 'server', label: 'MCP server', sub: 'for the schema', col: 1, row: 1, kind: 'surface' },
          { id: 'grants', label: 'EXECUTE on function', sub: 'checked per caller', col: 2, row: 1, kind: 'gate' },
          { id: 'fn', label: 'UC SQL function', sub: 'the tool', col: 2, row: 2 },
          { id: 'orders', label: 'Table', sub: 'sensitive column masked', col: 3, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'task', to: 'rpc' },
          { from: 'rpc', to: 'server' },
          { from: 'server', to: 'grants' },
          { from: 'grants', to: 'fn', label: 'allowed' },
          { from: 'fn', to: 'orders' },
        ],
        legend: [
          { kind: 'gate', label: 'Unity Catalog privilege check' },
          { kind: 'surface', label: 'MCP server' },
          { kind: 'store', label: 'Table' },
        ],
        caption:
          'The schema lists every function the caller can run, including helper functions such as mask functions. Grant EXECUTE only on the functions you mean to expose.',
      },
    },
    {
      id: 'identity',
      heading: 'Whose identity runs the tool',
      prose:
        'An agent on Apps has two identities available. Pick per tool, not per agent.',
      table: {
        columns: ['Identity', 'Use it when'],
        rows: [
          ['App service principal (OAuth M2M)', 'The action is the same for every caller, such as writing run state or reading shared reference data'],
          [
            'On-behalf-of user',
            'Results must follow the person’s permissions. Databricks forwards the user’s token, scoped, and Unity Catalog applies row filters and column masks to that user.',
          ],
        ],
      },
      points: [
        {
          strong: 'Default to least privilege.',
          text: 'Grant the app’s service principal only the functions, tables, and endpoints the agent needs. Do not run it as a person or with a PAT.',
        },
        {
          strong: 'Use user authorization for anything personal.',
          text: 'Querying tables, SQL warehouses, and jobs tied to a user action should run as that user, so the agent can never return more than the user could see.',
        },
      ],
      links: [
        {
          label: 'Databricks Apps authorization',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth',
          note: 'App identity and user authorization.',
        },
      ],
    },
    {
      id: 'handoff',
      heading: 'Several agents, one task',
      prose:
        'Multi-agent work is a supervisor pattern: one model routes work to specialist agents, each with its own tools, and combines their results. Build it in code with the Agent Bricks CLI. Keep each specialist narrow so you can trace and evaluate it alone.',
      diagram: {
        type: 'flow',
        title: 'Supervisor to specialist agents',
        description:
          'The supervisor receives a question and calls a handoff tool for the first specialist, which calls a governed MCP tool and returns facts. The supervisor then hands those facts to a second specialist that drafts the reply. The supervisor returns that reply. Each step is a span in the MLflow trace.',
        nodes: [
          { id: 'ask', label: 'User question', sub: 'one request', col: 0, row: 0 },
          { id: 'sup', label: 'Supervisor', sub: 'routes work', col: 1, row: 0, kind: 'highlight' },
          { id: 'orders', label: 'Specialist A', sub: 'looks up facts', col: 2, row: 0 },
          { id: 'tool', label: 'Governed MCP tool', sub: 'UC function', col: 3, row: 0, kind: 'surface' },
          { id: 'policy', label: 'Specialist B', sub: 'drafts the reply', col: 2, row: 1 },
          { id: 'final', label: 'Final reply', sub: 'returned to the user', col: 1, row: 1 },
          { id: 'trace', label: 'MLflow trace', sub: 'one span per step', col: 3, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'ask', to: 'sup' },
          { from: 'sup', to: 'orders', label: 'handoff 1' },
          { from: 'orders', to: 'tool', label: 'tools/call' },
          { from: 'sup', to: 'policy', label: 'handoff 2' },
          { from: 'policy', to: 'final' },
          { from: 'policy', to: 'trace', dashed: true },
        ],
        legend: [
          { kind: 'highlight', label: 'Routing model' },
          { kind: 'surface', label: 'Governed tool' },
          { kind: 'store', label: 'Trace' },
        ],
        caption:
          'The Databricks docs describe no A2A endpoint, so this guide does not claim one. Supervisor Agent and Knowledge Assistant are Legacy; use Genie Agents for low-code agents and the Agent Bricks CLI to coordinate agents in code.',
      },
    },
    {
      id: 'gateway',
      heading: 'Models through Unity Gateway',
      prose:
        'A model service is a Unity Catalog name your agent calls instead of a provider endpoint. Behind it you choose the primary model, a fallback, and limits. That lets you swap models, compare two on the same prompt, and cap spend without touching agent code.',
      diagram: {
        type: 'matrix',
        title: 'What a model service lets you set',
        description:
          'A model service sets the primary model, a fallback model for failures, a request or token rate limit, and an inference table. Usage is recorded in the system.ai_gateway.usage system table.',
        corner: 'Setting',
        columns: ['What it does', 'Why set it'],
        rows: [
          {
            label: 'Primary model',
            cells: [
              { state: 'own', text: 'Serves the request' },
              { state: 'own', text: 'Swap or A/B models', sub: 'no agent change' },
            ],
          },
          {
            label: 'Fallback model',
            cells: [
              { state: 'own', text: 'Takes over on failure' },
              { state: 'own', text: 'Keep answering', sub: 'during a provider outage' },
            ],
          },
          {
            label: 'Rate limits',
            sub: 'requests or tokens per minute',
            cells: [
              { state: 'own', text: 'Returns HTTP 429 over limit' },
              { state: 'own', text: 'Cap spend', sub: 'protect shared capacity' },
            ],
          },
          {
            label: 'Inference tables',
            cells: [
              { state: 'own', text: 'Log requests and responses' },
              { state: 'own', text: 'Audit and evaluate', sub: 'replay real traffic' },
            ],
          },
          {
            label: 'Usage system table',
            sub: 'system.ai_gateway.usage',
            cells: [
              { state: 'own', text: 'Records tokens and callers' },
              { state: 'own', text: 'Chargeback', sub: 'and budgets' },
            ],
          },
        ],
        legend: [{ state: 'own', label: 'Available on a model service' }],
        caption:
          'Rate limits count usage after a response and run per instance, so treat them as a cap with some overshoot, not an exact meter. Audit rows can arrive late.',
      },
    },
    {
      id: 'controls',
      heading: 'Limits, fallback, and audit',
      prose:
        'Every request passes the same checks. Design your client to handle the 429 and to read which model actually answered.',
      diagram: {
        type: 'flow',
        title: 'What a gateway request passes through',
        description:
          'A caller sends a request to a model service by its Unity Catalog name. Unity Catalog checks EXECUTE on the service. The rate limiter allows the request or returns HTTP 429. Allowed requests go to the primary model, and a failure there sends them to the fallback model. Every request is written to the service inference table and to the usage system table. Service policies for guardrails sit between the caller and the model and are attached in the gateway UI.',
        lanes: [
          { label: 'Request path', fromRow: 0, toRow: 1 },
          { label: 'Audit', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          { id: 'caller', label: 'Caller', sub: 'OAuth token', col: 0, row: 0 },
          { id: 'svc', label: 'Model service', sub: 'catalog.schema.name', col: 1, row: 0, kind: 'highlight' },
          { id: 'limit', label: 'Rate limit', sub: 'requests and tokens', col: 2, row: 0, kind: 'gate' },
          { id: 'primary', label: 'Primary model', sub: 'pay-per-token', col: 3, row: 0 },
          { id: 'reject', label: 'HTTP 429', sub: 'over the limit', col: 2, row: 1 },
          { id: 'fallback', label: 'Fallback model', sub: 'on primary failure', col: 3, row: 1 },
          { id: 'policy', label: 'Service policy', sub: 'guardrails (Beta)', col: 1, row: 1, kind: 'surface' },
          { id: 'inf', label: 'Inference table', sub: 'requests and responses', col: 1, row: 2, kind: 'store' },
          { id: 'usage', label: 'ai_gateway.usage', sub: 'system table', mono: true, col: 3, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'caller', to: 'svc' },
          { from: 'svc', to: 'limit' },
          { from: 'limit', to: 'primary', label: 'allowed' },
          { from: 'limit', to: 'reject', label: 'over limit' },
          { from: 'primary', to: 'fallback', label: 'if it fails', dashed: true },
          { from: 'svc', to: 'policy', dashed: true },
          { from: 'svc', to: 'inf' },
          { from: 'primary', to: 'usage' },
        ],
        legend: [
          { kind: 'gate', label: 'Enforced check' },
          { kind: 'surface', label: 'Optional control' },
          { kind: 'dashed', label: 'Optional or failure path' },
          { kind: 'store', label: 'Audit table' },
        ],
      },
    },
    {
      id: 'observe',
      heading: 'Trace and evaluate',
      prose:
        'A gateway tells you what was called. MLflow tells you whether the agent did the right thing.',
      points: [
        {
          strong: 'Trace every run.',
          text: 'MLflow 3 tracing records each model call, tool call, and handoff as a span with inputs, outputs, and latency. Agent Runtime configures tracing to an experiment when you deploy, so a bad answer in production has a trace you can open.',
        },
        {
          strong: 'Evaluate with mlflow.genai.evaluate.',
          text: 'Run a labeled set of questions through the agent and score the outputs with built-in and custom scorers, such as correctness, groundedness, and tool-call checks. Compare versions before you promote one.',
        },
        {
          strong: 'Turn production failures into test cases.',
          text: 'Add traces with thumbs-down feedback or wrong answers to the evaluation set, so each incident becomes a regression test.',
        },
      ],
      links: [
        {
          label: 'MLflow tracing',
          url: 'https://docs.databricks.com/aws/en/mlflow3/genai/tracing',
        },
        {
          label: 'Evaluate and monitor GenAI apps',
          url: 'https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor',
        },
      ],
    },
    {
      id: 'matrix',
      heading: 'What is GA, preview, or Legacy',
      prose:
        'Status changes quickly. Check the release notes before you commit a design to anything marked Beta or preview.',
      diagram: {
        type: 'matrix',
        title: 'Capability status',
        description:
          'The Genie One MCP server, Unity Gateway model services, rate limits, inference tables, the usage system table, and MLflow tracing are GA. The Agent Bricks CLI and gateway service policies are Beta. Databricks-provided MCP servers other than Genie One are available, some behind the Unity Gateway beta. On-behalf-of user authorization on Apps and custom MCP servers on Apps are supported. An A2A endpoint is not documented. Agents on Model Serving, MLflow AgentServer, LongRunningAgentServer, Knowledge Assistant, and Supervisor Agent are Legacy.',
        corner: 'Capability',
        columns: ['Status', 'Use for'],
        rows: [
          { label: 'Genie One MCP server', sub: 'system.ai.genie_one_mcp', cells: [{ state: 'own', text: 'GA' }, { state: 'own', text: 'Natural-language analytics' }] },
          { label: 'Other provided MCP', sub: 'SQL, sandbox, web search', cells: [{ state: 'optional', text: 'Unity Gateway beta' }, { state: 'own', text: 'Ready-made tools' }] },
          { label: 'Custom MCP on Apps', sub: 'your tools', cells: [{ state: 'own', text: 'Supported' }, { state: 'own', text: 'Your own tools' }] },
          { label: 'On-behalf-of user auth', sub: 'Apps', cells: [{ state: 'own', text: 'Supported' }, { state: 'own', text: 'Per-user permissions' }] },
          { label: 'Agent Bricks CLI', sub: 'build and deploy', cells: [{ state: 'optional', text: 'Beta' }, { state: 'own', text: 'New agents' }] },
          { label: 'Agent Runtime + DurableAgentServer', sub: 'on Databricks Apps', cells: [{ state: 'own', text: 'Recommended' }, { state: 'own', text: 'Hosting agents' }] },
          { label: 'Model services', sub: 'Unity Gateway', cells: [{ state: 'own', text: 'GA' }, { state: 'own', text: 'Routing, fallback, limits' }] },
          { label: 'MLflow tracing + evaluate', sub: 'mlflow.genai.evaluate', cells: [{ state: 'own', text: 'GA' }, { state: 'own', text: 'Debug and score' }] },
          { label: 'Service policies', sub: 'guardrails', cells: [{ state: 'optional', text: 'Beta' }, { state: 'optional', text: 'Safety checks' }] },
          { label: 'A2A endpoint', sub: 'agent-to-agent', cells: [{ state: 'none', text: 'Not documented' }, { state: 'none', text: 'Use a supervisor' }] },
          { label: 'Agents on Model Serving', sub: 'and MLflow AgentServer', cells: [{ state: 'none', text: 'Legacy' }, { state: 'none', text: 'Move to Agent Runtime' }] },
          { label: 'Knowledge Assistant', sub: 'and Supervisor Agent', cells: [{ state: 'none', text: 'Legacy' }, { state: 'none', text: 'Genie Agents or the CLI' }] },
        ],
        legend: [
          { state: 'own', label: 'GA, supported, or recommended' },
          { state: 'optional', label: 'Beta or preview' },
          { state: 'none', label: 'Legacy or not available' },
        ],
      },
      links: [
        {
          label: 'Unity Gateway',
          url: 'https://docs.databricks.com/aws/en/unity-gateway',
        },
        {
          label: 'Legacy agent offerings',
          url: 'https://docs.databricks.com/aws/en/agents/legacy/',
          note: 'Each Legacy offering and its replacement.',
        },
      ],
    },
  ],
  related: [
    { slug: 'agent-build-deployment', title: 'Building and shipping agents' },
    { slug: 'model-deployment-cicd', title: 'Model release pipeline' },
  ],
};
