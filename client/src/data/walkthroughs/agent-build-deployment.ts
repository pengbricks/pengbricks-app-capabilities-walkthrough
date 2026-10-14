import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'agent-build-deployment',
  area: 'AI Guides',
  title: 'Building and shipping agents',
  intro:
    'One job builds a small support assistant that calls a Unity Catalog function as its tool. It registers version 3 in Unity Catalog, deploys it to a Small Model Serving endpoint that scales to zero, calls it, and records the answer, the packages, the owners, and the trace spans. A second job deletes the endpoint.',
  shortVersion: [
    {
      title: 'The agent is one Python file.',
      body: 'An MLflow ResponsesAgent loops between a chat model and one tool, with a trace span on each model and tool call.',
    },
    {
      title: 'The tool is a Unity Catalog function.',
      body: 'The endpoint runs it on a SQL warehouse with credentials scoped to the declared resources.',
    },
    {
      title: 'The registered version is the release.',
      body: 'support_assistant version 3 carries the champion alias and tags for the release and the tool function.',
    },
    {
      title: 'The endpoint costs nothing at rest.',
      body: 'It is Small with scale to zero, and the teardown job deletes it and confirms it is gone.',
    },
    {
      title: 'Model Serving is the legacy path.',
      body: 'Release notes from October 12, 2026 point new agents to the Agent Bricks CLI and Agent Runtime.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'From code to a live endpoint',
      prose:
        'Four tasks run in order. The local test writes traces to an MLflow experiment before anything is logged. The endpoint task polls until the endpoint is READY, and the last task calls it and writes the build record.',
      diagram: {
        type: 'flow',
        title: 'The build job',
        description:
          'prepare_tool creates the sample orders, the email mask, and the order_status function. log_and_register tests the agent locally, logs it with its declared resources, registers a version in Unity Catalog, and sets the champion alias. deploy_endpoint creates or updates a Small scale-to-zero Model Serving endpoint and waits for READY. call_and_record sends two requests with return_trace, checks for the tool span, and appends a row to agent_build_record. The teardown job deletes the endpoint.',
        lanes: [
          { label: 'Build', fromRow: 0, toRow: 0 },
          { label: 'Serve and record', fromRow: 1, toRow: 1 },
        ],
        nodes: [
          { id: 'prep', label: 'prepare_tool', sub: 'orders, mask, function', mono: true, col: 0, row: 0 },
          { id: 'log', label: 'log_and_register', sub: 'local test, log_model', mono: true, col: 1, row: 0, kind: 'highlight' },
          { id: 'uc', label: 'support_assistant', sub: 'UC version 3, champion', mono: true, col: 2, row: 0, kind: 'store' },
          { id: 'deploy', label: 'deploy_endpoint', sub: 'Small, scale to zero', mono: true, col: 3, row: 0 },
          { id: 'ep', label: 'Serving endpoint', sub: 'waits for READY', col: 3, row: 1, kind: 'surface' },
          { id: 'call', label: 'call_and_record', sub: '2 calls, trace check', mono: true, col: 2, row: 1 },
          { id: 'rec', label: 'agent_build_record', sub: 'code, packages, owners', mono: true, col: 1, row: 1, kind: 'store' },
          { id: 'down', label: 'agent_teardown', sub: 'deletes the endpoint', mono: true, col: 0, row: 1, kind: 'gate' },
        ],
        edges: [
          { from: 'prep', to: 'log' },
          { from: 'log', to: 'uc' },
          { from: 'uc', to: 'deploy' },
          { from: 'deploy', to: 'ep' },
          { from: 'ep', to: 'call' },
          { from: 'call', to: 'rec' },
          { from: 'down', to: 'ep', label: 'delete', dashed: true },
        ],
        legend: [
          { kind: 'highlight', label: 'Logs from code' },
          { kind: 'store', label: 'Unity Catalog asset or table' },
          { kind: 'gate', label: 'Separate job, run after' },
        ],
      },
    },
    {
      id: 'inside',
      heading: 'What the agent does per request',
      prose:
        'The agent sends the question and the tool definition to databricks-claude-haiku-5-5. When the model asks for order_status, the agent runs the function on a SQL warehouse and returns the text. The endpoint returns three spans with the answer.',
      diagram: {
        type: 'flow',
        title: 'One request through the endpoint',
        description:
          'A caller posts a question to the Model Serving endpoint. The predict span wraps the whole request. The chat_model span calls the Claude Haiku 5.5 foundation model endpoint, which asks for the order_status tool. The uc_function_tool span runs SELECT order_status on a SQL warehouse using credentials scoped to the declared resources. The result goes back to the model, which writes the answer.',
        nodes: [
          { id: 'caller', label: 'Caller', sub: 'POST /invocations', col: 0, row: 0 },
          { id: 'predict', label: 'predict', sub: 'agent span', mono: true, col: 1, row: 0, kind: 'highlight' },
          { id: 'llm', label: 'chat_model', sub: 'Claude Haiku 5.5', mono: true, col: 2, row: 0, kind: 'surface' },
          { id: 'tool', label: 'uc_function_tool', sub: 'SELECT order_status(id)', mono: true, col: 2, row: 1, kind: 'gate' },
          { id: 'wh', label: 'SQL warehouse', sub: 'masked email column', col: 3, row: 1, kind: 'store' },
          { id: 'answer', label: 'Answer', sub: 'status and age of order', col: 0, row: 1 },
        ],
        edges: [
          { from: 'caller', to: 'predict' },
          { from: 'predict', to: 'llm' },
          { from: 'llm', to: 'tool', label: 'tool call' },
          { from: 'tool', to: 'wh' },
          { from: 'tool', to: 'llm', label: 'result', dashed: true },
          { from: 'predict', to: 'answer' },
        ],
        legend: [
          { kind: 'highlight', label: 'Traced agent span' },
          { kind: 'gate', label: 'Governed tool' },
          { kind: 'dashed', label: 'Return path' },
        ],
        caption:
          'For order 1042 the endpoint answered "delivered", carrier Harborline, 38 days since the order. The first call took 4.7 s and the second 3.6 s.',
      },
    },
    {
      id: 'record',
      heading: 'The record that documents it',
      prose:
        'The last task writes one row to agent_build_record. It answers the questions an owner or reviewer asks about a deployed agent.',
      table: {
        columns: ['Field', 'Value in the reference run'],
        rows: [
          ['model, version', 'support_assistant, version 3, alias champion'],
          ['code', 'reference/agents/src/agent/assistant.py'],
          ['chat model', 'databricks-claude-haiku-5-5'],
          ['tool', 'order_status, a Unity Catalog SQL function'],
          ['packages', 'mlflow 3.17.1, databricks-sdk 0.152.0, openai 3.31.0, httpx 0.27.0'],
          ['declared resources', 'chat endpoint, function, orders table, SQL warehouse'],
          ['endpoint', 'capability-guides-support-assistant, Small, scale to zero'],
          ['trace spans', 'predict, chat_model, uc_function_tool'],
          ['owners', 'agent owner, tool owner, on-call (roles from the spec)'],
        ],
      },
    },
    {
      id: 'limits',
      heading: 'What went wrong on the way',
      prose:
        'The build hit two failures. Both changed the code, so both are kept here.',
      steps: [
        {
          title: 'Missing package on the endpoint',
          body: 'Version 1 failed at request time with No module named httpx. The openai client needs it, and it was not in the logged requirements. Version 2 added it.',
        },
        {
          title: 'An answer with no tool call',
          body: 'Version 2 called the function through the managed MCP server. On the endpoint, tools/list returned an empty list, so the model said it could not look up the order. The job still succeeded, because it only checked for a non-empty answer.',
        },
        {
          title: 'The fix and a stricter check',
          body: 'Version 3 runs the function on a SQL warehouse, declared as a resource. The build task now fails unless the returned trace has a uc_function_tool span with order data.',
        },
      ],
    },
  ],
  related: [
    { slug: 'agent-framework-support', title: 'Agents, MCP, and model gateway' },
    { slug: 'model-deployment-cicd', title: 'Model release pipeline' },
  ],
};
