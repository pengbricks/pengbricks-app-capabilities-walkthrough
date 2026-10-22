import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'omnigent',
  area: 'AI Guides',
  title: 'Omnigent: coding agents with shared sessions and policies',
  intro:
    'Every agent ships with its own harness, which makes it hard to compose agents, collaborate across people and agents, and control cost and security. Omnigent is an open-source meta-harness, a layer above the harness that sits over coding agents such as Claude Code, Codex, Cursor, and Pi. Run the agents through one server, share sessions with your team, and set the rules in policies the server enforces around every action. On Databricks you start with the managed service (Beta) and keep identity, models, tracing, and data access on the platform. Deploy it yourself on Databricks Apps only when you need something the managed service does not expose. This page covers the pattern in that order.',
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
        title: 'Omnigent between clients, agents, and the platform',
        description:
          'Clients such as the web UI, terminal, mobile, and the REST API connect to the Omnigent server, which holds history, the catalog, policies, MCPs, artifacts, and skills. The server applies policies to each action and hands work to a host and runner that drive coding agents such as Claude Code, Codex, and Pi, and custom agents. On Databricks, the agents call models through Unity Gateway, read data under Unity Catalog grants, and write traces to MLflow Tracing.',
        nodes: [
          {
            id: 'dev',
            label: 'Clients',
            sub: 'web, mobile, TUI, REST API',
            col: 0,
            row: 0,
            domain: 'neutral',
            icon: 'users',
            detail:
              'The web UI, terminal, mobile, desktop app, Slack, and REST API. All of them attach to the same live session on the server.',
          },
          {
            id: 'server',
            label: 'Omnigent server',
            sub: 'history, catalog, skills',
            col: 1,
            row: 0,
            kind: 'highlight',
            domain: 'orchestration',
            icon: 'gear-navy',
            detail:
              'Keeps session history, the catalog, policies, MCPs, artifacts, and skills, so teams share one session across agents and people.',
          },
          {
            id: 'policy',
            label: 'Policy layer',
            sub: 'ALLOW, ASK, DENY',
            col: 2,
            row: 0,
            kind: 'gate',
            domain: 'governance',
            detail:
              'Checks each tool call, model request, and file operation and answers ALLOW, ASK, or DENY. It runs in the server, so a prompt cannot argue past it.',
          },
          {
            id: 'host',
            label: 'Host and runner',
            sub: 'sandbox, common API',
            col: 3,
            row: 0,
            domain: 'orchestration',
            icon: 'gear-slate',
            detail:
              'Provides the common API, sandboxing, and reliability. Its runner wraps each agent and gives every harness the same session shape.',
          },
          {
            id: 'agents',
            label: 'Agents',
            sub: 'coding and custom agents',
            col: 4,
            row: 0,
            kind: 'surface',
            domain: 'ai',
            icon: 'gear-maroon',
            detail:
              'Coding agents such as Claude Code, Codex, and Pi, plus custom agents. The runner drives them while the server keeps history and rules.',
          },
          {
            id: 'gw',
            label: 'Unity Gateway',
            sub: 'models and usage',
            col: 2,
            row: 1,
            kind: 'store',
            domain: 'governance',
            icon: 'network',
            detail:
              'Routes model calls to Foundation Model APIs or an external provider and provides usage tracking, rate limits, and audit logs.',
          },
          {
            id: 'uc',
            label: 'Unity Catalog',
            sub: 'grants and audit logs',
            col: 3,
            row: 1,
            kind: 'store',
            domain: 'governance',
            icon: 'checklist',
            detail:
              "Limits data access to the user's own grants, since the agent uses that user's token. Audit logs record the access like any other client.",
          },
          {
            id: 'mlflow',
            label: 'MLflow Tracing',
            sub: 'one trace per turn',
            col: 4,
            row: 1,
            kind: 'store',
            domain: 'ai',
            icon: 'list',
            detail:
              'Receives OpenTelemetry spans from the server, one trace per agent turn, searchable and retained under Unity Catalog governance.',
          },
        ],
        edges: [
          { from: 'dev', to: 'server' },
          { from: 'server', to: 'policy' },
          { from: 'policy', to: 'host' },
          { from: 'host', to: 'agents' },
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
          strong: 'Three layers.',
          text: 'Clients (web UI, native app, mobile, terminal, REST API) attach to a server that keeps history, the catalog, policies, MCPs, artifacts, and skills. A host provides the common API, sandboxing, and reliability, and its runner drives the agents.',
        },
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
        {
          label: 'Omnigent on Databricks',
          url: 'https://docs.databricks.com/aws/en/omnigent/',
          note: 'Managed offering, availability, and limitations.',
        },
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
          text: 'The supported-harness page lists more than a dozen, including Claude Code, Codex, Cursor, OpenCode, Hermes, and Pi, plus any ACP agent. Support levels differ, so check the page for the current list before you promise a vendor.',
        },
        {
          strong: 'No migration.',
          text: 'Omnigent drives the coding agents already installed on your machine, so engineers keep their current setup.',
        },
        {
          strong: 'Add harnesses with a plugin.',
          text: 'A harness plugin is a separate Python package that registers an entry point, so the community can add a runtime without changing the omnigent package. An installed plugin appears in agent YAML, the --harness flag, and the web UI picker.',
        },
        {
          strong: 'One YAML file defines a team.',
          text: 'Combine roles, models, tools, and harnesses in one config. Run it for a single session, or publish it as a shared server template that carries the same policies and sandboxing.',
        },
      ],
      links: [
        { label: 'Supported harnesses', url: 'https://omnigent.ai/docs/build/harnesses' },
        { label: 'Community harnesses', url: 'https://omnigent.ai/docs/build/harnesses/community' },
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
          [
            'Read',
            'Watch messages and tool calls. Workspace files stay hidden unless the owner turns on the Workspace files toggle.',
          ],
          [
            'Edit',
            'Send messages, edit workspace files, and answer approvals. Every action goes through the agent, so policies still apply.',
          ],
          [
            'Owner only',
            'Change MCP servers, the agent bundle, or the permission mode, browse host paths, and run a raw shell command.',
          ],
          ['Fork', 'Copy the conversation and continue independently, even with a different agent.'],
        ],
      },
      points: [
        {
          strong: 'Self-managed servers offer three sign-in modes.',
          text: 'Built-in accounts (username and password with invite links) suit a standalone deploy. OIDC single sign-on works with Google, GitHub, Okta, or Microsoft. Header-based auth sits behind an SSO proxy that injects X-Forwarded-Email.',
        },
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
          text: 'Admins configure session sharing on the server. They can cap sharing at read-only, turn it off, or disable public links. Read access lets others comment on a session. On the managed service, sessions can be shared with other users of the workspace.',
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
      diagram: {
        type: 'matrix',
        title: 'Same action, different answer by data touched',
        description:
          'An agent that touched customer data with PII is asked before it emails a coworker and denied when it tries to publish to the company website. An agent that touched only public information is allowed to do both.',
        corner: 'Agent touched',
        columns: ['Email a coworker', 'Publish to website'],
        rows: [
          {
            label: 'Customer data with PII',
            cells: [
              {
                state: 'optional',
                text: 'ASK',
                sub: 'a person approves',
                detail: 'After touching customer PII, an email to a coworker pauses until a person approves it.',
              },
              {
                state: 'none',
                text: 'DENY',
                sub: 'blocked',
                detail: 'After touching customer PII, publishing to the company website is blocked outright.',
              },
            ],
          },
          {
            label: 'Public information',
            cells: [
              { state: 'own', text: 'ALLOW', sub: 'runs automatically' },
              { state: 'own', text: 'ALLOW', sub: 'runs automatically' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'ALLOW' },
          { state: 'optional', label: 'ASK' },
          { state: 'none', label: 'DENY' },
        ],
        caption: 'Illustrative rules. You define the data classes and the actions each one may take.',
      },
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
          strong: 'Decide on data and action together.',
          text: 'A contextual policy weighs what the agent has touched and what it asks to do, then answers ALLOW, ASK, or DENY for that action. The matrix above shows one example.',
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
        {
          label: 'Policy guide in the repository',
          url: 'https://github.com/omnigent-ai/omnigent/blob/main/docs/POLICIES.md',
        },
      ],
    },
    {
      id: 'gateway',
      heading: 'Omnigent policies and Unity Gateway',
      prose:
        'The two govern different things and work together. Omnigent sees the whole run, including actions that never leave the machine. Unity Gateway sees each request that reaches a model or an MCP service.',
      table: {
        caption: 'Where each one enforces',
        columns: ['Layer', 'What it governs'],
        rows: [
          [
            'Omnigent policies',
            'The full run and its trajectory. Stateful policies span a multi-step session, such as cumulative spend, tool-call counts, and a running risk score. Local actions with no network egress, such as ls, rm -rf, and cat, are gated in the loop before they run. An OS sandbox limits local files and network.',
          ],
          [
            'Unity Gateway (formerly AI Gateway)',
            'Each request to a model or MCP service. Unity Catalog permissions control access to the AI assets. Inference tables log model requests and responses to Delta tables. Budgets set per-user thresholds and hard limits. Cost is broken down by service, model, and requesting principal, with request tags for usage analysis.',
          ],
          [
            'Together',
            'Omnigent gates what the agent does on the host. Unity Gateway governs and audits what leaves the host for a model.',
          ],
        ],
      },
      points: [
        {
          strong: 'A gateway cannot see local actions.',
          text: 'A file read or a shell delete never crosses the network, so only a policy inside the agent loop can stop it.',
        },
        {
          strong: 'Self-managed servers need their own gateway setup.',
          text: 'Route model calls through Unity Gateway to get its permissions, logging, and budgets. The managed service wires this in for you.',
        },
      ],
      links: [
        { label: 'Unity Gateway', url: 'https://docs.databricks.com/aws/en/unity-gateway/' },
        { label: 'Manage budgets for Unity Gateway', url: 'https://docs.databricks.com/aws/en/ai-gateway/budgets' },
        {
          label: 'Analyze Unity Gateway cost',
          url: 'https://docs.databricks.com/aws/en/ai-gateway/cost-observability',
        },
        {
          label: 'Log requests and responses to inference tables',
          url: 'https://docs.databricks.com/aws/en/ai-gateway/inference-tables',
        },
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
          [
            'Host',
            'Run the session on a sandbox host, such as a micro-VM, a Kubernetes pod, or a cloud sandbox, away from your laptop and other sessions.',
          ],
          [
            'Shell commands',
            'The blast_radius policy allows safe commands, asks on risky ones such as git push or gh pr merge, and always denies force-push and rm -rf of the root.',
          ],
          [
            'MCP tools',
            'Name the tools a server exposes in the agent YAML. Only the session owner can add, edit, or remove MCP servers.',
          ],
          [
            'File writes',
            'worktree_guard keeps writes inside a worker’s worktree, and read_only_os makes a report-only agent.',
          ],
          [
            'Working directory',
            'block_working_dir_changes denies cd, git -C, and worktree changes outside allowed directories.',
          ],
          [
            'OS sandbox',
            'Omnibox restricts the filesystem and network for the agent process and every subprocess it spawns.',
          ],
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
          strong: 'Omnibox is a kernel-enforced OS sandbox.',
          text: 'It uses Bubblewrap and seccomp on Linux and Seatbelt on macOS. It isolates the filesystem, restricts network traffic through a default-deny proxy when you set egress rules, injects credentials so the agent holds only a placeholder, and contains child processes. A server can enforce one sandbox config on every host, or a host can define its own.',
        },
        {
          strong: 'Use sandbox hosts for shared work.',
          text: 'The sandbox providers include Microsandbox micro-VMs, Kubernetes with an optional Kata or gVisor runtime class, and several cloud sandbox services. On Databricks, the managed service can launch Databricks Sandboxes in select AWS regions.',
        },
        {
          strong: 'Cloud sandboxes suit always-on work.',
          text: 'Providers such as Modal and Daytona give scalable, reproducible environments. For open source, you source and configure the provider yourself.',
        },
        {
          strong: 'The Databricks Sandbox host (Beta) runs in the serverless compute plane.',
          text: 'You reach it over SSH, and its home directory persists when you stop and restart it. Treat it as Beta: Databricks may purge sandbox data at the end of the Beta period.',
        },
      ],
      examples: [
        {
          label: 'An OS sandbox in agent YAML',
          language: 'yaml',
          code: `os_env:
  type: caller_process
  cwd: .
  sandbox:
    type: darwin_seatbelt   # linux_bwrap on Linux
    read_paths: [~/.gitconfig]
    write_paths: [.]
    allow_network: true`,
          notes: [
            'The repository docs use these keys: type, read_paths, write_paths, and allow_network. Dotfiles stay masked unless you grant them.',
            'Set the sandbox type to match the host operating system.',
          ],
        },
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
          {
            id: 'bundle',
            label: 'Automation Bundle',
            sub: 'databricks.yml',
            col: 0,
            row: 0,
            domain: 'orchestration',
            icon: 'workflow',
            detail:
              'The Declarative Automation Bundle (databricks.yml) that deploys the Omnigent server to Databricks Apps in the self-managed route.',
          },
          {
            id: 'app',
            label: 'Omnigent server',
            sub: 'on Databricks Apps',
            col: 1,
            row: 0,
            kind: 'highlight',
            domain: 'apps',
            icon: 'gear-navy',
            detail:
              'The Omnigent server running on Databricks Apps. Users sign in with workspace identity and reach it with per-user OAuth.',
          },
          {
            id: 'users',
            label: 'Users',
            sub: 'per-user OAuth',
            col: 2,
            row: 0,
            domain: 'neutral',
            icon: 'users',
            detail:
              'Each user connects from Settings and authorizes with OAuth U2M after an admin registers the Databricks OAuth app once.',
          },
          {
            id: 'lake',
            label: 'Lakebase',
            sub: 'sessions and state',
            col: 0,
            row: 1,
            kind: 'store',
            domain: 'data',
            icon: 'cloud-database',
            detail: 'One Lakebase project per app holds sessions and server state in the self-managed setup.',
          },
          {
            id: 'vol',
            label: 'Unity Catalog volume',
            sub: 'agent bundles',
            col: 1,
            row: 1,
            kind: 'store',
            domain: 'data',
            icon: 'data-file',
            detail:
              "A Unity Catalog volume that stores agent bundles. Its catalog and schema grant access to the app's service principal.",
          },
          {
            id: 'gw',
            label: 'Unity Gateway',
            sub: 'model access',
            col: 2,
            row: 1,
            kind: 'gate',
            domain: 'governance',
            icon: 'network',
            detail:
              "Sends the server's model calls through Foundation Model APIs or an external provider with usage tracking, rate limits, and audit logs.",
          },
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
      options: {
        caption: 'Where to run the Omnigent server',
        rows: [
          {
            option: 'Managed: Omnigent on Databricks (Beta)',
            when: 'Default choice. Your workspace identity provider, Foundation Model APIs, and Unity Gateway are wired in.',
            tradeoffs:
              'Databricks operates the server and can run sessions on a Databricks Sandbox host. It is Beta and needs a region that supports Unity Gateway. A Databricks Sandbox host takes models only through Unity Gateway, so you cannot bring your own model API keys there.',
          },
          {
            option: 'Self-managed on Databricks Apps',
            when: 'You need custom YAML policies, your own provider API keys, custom egress controls, or the managed service is not in your region.',
            tradeoffs:
              'Most control. You deploy the server and host, route model, MCP, and skill access through Unity Gateway yourself, source your own sandbox provider, and own upgrades and operations.',
          },
          {
            option: 'Open-source Omnigent without Databricks',
            when: 'A small group wants to try it with their own machine and model keys.',
            tradeoffs:
              'Apache 2.0 and quick to start. You lose workspace identity, governed models, and tracing, and the project labels itself alpha.',
          },
        ],
        recommendation:
          'Use the managed service for a pilot when your region supports it, and self-manage on Apps when a policy, key, or region requirement rules it out.',
      },
      links: [
        { label: 'Omnigent on Databricks', url: 'https://docs.databricks.com/aws/en/omnigent/' },
        { label: 'Connect Databricks (per-user OAuth)', url: 'https://omnigent.ai/docs/deploy/databricks-connect' },
        {
          label: 'Deploy on Databricks Apps',
          url: 'https://github.com/omnigent-ai/omnigent/tree/main/deploy/databricks',
        },
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
          [
            'Do we need Databricks to use Omnigent?',
            'No. It is open source under Apache 2.0 and runs with your own machine and model keys. Databricks adds identity, governed models, tracing, and a managed server.',
          ],
          [
            'Which models can we use?',
            'Your own API keys, Claude or ChatGPT plans, compatible gateways, or a Databricks workspace. A Databricks Sandbox host allows only models through Unity Gateway.',
          ],
          [
            'Can a prompt injection bypass a policy?',
            'The server enforces policies around each action, so instructions in a prompt cannot turn a DENY into an ALLOW. A policy that runs after a tool call cannot undo that call, so gate destructive actions before the call.',
          ],
          [
            'Can a teammate with Edit change my agent’s tools?',
            'No. MCP servers, the agent bundle, the permission mode, and the raw shell are owner-only.',
          ],
          [
            'Is it ready for production?',
            'The project labels itself alpha and the Databricks offering is in Beta. Pilot with a small group and re-check the release notes before a wide rollout.',
          ],
          ['Can we run it from CI?', 'Yes, through the Python SDK and the REST API.'],
          [
            'Where do the audit records live?',
            'Policy decisions are visible in the session. On Databricks, model calls are audited at Unity Gateway, traces go to MLflow Tracing, and data access appears in Unity Catalog audit logs.',
          ],
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
