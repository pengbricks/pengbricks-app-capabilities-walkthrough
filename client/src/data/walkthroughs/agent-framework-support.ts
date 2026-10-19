import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'agent-framework-support',
  area: 'AI Guides',
  title: 'Agents, MCP, and model gateway',
  intro:
    'One job checks four things on a us-west-2 workspace. A Python client calls a Unity Catalog function as an MCP tool with an OAuth token. A supervisor hands the result to a second agent. The same prompt goes through two Unity Gateway model services with rate limits, a fallback model, and inference tables. A capability table records what is GA, what is preview, and what the workspace does not have.',
  shortVersion: [
    {
      title: 'The tool call is a Unity Catalog call.',
      body: 'The managed MCP server for the schema lists the functions the caller can run. The result masks the customer email through a column mask.',
    },
    {
      title: 'A2A is not available here.',
      body: 'The docs and release notes list no A2A endpoint. A supervisor model hands work to two specialist agents through a handoff tool instead.',
    },
    {
      title: 'Two models answer one prompt.',
      body: 'Claude Haiku 5.5 and GPT-5.4 nano each sit behind a model service with GPT-5.4 mini as the fallback.',
    },
    {
      title: 'Limits returned HTTP 429.',
      body: 'Thirty requests to a service limited to 4 per minute produced 21 answers and 9 rejections.',
    },
    {
      title: 'Guardrails are Beta and UI-only.',
      body: 'Service policies attach in the Unity Gateway UI. The job attaches none, and the capability table says so.',
    },
  ],
  sections: [
    {
      id: 'tool',
      heading: 'A governed MCP tool call',
      prose:
        'The job creates 500 sample orders, a column mask on the email address, and a SQL function that looks up one order. The managed MCP server for the schema exposes the function. The client sends initialize, tools/list, and tools/call with the job identity\'s OAuth token, so Unity Catalog decides what the caller sees.',
      diagram: {
        type: 'flow',
        title: 'One tool call, checked by Unity Catalog',
        description:
          'The job task authenticates with the Databricks SDK and sends JSON-RPC requests to the managed MCP server for the schema. The server lists the Unity Catalog functions the caller has EXECUTE on. The tools/call request runs order_status, which reads the orders table. A column mask on customer_email hides the address from callers outside the PII group. The result and the function grants are written to mcp_tool_call.',
        lanes: [
          { label: 'Caller', fromRow: 0, toRow: 0 },
          { label: 'Unity Catalog', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'task', label: 'mcp_tool_call', sub: 'job task, SDK OAuth', mono: true, col: 0, row: 0 },
          { id: 'rpc', label: 'JSON-RPC', sub: 'protocol 2025-06-18', col: 1, row: 0, kind: 'highlight' },
          { id: 'rec', label: 'mcp_tool_call', sub: 'result, grants, latency', mono: true, col: 3, row: 0, kind: 'store' },
          { id: 'server', label: 'Managed MCP server', sub: '/api/2.0/mcp/functions', col: 1, row: 1, kind: 'surface' },
          { id: 'grants', label: 'EXECUTE on function', sub: 'checked per caller', col: 2, row: 1, kind: 'gate' },
          { id: 'fn', label: 'order_status', sub: 'UC SQL function', mono: true, col: 2, row: 2 },
          { id: 'orders', label: 'agent_orders', sub: 'email column masked', mono: true, col: 3, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'task', to: 'rpc' },
          { from: 'rpc', to: 'server', label: 'tools/list, tools/call' },
          { from: 'server', to: 'grants' },
          { from: 'grants', to: 'fn', label: 'allowed' },
          { from: 'fn', to: 'orders' },
          { from: 'server', to: 'rec', dashed: true },
        ],
        legend: [
          { kind: 'gate', label: 'Unity Catalog privilege check' },
          { kind: 'surface', label: 'Managed MCP server (Public Preview)' },
          { kind: 'store', label: 'Table' },
        ],
        caption:
          'The call returned in a median 1.9 s over three calls. The schema lists two tools: order_status and the mask function, because both are functions the caller can run.',
      },
    },
    {
      id: 'handoff',
      heading: 'A handoff between agents',
      prose:
        'A supervisor model gets one customer question and a handoff tool. It sends the order lookup to the orders agent, which calls the MCP tool. It then sends the facts and the return policy to the policy agent and returns that reply. Each step lands in agent_handoff_trace with its latency.',
      diagram: {
        type: 'flow',
        title: 'Supervisor to orders agent to policy agent',
        description:
          'The supervisor calls handoff for orders_agent. The orders agent calls the Unity Catalog function through MCP and returns the order facts with the email masked. The supervisor calls handoff for policy_agent with those facts. The policy agent drafts the reply using the return policy text. The supervisor returns that reply as the final answer. The whole run took about 16 seconds.',
        nodes: [
          { id: 'ask', label: 'Customer question', sub: 'order 1042 not arrived', col: 0, row: 0 },
          { id: 'sup', label: 'Supervisor', sub: 'Claude Haiku 5.5', col: 1, row: 0, kind: 'highlight' },
          { id: 'orders', label: 'orders_agent', sub: 'GPT-5.4 mini', mono: true, col: 2, row: 0 },
          { id: 'tool', label: 'order_status over MCP', sub: 'UC function', col: 3, row: 0, kind: 'surface' },
          { id: 'policy', label: 'policy_agent', sub: 'Claude Haiku 5.5', mono: true, col: 2, row: 1 },
          { id: 'final', label: 'Final reply', sub: 'applies return policy', col: 1, row: 1 },
          { id: 'trace', label: 'agent_handoff_trace', sub: '6 steps with latency', mono: true, col: 3, row: 1, kind: 'store' },
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
          { kind: 'store', label: 'Trace table' },
        ],
        caption: 'This is a supervisor pattern. No A2A endpoint exists on the workspace, so the guide does not claim one.',
      },
    },
    {
      id: 'gateway',
      heading: 'One prompt, two models',
      prose:
        'The job creates two Unity Gateway model services and sends the same prompt to each three times. Each service routes to one primary model and has a fallback destination, a per-minute rate limit, and an inference table. The served model comes back in the response.',
      diagram: {
        type: 'matrix',
        title: 'Same prompt through two model services',
        description:
          'Two model services are compared on primary model, fallback model, request limit, median latency, and tokens. agents_gateway_a routes to Claude Haiku 5.5 with a limit of 60 requests per minute and answered in a median 1411 ms with 35 input and 107 output tokens. agents_gateway_b routes to GPT-5.4 nano with a limit of 4 requests per minute and answered in a median 962 ms with 25 input and 62 output tokens. Both fall back to GPT-5.4 mini, which was not needed.',
        corner: 'Model service',
        columns: ['Primary', 'Fallback', 'Request limit', 'Median latency', 'Tokens in / out'],
        rows: [
          {
            label: 'agents_gateway_a',
            sub: 'prompt x3',
            cells: [
              { state: 'own', text: 'Claude Haiku 5.5' },
              { state: 'optional', text: 'GPT-5.4 mini', sub: 'not used' },
              { state: 'own', text: '60 per min' },
              { state: 'own', text: '1,411 ms' },
              { state: 'own', text: '35 / 107' },
            ],
          },
          {
            label: 'agents_gateway_b',
            sub: 'prompt x3',
            cells: [
              { state: 'own', text: 'GPT-5.4 nano' },
              { state: 'optional', text: 'GPT-5.4 mini', sub: 'not used' },
              { state: 'own', text: '4 per min' },
              { state: 'own', text: '962 ms' },
              { state: 'own', text: '25 / 62' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Measured or configured' },
          { state: 'optional', label: 'Configured, not triggered' },
        ],
        caption: 'Token counts come from the response usage field. Each service has 3 calls, so treat latency as indicative.',
      },
    },
    {
      id: 'controls',
      heading: 'Limits, fallback, and audit',
      prose:
        'A burst of 30 requests went to the 4-per-minute service. The limiter rejected 9 of them with HTTP 429. It lets some extra requests through because it counts usage after a response and runs per instance. Every call also lands in the service\'s inference table and in system.ai_gateway.usage.',
      diagram: {
        type: 'flow',
        title: 'What a gateway request passes through',
        description:
          'A caller sends a request to a model service by its Unity Catalog name. Unity Catalog checks EXECUTE on the service. The rate limiter allows or returns HTTP 429. Allowed requests go to the primary model, and a failure there sends them to the fallback model. Every request is written to the service inference table and to system.ai_gateway.usage. Service policies for guardrails sit between the caller and the model but are attached in the UI and were not attached in this run.',
        lanes: [
          { label: 'Request path', fromRow: 0, toRow: 1 },
          { label: 'Audit', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          { id: 'caller', label: 'Caller', sub: 'OAuth token', col: 0, row: 0 },
          { id: 'svc', label: 'Model service', sub: 'catalog.schema.name', col: 1, row: 0, kind: 'highlight' },
          { id: 'limit', label: 'Rate limit', sub: 'QPM and TPM', col: 2, row: 0, kind: 'gate' },
          { id: 'primary', label: 'Primary model', sub: 'pay-per-token', col: 3, row: 0 },
          { id: 'reject', label: 'HTTP 429', sub: '9 of 30 burst calls', col: 2, row: 1 },
          { id: 'fallback', label: 'Fallback model', sub: 'on primary failure', col: 3, row: 1 },
          { id: 'policy', label: 'Service policy', sub: 'Beta, UI only', col: 1, row: 1, kind: 'surface' },
          { id: 'inf', label: '*_payload', sub: 'inference table', mono: true, col: 1, row: 2, kind: 'store' },
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
          { kind: 'gate', label: 'Enforced in this run' },
          { kind: 'surface', label: 'Available, not attached' },
          { kind: 'dashed', label: 'Configured or optional path' },
          { kind: 'store', label: 'Audit table' },
        ],
        caption:
          'Audit rows arrive late; the usage table showed them about 30 minutes after the calls. It recorded 36 requests: 3 for service a, and 24 answers plus 9 rejections for service b. The inference tables held 3 and 23 rows. The fallback never ran because both primaries answered every call.',
      },
    },
    {
      id: 'matrix',
      heading: 'What is GA, preview, or missing',
      prose:
        'The capability table is written by the job, so the result column comes from this run. Status text comes from the Databricks docs and release notes, with the page named in the source column.',
      diagram: {
        type: 'matrix',
        title: 'Capability status and result in this run',
        description:
          'Eight capabilities with their status and what happened in the run. The managed MCP server for Unity Catalog functions is Public Preview and worked. Unity Gateway model services, rate limits, inference tables, and the usage system table are GA and worked, although the usage table filled in about 30 minutes after the calls. Service policies are Beta and were not attached. A2A is not available. Agents on Model Serving are Legacy as of October 12, 2026.',
        corner: 'Capability',
        columns: ['Status', 'Result in this run'],
        rows: [
          { label: 'UC function MCP', sub: 'protocol 2025-06-18', cells: [{ state: 'optional', text: 'Public Preview' }, { state: 'own', text: 'Worked' }] },
          { label: 'Model services', sub: 'routing and fallback', cells: [{ state: 'own', text: 'GA' }, { state: 'own', text: 'Worked' }] },
          { label: 'Rate limits', sub: 'QPM and TPM', cells: [{ state: 'own', text: 'GA' }, { state: 'own', text: '429 observed' }] },
          { label: 'Inference tables', sub: 'per service', cells: [{ state: 'own', text: 'GA' }, { state: 'own', text: 'Rows landed' }] },
          { label: 'ai_gateway.usage', sub: 'system table', cells: [{ state: 'own', text: 'GA' }, { state: 'optional', text: 'Rows after ~30 min' }] },
          { label: 'Service policies', sub: 'guardrails', cells: [{ state: 'optional', text: 'Beta' }, { state: 'none', text: 'Not attached' }] },
          { label: 'A2A endpoint', sub: 'agent-to-agent', cells: [{ state: 'none', text: 'Not available' }, { state: 'none', text: 'Supervisor used' }] },
          { label: 'Agents on Model Serving', sub: 'deployment target', cells: [{ state: 'none', text: 'Legacy' }, { state: 'own', text: 'Used in the build guide' }] },
        ],
        legend: [
          { state: 'own', label: 'GA or worked' },
          { state: 'optional', label: 'Preview, Beta, or partial' },
          { state: 'none', label: 'Missing or not used' },
        ],
        caption: 'The full table, with region, protocol version, and latency per row, is agent_capability_matrix.',
      },
    },
    {
      id: 'setup',
      heading: 'Set it up',
      prose:
        'The agents bundle holds both jobs. Models, rate limits, and fallbacks are not bundle settings. They are the gateway block in use_cases/general.yml, and the notebooks create the model services through the SDK.',
      steps: [
        {
          title: 'Deploy the bundle',
          body: 'Set the catalog, warehouse, app service principal, and the address that gets failure mail.',
          code: 'cd reference/agents\ndatabricks bundle deploy -t dev \\\n  --var catalog=<catalog> --var warehouse_id=<warehouse-id> \\\n  --var app_service_principal=<app-sp-application-id> \\\n  --var notification_email=<email>',
        },
        {
          title: 'Run the job',
          body: 'The job calls the tool, runs the handoff, routes through two model services, and reads the audit table.',
          code: 'databricks bundle run capability_guides_agent_gateway -t dev',
        },
        {
          title: 'Clean up',
          body: 'The model services and their inference tables are not owned by the bundle. The teardown job removes them.',
          code: 'databricks bundle run capability_guides_agent_teardown -t dev',
        },
      ],
    },
  ],
  related: [
    { slug: 'agent-build-deployment', title: 'Building and shipping agents' },
    { slug: 'model-deployment-cicd', title: 'Model release pipeline' },
  ],
};
