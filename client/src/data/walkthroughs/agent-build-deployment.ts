import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'agent-build-deployment',
  area: 'AI Guides',
  title: 'Building and shipping agents',
  intro:
    'The current path for a custom agent is the Agent Bricks CLI (Beta). It scaffolds a project, runs it locally, and deploys it to Agent Runtime on Databricks Apps, served by DurableAgentServer. This page covers that path, the checks to run before you promote a version, how to trace and monitor in production, and how to declare every dependency and resource so a release is reproducible. Deploying agents to Model Serving is Legacy as of October 12, 2026.',
  businessValue: {
    summary:
      'AI program owners need a repeatable way to get a custom agent from prototype to production. This guide covers the current Agent Bricks CLI path, with evaluation before release, tracing in production, and declared dependencies.',
    outcomes: [
      {
        title: 'Releases gated on measured quality',
        body:
          'A labeled set runs through mlflow.genai.evaluate, and the release waits on the scores. A change that makes answers worse is caught before users see it.',
      },
      {
        title: 'Failures investigated from traces',
        body:
          'Every production run lands in an MLflow experiment. Teams review failed runs and turn them into new evaluation cases, which shortens debugging.',
      },
      {
        title: 'Reproducible and least-privilege deployments',
        body:
          'Pinned packages and declared resources in agent.toml mean a release can be rebuilt. The agent\'s service principal gets only the models, tools, and warehouses it lists.',
      },
      {
        title: 'Runs survive interruptions',
        body:
          'DurableAgentServer keeps run state and recovers runs that a crash interrupted. The CLI is Beta, and Model Serving agents are Legacy, so plan migrations for existing ones.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Build and deploy with the Agent Bricks CLI.',
      body: 'agentbricks init scaffolds a LangGraph or OpenAI Agents SDK project, agentbricks dev runs it against Databricks models, and agentbricks deploy ships it to Agent Runtime on Apps.',
    },
    {
      title: 'Use DurableAgentServer.',
      body: 'It serves synchronous, streaming, and background runs from one invocation API, keeps run state, and recovers runs that a crash interrupted.',
    },
    {
      title: 'Evaluate before you promote.',
      body: 'Run a labeled set through mlflow.genai.evaluate and gate the release on the scores. Compare against the version in production.',
    },
    {
      title: 'Trace in production.',
      body: 'Every run lands in an MLflow experiment. Review traces and feedback, and turn failures into new evaluation cases.',
    },
    {
      title: 'Declare every dependency and resource.',
      body: 'Pin packages, list models, tools, stores, and warehouses in agent.toml and the app configuration, and grant the agent’s service principal only those.',
    },
    {
      title: 'Treat Model Serving agents as Legacy.',
      body: 'Build new agents on Agent Runtime on Apps, and plan migrations for existing ones.',
    },
  ],
  sections: [
    {
      id: 'path',
      heading: 'The current path: Agent Bricks CLI to Agent Runtime',
      prose:
        'A deployed agent has three layers. You own the first, and Databricks provides the others.',
      diagram: {
        type: 'flow',
        title: 'From an empty directory to a live agent',
        description:
          'agentbricks init scaffolds a project from a LangGraph or OpenAI Agents SDK template. agentbricks dev runs it locally. An evaluation gate scores it against a labeled set. agentbricks deploy provisions the resources in agent.toml and deploys the agent to Agent Runtime on Databricks Apps, where DurableAgentServer serves the invocation API. Traces flow to an MLflow experiment, and feedback from production feeds the evaluation set.',
        lanes: [
          { label: 'Develop', fromRow: 0, toRow: 0 },
          { label: 'Run in production', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'init', label: 'agentbricks init', sub: 'scaffold a project', mono: true, col: 0, row: 0 },
          { id: 'dev', label: 'agentbricks dev', sub: 'run locally', mono: true, col: 1, row: 0 },
          { id: 'gate', label: 'Evaluation gate', sub: 'mlflow.genai.evaluate', col: 2, row: 0, kind: 'gate' },
          { id: 'deploy', label: 'agentbricks deploy', sub: 'provision and ship', mono: true, col: 3, row: 0, kind: 'highlight' },
          { id: 'rt', label: 'Agent Runtime', sub: 'on Databricks Apps', col: 3, row: 1, kind: 'surface' },
          { id: 'srv', label: 'DurableAgentServer', sub: 'invocation API', col: 2, row: 1, kind: 'surface' },
          { id: 'trace', label: 'MLflow traces', sub: 'every run', col: 1, row: 2, kind: 'store' },
          { id: 'fb', label: 'Feedback', sub: 'new evaluation cases', col: 2, row: 2 },
        ],
        edges: [
          { from: 'init', to: 'dev' },
          { from: 'dev', to: 'gate' },
          { from: 'gate', to: 'deploy', label: 'passes' },
          { from: 'deploy', to: 'rt' },
          { from: 'rt', to: 'srv' },
          { from: 'srv', to: 'trace' },
          { from: 'trace', to: 'fb' },
          { from: 'fb', to: 'gate', label: 'regression set', dashed: true },
        ],
        legend: [
          { kind: 'gate', label: 'Promotion check' },
          { kind: 'highlight', label: 'Deploy step' },
          { kind: 'surface', label: 'Managed by Databricks' },
        ],
      },
      table: {
        caption: 'The agent compute stack',
        columns: ['Layer', 'Choice'],
        rows: [
          ['Framework or harness', 'Your agent loop. LangGraph and the OpenAI Agents SDK have CLI templates; bring an existing agent with agentbricks init --existing.'],
          ['Agent server', 'DurableAgentServer (recommended). The MLflow AgentServer and LongRunningAgentServer are Legacy.'],
          ['Agent runtime', 'Agent Runtime on Databricks Apps. Gives a stable OAuth-protected URL, an agent identity, durable run state, tracing, and 1 to 5 instances.'],
        ],
      },
      links: [
        {
          label: 'Deploy agents on Databricks',
          url: 'https://docs.databricks.com/aws/en/agents/deploy/',
          note: 'The three-layer stack and options at each layer.',
        },
        {
          label: 'Agent Bricks CLI',
          url: 'https://docs.databricks.com/aws/en/agents/custom-agents/agent-bricks-cli',
        },
        {
          label: 'Agent Runtime',
          url: 'https://docs.databricks.com/aws/en/agents/deploy/agent-runtime',
        },
      ],
    },
    {
      id: 'inside',
      heading: 'What a good agent looks like inside',
      prose:
        'Keep the agent loop plain: send the question and tool definitions to a model, run the tool the model asks for, return the result, and stop at a round limit. Governed tools and traces make the loop reviewable.',
      diagram: {
        type: 'flow',
        title: 'One request through a deployed agent',
        description:
          'A caller posts a question to the agent’s invocation API. The agent span wraps the request. A model span calls a foundation model, which asks for a tool. A tool span runs a governed Unity Catalog function using credentials scoped to the declared resources. The result goes back to the model, which writes the answer.',
        nodes: [
          { id: 'caller', label: 'Caller', sub: 'invocation API', col: 0, row: 0 },
          { id: 'predict', label: 'Agent span', sub: 'wraps the request', col: 1, row: 0, kind: 'highlight' },
          { id: 'llm', label: 'Model span', sub: 'foundation model', col: 2, row: 0, kind: 'surface' },
          { id: 'tool', label: 'Tool span', sub: 'UC function or MCP tool', col: 2, row: 1, kind: 'gate' },
          { id: 'wh', label: 'Governed data', sub: 'masks and filters apply', col: 3, row: 1, kind: 'store' },
          { id: 'answer', label: 'Answer', sub: 'grounded in tool output', col: 0, row: 1 },
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
      },
      points: [
        {
          strong: 'Check the trace, not just the answer.',
          text: 'A fluent answer can come from a model that never called its tool. Assert in your tests that the trace contains the tool span with real data.',
        },
        {
          strong: 'Make tool calls idempotent.',
          text: 'DurableAgentServer can start a replacement attempt after a crash, and clients retry with an invocation ID. Tools that write should tolerate a repeat.',
        },
      ],
    },
    {
      id: 'evaluate',
      heading: 'Evaluate before you promote',
      prose:
        'Treat each agent version like a release. It ships only if it scores at least as well as the version in production on a set you trust.',
      steps: [
        {
          title: 'Build a labeled set',
          body: 'Start with 30 to 100 realistic questions, each with the expected facts or the tool the agent should call. Include hard cases, refusals, and questions with no answer.',
        },
        {
          title: 'Score with mlflow.genai.evaluate',
          body: 'Run the set through the agent and score with built-in and custom scorers: correctness, groundedness, safety, and a check that the right tool was called. Log the run so versions compare side by side.',
        },
        {
          title: 'Gate the release',
          body: 'Set a minimum score per scorer and fail the deploy step below it. Keep the gate in CI, so a promotion needs a passing run on record.',
        },
        {
          title: 'Keep the set growing',
          body: 'Add traces from production failures and negative feedback to the set. Every incident becomes a regression test.',
        },
      ],
      links: [
        {
          label: 'Evaluate and monitor GenAI apps',
          url: 'https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor',
        },
      ],
    },
    {
      id: 'resources',
      heading: 'Declare every dependency and resource',
      prose:
        'An agent that works on your laptop fails in production when something it relied on is missing: a package, a grant, a warehouse. Declare it all, so the deployment either has it or fails loudly.',
      points: [
        {
          strong: 'Pin packages.',
          text: 'List every Python dependency with a version in the project’s requirements. A client library that arrives as an unlisted transitive dependency is the usual cause of a failure that only shows up after deploy.',
        },
        {
          strong: 'List the Databricks resources in agent.toml.',
          text: 'Tool bindings (Unity Catalog functions, managed MCP services, sandbox), and the memory, session, and tracing resources go in agent.toml. agentbricks deploy reads it to provision and wire them, and grants the agent’s service principal access to the stores it uses.',
        },
        {
          strong: 'Grant the rest to the agent’s service principal.',
          text: 'The agent runs as its app’s service principal. Grant it EXECUTE on the functions, SELECT on the tables, and CAN USE on the warehouse it needs, and nothing more. Use user authorization for tools that must run as the caller.',
        },
        {
          strong: 'Keep configuration in Git.',
          text: 'Model name, system prompt, round limit, and instance count belong in version control with the code, so a release maps to one commit.',
        },
        {
          strong: 'Name an owner.',
          text: 'Every agent has an agent owner, a tool owner, and an on-call contact recorded with the release.',
        },
      ],
      links: [
        {
          label: 'Databricks Apps authorization',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth',
        },
      ],
    },
    {
      id: 'record',
      heading: 'Record each release',
      prose:
        'Write one record per deployed version. It answers the questions an owner, auditor, or on-call engineer asks. Use this field list as a template.',
      table: {
        columns: ['Field', 'What to record'],
        rows: [
          ['agent, version', 'Name, commit SHA, and release tag'],
          ['code', 'Repository path of the agent and its tools'],
          ['model', 'Foundation model or model service the agent calls'],
          ['tools', 'Each tool, its type, and who owns it'],
          ['packages', 'Pinned dependency versions'],
          ['declared resources', 'Functions, tables, warehouses, stores, and MCP servers, with the grant each needs'],
          ['deployment', 'App name, URL, instance count, and identity'],
          ['evaluation', 'Evaluation run, scores, and the gate that passed'],
          ['trace location', 'MLflow experiment that receives traces'],
          ['owners', 'Agent owner, tool owner, on-call'],
        ],
      },
    },
    {
      id: 'legacy',
      heading: 'If you already deploy to Model Serving',
      prose:
        'Agents deployed to Model Serving are Legacy as of October 12, 2026. So are the MLflow AgentServer, LongRunningAgentServer, Knowledge Assistant, and Supervisor Agent. Legacy means no longer recommended for new agents: build them on Agent Runtime. The docs map each Legacy offering to its replacement.',
      points: [
        {
          strong: 'The pattern is the same, the target differs.',
          text: 'Logging a model, registering a version in Unity Catalog, setting an alias, and creating an endpoint is the old flow. The new flow deploys code with the CLI and keeps the version in Git, with the evaluation gate in front of it.',
        },
        {
          strong: 'Migrate with the documented path.',
          text: 'Follow the migration guide from Model Serving to Databricks Apps, move the tools and resources into agent.toml, and rerun your evaluation set against the new deployment before you switch traffic.',
        },
      ],
      links: [
        {
          label: 'Legacy agent offerings',
          url: 'https://docs.databricks.com/aws/en/agents/legacy/',
          note: 'Each Legacy offering and what replaces it.',
        },
      ],
    },
  ],
  related: [
    { slug: 'agent-framework-support', title: 'Agents, MCP, and model gateway' },
    { slug: 'model-deployment-cicd', title: 'Model release pipeline' },
    { slug: 'omnigent', title: 'Omnigent: coding agents with shared sessions and policies' },
  ],
};
