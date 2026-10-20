import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'omnigent',
  area: 'AI Guides',
  title: 'Omnigent: coding agents with shared sessions and policies',
  intro:
    'Omnigent is an open-source meta-harness that sits above coding agents such as Claude Code, Codex, Cursor, and Pi. Run the agents through one server, share sessions with your team, and set the rules in policies the server enforces around every action. On Databricks you start with the managed service (Beta) and keep identity, models, tracing, and data access on the platform. Deploy it yourself on Databricks Apps only when you need something the managed service does not expose. This page covers the pattern in that order.',
  businessValue: {
    summary:
      'Coding agents already run in your engineers’ terminals. Omnigent adds one layer above them so teams compose several agents, collaborate on shared sessions, and control cost and risk with policies the platform enforces, using the Databricks identity and governance they already have.',
    outcomes: [
      {
        title: 'Engineering leaders',
        body: 'Split large tasks across Claude Code, Codex, and Pi in parallel, with a different vendor reviewing each change. Teammates watch, comment on, and take over shared sessions, so know-how stays with the team.',
      },
      {
        title: 'Platform and security',
        body: 'Set policy, identity, and audit once instead of per agent. Policies run in the server around each action, so a prompt cannot talk an agent past a DENY. Each user connects with their own OAuth token.',
      },
      {
        title: 'Finance',
        body: 'Cost budgets cap spend per session and per user per day, and an exceeded cap can force a switch to a cheaper model. Model traffic runs through Unity Gateway, where usage is tracked.',
      },
      {
        title: 'Data teams',
        body: 'Agents reach the lakehouse with the user’s own Databricks token, so Unity Catalog privileges decide what each agent can read. Agent traces land in MLflow Tracing for review.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'On Databricks, start with the managed service.',
      body: 'Omnigent on Databricks (Beta) runs the server for you, wired to workspace identity, Foundation Model APIs, and Unity Gateway. Enable the Omnigent preview for the workspace and follow the quickstart.',
    },
    {
      title: 'Self-manage on Databricks Apps only for a specific need.',
      body: 'Deploy the open-source server with a Declarative Automation Bundle, Lakebase, and a Unity Catalog volume when you need custom YAML policies, your own provider keys, or custom egress controls.',
    },
    {
      title: 'Enforce rules in policies, not in prompts.',
      body: 'Policies return ALLOW, ASK, or DENY for each tool call or model request. Set them at three levels: the session, the agent, and the whole server.',
    },
    {
      title: 'Bound the damage before you widen access.',
      body: 'Cap spend with cost budgets, allowlist repos and branches, gate pushes and deletes with the blast-radius policy, and run shared sessions on a sandbox host instead of a laptop.',
    },
    {
      title: 'Share read-only by default.',
      body: 'Edit access lets a teammate drive an agent on the host. Grant it to people you trust with that host, or move the session to a sandbox first.',
    },
    {
      title: 'Compose agents for the job.',
      body: 'Define an agent in a short YAML file, change one line to switch harness or model, and have a second vendor review the first agent’s work.',
    },
  ],
  sections: [
    {
      id: 'what',
      heading: 'What Omnigent is and where it runs',
      prose:
        'Coding agents handle the loop of read, think, edit, and run. Omnigent adds what sits around the loop: several agents in one session, shared history, sandboxes, and policies. The terminal, web UI, desktop app, mobile, Slack, and the API attach to the same live session. The Omnigent project labels itself alpha, and the Databricks offering is in Beta, so check the release notes before you commit a rollout date.',
      diagram: {
        type: 'flow',
        title: 'Omnigent between developers and the platform',
        description:
          'A developer connects through the terminal, web UI, or Slack to the Omnigent server. The server applies policies to each action and hands work to coding agents such as Claude Code, Codex, and Pi. On Databricks, the agents call models through Unity Gateway, read data under Unity Catalog grants, and write traces to MLflow Tracing.',
        nodes: [
          { id: 'dev', label: 'Developer', sub: 'terminal, web, Slack', col: 0, row: 0 },
          { id: 'server', label: 'Omnigent server', sub: 'sessions and identity', col: 1, row: 0, kind: 'highlight' },
          { id: 'policy', label: 'Policy layer', sub: 'ALLOW, ASK, DENY', col: 2, row: 0, kind: 'gate' },
          { id: 'agents', label: 'Coding agents', sub: 'Claude Code, Codex, Pi', col: 3, row: 0, kind: 'surface' },
          { id: 'gw', label: 'Unity Gateway', sub: 'models and usage', col: 2, row: 1, kind: 'store' },
          { id: 'uc', label: 'Unity Catalog', sub: 'grants and audit logs', col: 3, row: 1, kind: 'store' },
          { id: 'mlflow', label: 'MLflow Tracing', sub: 'one trace per turn', col: 4, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'dev', to: 'server' },
          { from: 'server', to: 'policy' },
          { from: 'policy', to: 'agents' },
          { from: 'agents', to: 'gw' },
          { from: 'agents', to: 'uc' },
          { from: 'agents', to: 'mlflow' },
        ],
        legend: [
          { kind: 'gate', label: 'Policy decision point' },
          { kind: 'surface', label: 'Agent harness' },
          { kind: 'store', label: 'Databricks service' },
        ],
        caption:
          'The server evaluates policies around each tool call and model request. Which Databricks services are wired in depends on whether you use the managed service or deploy it yourself.',
      },
      points: [
        {
          strong: 'A runner wraps each agent.',
          text: 'The runner gives every harness the same session shape. It can run on a laptop, a cloud sandbox, or Kubernetes, while the server keeps history, auth, and policies.',
        },
        {
          strong: 'Omnigent works without Databricks.',
          text: 'The project is Apache 2.0 and takes your own API keys, Claude or ChatGPT plans, or compatible gateways. Databricks adds identity, governed models, tracing, and data access.',
        },
        {
          strong: 'Drive it from code or CI.',
          text: 'A Python SDK and REST API run the same sessions without the UI.',
        },
      ],
      links: [
        { label: 'Omnigent on Databricks', url: 'https://docs.databricks.com/aws/en/omnigent/', note: 'Managed offering, availability, and limitations.' },
        { label: 'Omnigent documentation', url: 'https://omnigent.ai/docs' },
        { label: 'Omnigent repository', url: 'https://github.com/omnigent-ai/omnigent' },
      ],
    },
    {
      id: 'start',
      heading: 'Install and run your first session',
      prose:
        'Omnigent needs Python 3.12 or newer. Install it as a tool, start an agent through it, and open the web UI address it prints. The same Claude Code you already use now has a persistent, shareable session.',
      steps: [
        {
          title: 'Install',
          body: 'The README also offers a one-command installer script and a Homebrew tap. The uv tool install below is the manual route and includes the Databricks extra when you request it.',
          code: 'uv tool install "omnigent[databricks]"',
        },
        {
          title: 'Start a session',
          body: 'Run Claude Code through Omnigent. Codex and Cursor have matching commands.',
          code: 'omnigent claude',
        },
        {
          title: 'Try the orchestrator on a scratch repository',
          body: 'Polly is a built-in coding orchestrator. It splits a task across sub-agents on separate worktrees and has a second vendor review each piece.',
          code: 'omnigent polly',
        },
        {
          title: 'Keep it current',
          body: 'omni upgrade detects how you installed, waits for running sessions to finish, and upgrades. Add --check to only report whether a newer release exists.',
          code: 'omni upgrade --check',
        },
      ],
      links: [
        { label: 'Install Omnigent', url: 'https://omnigent.ai/quickstart/install' },
        { label: 'Tutorial: coding agent', url: 'https://omnigent.ai/quickstart/coding-agent' },
      ],
    },
    {
      id: 'compose',
      heading: 'Composition: several agents, one session',
      prose:
        'No single model is best at every part of a task. Omnigent lets one agent hand pieces to others, each on its own git worktree, and lets a different vendor review the result.',
      points: [
        {
          strong: 'Review across vendors.',
          text: 'Polly dispatches implementation, investigation, and review to sub-agents. Each implementer opens its own pull request, a reviewer from another vendor checks it, and a person merges.',
        },
        {
          strong: 'Switch harness or model in one line.',
          text: 'A custom agent is a short YAML file with a harness, a prompt, tools, and policies. Changing the harness line moves the agent to another vendor and leaves the tools, prompts, and policies in place.',
        },
        {
          strong: 'Declare sub-agents in the spec.',
          text: 'List them under tools so the parent dispatches work and reads results from its inbox. Cap fan-out with the spawn_bounds policy.',
        },
        {
          strong: 'Route by task.',
          text: 'Smart routing picks a harness and model per session with a built-in judge or your own routing API. Pair it with the deny_trivial_to_expensive_model policy to keep simple tasks off costly models.',
        },
        {
          strong: 'Supported harnesses.',
          text: 'The README names Claude Code, Codex, Cursor, OpenCode, Hermes, and Pi, and the docs list more, plus any ACP agent. Check the supported-harness page for the current list before you promise a vendor.',
        },
      ],
      links: [
        { label: 'Supported harnesses', url: 'https://omnigent.ai/docs/build/harnesses' },
        { label: 'Custom agents', url: 'https://omnigent.ai/docs/use/custom-agents' },
        { label: 'Smart routing', url: 'https://omnigent.ai/docs/build/routing' },
        { label: 'Polly', url: 'https://omnigent.ai/docs/use/builtin-agents/polly' },
      ],
    },
    {
      id: 'collaborate',
      heading: 'Collaboration: sessions your team can share',
      prose:
        'A session is a link. Teammates watch the live stream, comment on the output, or fork the conversation and continue on their own. Share with the least access that gets the job done.',
      table: {
        caption: 'What each share level allows',
        columns: ['Level', 'What it allows'],
        rows: [
          ['Read', 'Watch messages and tool calls. Workspace files stay hidden unless the owner turns on the Workspace files toggle.'],
          ['Edit', 'Send messages, edit workspace files, and answer approvals. Every action goes through the agent, so policies still apply.'],
          ['Owner only', 'Change MCP servers, the agent bundle, or the permission mode, browse host paths, and run a raw shell command.'],
          ['Fork', 'Copy the conversation and continue independently, even with a different agent.'],
        ],
      },
      points: [
        {
          strong: 'Identity follows each person.',
          text: 'Users sign in with SSO or OIDC and connect their own GitHub and Databricks accounts. Sandboxes act as that user with short-lived tokens, so there are no shared personal access tokens.',
        },
        {
          strong: 'Edit means code execution on the host.',
          text: 'A session runs commands on whatever machine hosts it. Host shared sessions on a cloud sandbox host, or add an OS sandbox policy, before you give Edit to a wider group.',
        },
        {
          strong: 'Let admins set the ceiling.',
          text: 'A server admin can cap sharing at read-only, turn it off, or disable public links.',
        },
        {
          strong: 'Use comments to steer.',
          text: 'Inline comments queue on the agent’s output, and one action sends them all to the agent. Queued follow-ups let a reviewer steer without taking the keyboard.',
        },
      ],
      links: [
        { label: 'Pair programming and permission levels', url: 'https://omnigent.ai/docs/collaborate' },
        { label: 'Auth and SSO', url: 'https://omnigent.ai/docs/collaborate/auth' },
        { label: 'Tutorial: collaborate', url: 'https://omnigent.ai/quickstart/collaborate' },
      ],
    },
    {
      id: 'control',
      heading: 'Control: policies the server enforces',
      prose:
        'A policy checks each action, such as a tool call, a model request, or a file operation, and answers ALLOW, ASK, or DENY. The check runs in the server, outside the prompt, so the agent cannot talk its way around it. Policies keep state, which is how a budget remembers what a session has spent.',
      table: {
        caption: 'Three levels, checked in this order',
        columns: ['Level', 'Who sets it, and how'],
        rows: [
          ['Session', 'The end user, in plain English in chat or in the session settings panel. Checked first.'],
          ['Agent', 'The agent developer, in the policies block of the agent YAML.'],
          ['Server', 'An admin, in the server config, the settings page, or the REST API. Checked last.'],
        ],
      },
      points: [
        {
          strong: 'Cap spend.',
          text: 'cost_budget limits one session with soft ASK checkpoints and a hard limit. user_daily_cost_budget limits a person across all their sessions for the day. Past the hard limit, the policy blocks expensive model tiers and allows the session again once it switches to a cheaper model.',
        },
        {
          strong: 'Require approval for file and shell actions.',
          text: 'ask_on_os_tools pauses before file or shell tools, and the approval can come from the web, mobile, or Slack.',
        },
        {
          strong: 'Allowlist repositories and branches.',
          text: 'github_policy limits writes to named repos and branches and parses git and gh commands, not only the MCP tools.',
        },
        {
          strong: 'Block PII in prompts.',
          text: 'deny_pii_in_llm_request scans for SSNs, credit cards, emails, and phone numbers and either denies or asks. Test it against your own data patterns. The documented categories do not include API keys or tokens.',
        },
        {
          strong: 'Pick pre-tool gates for destructive actions.',
          text: 'A policy that runs after a tool call cannot undo it. Put the gate before the call.',
        },
        {
          strong: 'Write custom rules.',
          text: 'Use CEL expressions or a prompt-based policy. The managed service on Databricks supports CEL and the built-in policies, but not custom Python policies.',
        },
      ],
      examples: [
        {
          label: 'Server-wide policies in server_config.yaml',
          language: 'yaml',
          code: `policies:
  session_budget:
    type: function
    handler: omnigent.policies.builtins.cost.cost_budget
    factory_params:
      max_cost_usd: 10.00
      ask_thresholds_usd: [5.00]
  daily_budget:
    type: function
    handler: omnigent.policies.builtins.cost.user_daily_cost_budget
    factory_params:
      max_cost_usd: 25.00
      ask_thresholds_usd: [10.00, 20.00]
  github_access:
    type: function
    handler: omnigent.policies.builtins.github.github_policy
    factory_params:
      write_repos: [myorg/frontend, myorg/backend]
      write_branches: ["feature/*", "fix/*"]`,
          notes: [
            'Each policy names a Python handler and its parameters. The values here come from the policy guide in the Omnigent repository; set your own limits.',
            'Admins can also add or remove server-wide policies at runtime through the REST API.',
          ],
        },
      ],
      links: [
        { label: 'Contextual policies', url: 'https://omnigent.ai/docs/policies/overview' },
        { label: 'Built-in policies', url: 'https://omnigent.ai/docs/policies/builtin' },
        { label: 'Custom policies', url: 'https://omnigent.ai/docs/policies/custom' },
        { label: 'Policy guide in the repository', url: 'https://github.com/omnigent-ai/omnigent/blob/main/docs/POLICIES.md' },
      ],
    },
    {
      id: 'mcp',
      heading: 'MCP servers, sandboxes, and blast radius',
      prose:
        'More agents, tools, and people in one session mean more ways to do damage. Limit the damage in layers: the host the session runs on, the tools it can call, the commands it can run, and the files it can write.',
      table: {
        caption: 'Blast-radius layers',
        columns: ['Layer', 'Control'],
        rows: [
          ['Host', 'Run the session on a sandbox host, such as a micro-VM, a Kubernetes pod, or a cloud sandbox, away from your laptop and other sessions.'],
          ['Shell commands', 'The blast_radius policy allows safe commands, asks on risky ones such as git push or gh pr merge, and always denies force-push and rm -rf of the root.'],
          ['MCP tools', 'Name the tools a server exposes in the agent YAML. Only the session owner can add, edit, or remove MCP servers.'],
          ['File writes', 'worktree_guard keeps writes inside a worker’s worktree, and read_only_os makes a report-only agent.'],
          ['Working directory', 'block_working_dir_changes denies cd, git -C, and worktree changes outside allowed directories.'],
          ['OS sandbox', 'Omnibox restricts the filesystem and network for the agent process.'],
        ],
      },
      points: [
        {
          strong: 'Allowlist MCP tools in the agent YAML.',
          text: 'The tools list under an MCP server exposes only the names you give it, so an agent can read pull requests without merging them. Use command for a local stdio server and url for a remote HTTP server.',
        },
        {
          strong: 'Host your own MCP servers on Databricks Apps.',
          text: 'Apps gives a custom server compute, an HTTPS URL, and OAuth. Point the agent’s url entry at it, and confirm how the runner authenticates before rollout. The Agents, MCP, and model gateway guide covers hosting and Unity Gateway governance.',
        },
        {
          strong: 'Keep credentials on the server.',
          text: 'The repository includes an MCP registry and gateway prototype where an admin configures services and the server holds the credentials. Treat it as a prototype and check its status before you depend on it.',
        },
        {
          strong: 'Use sandbox hosts for shared work.',
          text: 'The sandbox providers include Microsandbox micro-VMs, Kubernetes with an optional Kata or gVisor runtime class, and several cloud sandbox services. On Databricks, the managed service can launch Databricks Sandboxes in select AWS regions.',
        },
      ],
      examples: [
        {
          label: 'An MCP server with an allowlist',
          language: 'yaml',
          code: `tools:
  github:
    type: mcp
    command: uv
    args: [run, python, -m, my_package.github_mcp]
    tools:
      - search_issues
      - get_pull_request

policies:
  shell_blast_radius:
    type: function
    handler: omnigent.policies.builtins.orchestration.blast_radius
    factory_params:
      risky_action: ASK`,
          notes: [
            'The tool names and module are placeholders for your own server.',
            'blast_radius takes risky_action (ASK or DENY) and gate_pushes. Catastrophic commands are denied in every setting.',
          ],
        },
      ],
      links: [
        { label: 'Tools and MCP servers', url: 'https://omnigent.ai/docs/build/tools' },
        { label: 'Cloud sandbox host', url: 'https://omnigent.ai/docs/deploy/cloud-sandbox-host' },
        { label: 'Omnibox OS sandbox', url: 'https://omnigent.ai/docs/omnibox' },
      ],
    },
    {
      id: 'databricks',
      heading: 'Running on Databricks',
      prose:
        'Omnigent works with or without Databricks. On Databricks, the platform supplies identity, models, tracing, and data governance, so the agent follows the same rules as the person using it.',
      diagram: {
        type: 'flow',
        title: 'Self-managed Omnigent on Databricks Apps',
        description:
          'A Declarative Automation Bundle deploys the Omnigent server to Databricks Apps. Users sign in with workspace identity and connect with per-user OAuth. The server stores state in Lakebase and agent bundles in a Unity Catalog volume, and sends model calls through Unity Gateway.',
        nodes: [
          { id: 'bundle', label: 'Automation Bundle', sub: 'databricks.yml', col: 0, row: 0 },
          { id: 'app', label: 'Omnigent server', sub: 'on Databricks Apps', col: 1, row: 0, kind: 'highlight' },
          { id: 'users', label: 'Users', sub: 'per-user OAuth', col: 2, row: 0 },
          { id: 'lake', label: 'Lakebase', sub: 'sessions and state', col: 0, row: 1, kind: 'store' },
          { id: 'vol', label: 'Unity Catalog volume', sub: 'agent bundles', col: 1, row: 1, kind: 'store' },
          { id: 'gw', label: 'Unity Gateway', sub: 'model access', col: 2, row: 1, kind: 'gate' },
        ],
        edges: [
          { from: 'bundle', to: 'app', label: 'deploys', dashed: true },
          { from: 'users', to: 'app' },
          { from: 'app', to: 'lake' },
          { from: 'app', to: 'vol' },
          { from: 'app', to: 'gw' },
        ],
        legend: [
          { kind: 'gate', label: 'Governed model access' },
          { kind: 'store', label: 'State and artifacts' },
          { kind: 'dashed', label: 'Deploy step' },
        ],
        caption: 'The managed service runs this server for you. The diagram applies only when you self-manage.',
      },
      table: {
        caption: 'Managed or self-managed',
        columns: ['Option', 'Use it when'],
        rows: [
          ['Managed: Omnigent on Databricks (Beta)', 'Default choice. Databricks operates the server, with workspace identity, Foundation Model APIs, and Unity Gateway wired in. Enable the Omnigent preview and follow the quickstart. It needs a region that supports Unity Gateway.'],
          ['Self-managed on Databricks Apps', 'You need custom YAML policies, your own provider API keys, custom egress controls, or the managed service is not in your region. You own upgrades and operations.'],
        ],
      },
      points: [
        {
          strong: 'Identity is per user.',
          text: 'A server admin registers a Databricks OAuth app once. Each user then connects from Settings and authorizes with OAuth U2M, and sandboxes get short-lived tokens that are never written to the sandbox disk.',
        },
        {
          strong: 'Models go through Unity Gateway.',
          text: 'Calls to Foundation Model APIs or an external provider pass through the gateway, which provides usage tracking, rate limits, and audit logs. Subscription logins such as Claude Max or ChatGPT Plus use per-user OAuth that the gateway cannot proxy, so use API-key access for governed organization-wide use.',
        },
        {
          strong: 'Traces land in MLflow Tracing.',
          text: 'The server exports OpenTelemetry spans, giving one trace per agent turn that you can search and retain under Unity Catalog governance.',
        },
        {
          strong: 'Data access follows Unity Catalog.',
          text: 'The agent reaches the workspace with the user’s token, so queries are limited by that person’s grants. Unity Catalog audit logs record that access like any other client of that user.',
        },
        {
          strong: 'Self-managed state lives in Lakebase and a volume.',
          text: 'Use one Lakebase project per app and a Unity Catalog volume whose catalog and schema can grant access to the app’s service principal. Deploy with a Declarative Automation Bundle (formerly Asset Bundles).',
        },
        {
          strong: 'Know the managed limits.',
          text: 'A Databricks Sandbox host routes models through Unity Gateway, so you cannot bring your own model API keys there. It does not work with serverless egress control, so do not enable it in a workspace that uses that control.',
        },
      ],
      links: [
        { label: 'Omnigent on Databricks', url: 'https://docs.databricks.com/aws/en/omnigent/' },
        { label: 'Connect Databricks (per-user OAuth)', url: 'https://omnigent.ai/docs/deploy/databricks-connect' },
        { label: 'Deploy on Databricks Apps', url: 'https://github.com/omnigent-ai/omnigent/tree/main/deploy/databricks' },
        { label: 'Databricks Apps', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/' },
        { label: 'Declarative Automation Bundles', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/' },
        { label: 'Unity Gateway', url: 'https://docs.databricks.com/aws/en/unity-gateway/' },
        { label: 'MLflow Tracing', url: 'https://docs.databricks.com/aws/en/mlflow3/genai/tracing/' },
        { label: 'Lakebase', url: 'https://docs.databricks.com/aws/en/oltp/' },
      ],
    },
    {
      id: 'questions',
      heading: 'Likely questions',
      table: {
        columns: ['Question', 'Answer'],
        rows: [
          ['Do we need Databricks to use Omnigent?', 'No. It is open source under Apache 2.0 and runs with your own machine and model keys. Databricks adds identity, governed models, tracing, and a managed server.'],
          ['Which models can we use?', 'Your own API keys, Claude or ChatGPT plans, compatible gateways, or a Databricks workspace. A Databricks Sandbox host allows only models through Unity Gateway.'],
          ['Can a prompt injection bypass a policy?', 'The server enforces policies around each action, so instructions in a prompt cannot turn a DENY into an ALLOW. A policy that runs after a tool call cannot undo that call, so gate destructive actions before the call.'],
          ['Can a teammate with Edit change my agent’s tools?', 'No. MCP servers, the agent bundle, the permission mode, and the raw shell are owner-only.'],
          ['Is it ready for production?', 'The project labels itself alpha and the Databricks offering is in Beta. Pilot with a small group and re-check the release notes before a wide rollout.'],
          ['Can we run it from CI?', 'Yes, through the Python SDK and the REST API.'],
          ['Where do the audit records live?', 'Policy decisions are visible in the session. On Databricks, model calls are audited at Unity Gateway, traces go to MLflow Tracing, and data access appears in Unity Catalog audit logs.'],
        ],
      },
      links: [
        { label: 'Omnigent FAQ', url: 'https://omnigent.ai/faq' },
        { label: 'Databricks release notes', url: 'https://docs.databricks.com/aws/en/release-notes/product/' },
      ],
    },
    {
      id: 'pitfalls',
      heading: 'Pitfalls',
      points: [
        {
          strong: 'Giving Edit to a shared laptop session.',
          text: 'Edit gives the same filesystem, credential, and network access as the owner. Use a sandbox host.',
        },
        {
          strong: 'Treating a cost budget as a hard stop.',
          text: 'cost_budget blocks expensive model tiers past the limit and lets the session continue on a cheaper model. Set the expensive_models list to match your model names.',
        },
        {
          strong: 'Relying on the prompt for safety.',
          text: 'Instructions like "never force-push" do not bind the agent. Use the blast_radius policy.',
        },
        {
          strong: 'Assuming self-managed features exist in the managed service.',
          text: 'Custom Python policies and your own provider keys on a Databricks Sandbox host are not available in the managed service today. Pick the path by what you need.',
        },
        {
          strong: 'Sharing a Lakebase project.',
          text: 'Reusing another app’s Lakebase project makes the migrate-on-boot step fail with permission errors. Create one per app.',
        },
        {
          strong: 'Expecting audit from subscription logins.',
          text: 'Consumer subscription logins bypass Unity Gateway. Use API-key access when you need per-key cost and audit records.',
        },
        {
          strong: 'Leaving environment variables undeclared.',
          text: 'Agent processes start with a deny-by-default environment. If an agent fails at startup, check whether it needs an env_passthrough entry for its provider key.',
        },
      ],
    },
  ],
  related: [
    { slug: 'agent-framework-support', title: 'Agents, MCP, and model gateway' },
    { slug: 'agent-build-deployment', title: 'Building and shipping agents' },
  ],
};
