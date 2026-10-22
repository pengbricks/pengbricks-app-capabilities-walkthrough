import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'genie-external-ai',
  area: 'AI Guides',
  title: 'Genie and Databricks MCP with ChatGPT, Gemini, and Copilot',
  intro:
    'People already work in ChatGPT, Gemini, Microsoft Copilot Studio, and Teams. Databricks can meet them there: an outside assistant connects to a Databricks MCP endpoint, the user signs in with their own identity, and a Genie Agent answers from Unity Catalog data under that user’s permissions. Below are the paths, the setup for each assistant, the identity and governance choices, and what leaves Databricks. Genie Agent setup is in the Genie Agents guide, and MCP hosting and Unity Gateway are in the agents, MCP, and model gateway guide.',
  businessValue: {
    summary:
      'Business users ask governed data questions from the assistant they already use. It is for data and security leads who want that reach without copying data or loosening Unity Catalog permissions.',
    outcomes: [
      {
        title: 'Answers where people work',
        body: 'Sales, finance, and operations staff ask Genie from ChatGPT, Gemini, Copilot Studio, or Teams, so adoption does not depend on a new login habit.',
      },
      {
        title: 'Permissions travel with the person',
        body: 'With per-user sign-in, Unity Catalog applies grants, row filters, and column masks to the asker. The assistant cannot return more than that person could see in Databricks.',
      },
      {
        title: 'A short, reviewable tool list',
        body: 'Security approves one endpoint and a few tools per assistant instead of a connector with broad SQL access. Read-only Genie calls are easy to explain.',
      },
      {
        title: 'Outside calls are auditable',
        body: 'Gateway usage and Genie query history show which tools were called and which statements ran, so a review of outside access starts from data and not from assumptions.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Use the managed MCP endpoint first.',
      body: 'The Genie One MCP server, system.ai.genie_one_mcp, is generally available since September 25, 2026 and needs nothing to host. Use the Genie Agent MCP server when one curated agent must be the only source. Build a custom MCP server on Apps only when you own tools Genie cannot cover.',
    },
    {
      title: 'Sign users in one by one.',
      body: 'Per-user OAuth makes Unity Catalog decide each answer. A service principal gives every caller the same view, so use it for unattended jobs and shared dashboards, not for people.',
    },
    {
      title: 'Plan one account-level step.',
      body: 'Databricks MCP endpoints do not support dynamic client registration, so assistants that need a client ID rely on a custom OAuth app connection in the account console. Ask an account admin early. The Teams app and the Managed MCP preview need admin steps too.',
    },
    {
      title: 'Expose a Genie Agent, not raw SQL.',
      body: 'A Genie Agent carries curated definitions and returns read-only answers. A SQL tool lets the assistant write any statement the user may run, which widens review and cost.',
    },
    {
      title: 'Match the assistant to the audience.',
      body: 'Teams and Copilot Studio fit Microsoft 365 organizations. ChatGPT and Gemini Enterprise need an admin to create the connector. Gemini CLI and Claude Code fit developers who sign in themselves.',
    },
    {
      title: 'Audit from system tables.',
      body: 'Gateway MCP calls land in system.ai_gateway.usage. The Genie Agent endpoint skips the gateway, so read system.query.history for its statements.',
    },
  ],
  prerequisites: [
    {
      slug: 'genie-agents',
      title: 'Genie Agents: setup, instructions, and data handling',
      why: 'The assistant calls a Genie Agent, so its tables, instructions, and permissions have to be right first.',
    },
    {
      slug: 'agent-framework-support',
      title: 'Agents, MCP, and model gateway',
      why: 'It covers hosting MCP servers on Apps, Unity Gateway, and the identity choices that apply here.',
    },
  ],
  sections: [
    {
      id: 'paths',
      heading: 'Paths for an outside assistant',
      prose:
        'Four paths reach Databricks data from outside. Three use MCP, and one is a packaged app. The agents, MCP, and model gateway guide explains the server types, so this table covers what matters to an outside caller: the URL, the sign-in scope, and the release stage.',
      table: {
        caption: 'Endpoints an outside assistant can connect to',
        columns: ['Path', 'Endpoint, sign-in, and stage'],
        rows: [
          [
            'Genie One MCP server',
            'https://<workspace-host>/ai-gateway/mcp-services/system.ai.genie_one_mcp. OAuth scope ai-gateway. Tools: genie_ask, genie_poll_response, genie_get_query_result, genie_cancel_response, and view_ask for MCP Apps clients. Generally available since September 25, 2026.',
          ],
          [
            'Genie Agent MCP server',
            'https://<workspace-host>/api/2.0/mcp/genie/<genie-space-id>. OAuth scope genie. Read-only, no conversation history, and calls skip Unity Gateway. A workspace admin enables Managed MCP Servers on the Previews page (Public Preview since January 27, 2026). The URL shares its prefix with the Beta endpoint that sunsets October 31, 2026, so re-check it on the Genie Agent MCP page before a rollout.',
          ],
          [
            'Other managed servers',
            'system.ai.dbsql, system.ai.web_search, and system.ai.sandbox sit behind the same /ai-gateway/mcp-services/ path and are Beta, with Unity Gateway Beta enabled from the account console. Older workspace paths /api/2.0/mcp/sql, /ai-search/, and /functions/ still work and bypass Unity Gateway.',
          ],
          [
            'Custom MCP server on Apps',
            'The app URL with /mcp appended. Streamable HTTP. Callers need CAN USE on the app. Name the app with the mcp- prefix so AI Playground finds it.',
          ],
          [
            'Genie app in Teams',
            'A packaged app, no MCP setup. Public Preview since July 17, 2026 (Beta from June 10, 2026). Users enter a workspace URL and sign in.',
          ],
        ],
      },
      options: {
        caption: 'Managed MCP, a custom MCP server on Apps, or the Teams app',
        rows: [
          {
            option: 'Managed MCP server (Genie One or Genie Agent)',
            when: 'The assistant needs governed Genie answers and supports a remote MCP URL with OAuth.',
            tradeoffs:
              'Nothing to host or patch. You get the tools Databricks ships and no more. Genie One is generally available and goes through Unity Gateway. The Genie Agent endpoint is in preview and skips the gateway, so its controls are the agent ACL and the data grants.',
          },
          {
            option: 'Custom MCP server on Databricks Apps',
            when: 'You own tools Genie cannot cover, such as a write action, a metric API, or a stable tool set you version.',
            tradeoffs:
              'Full control of tool names, arguments, and identity, per tool. You build, deploy, and operate it, and the app bills while it runs. The assistant still needs the same OAuth registration.',
          },
          {
            option: 'Genie app in Microsoft Teams',
            when: 'The audience works in Teams and wants chat answers with no assistant configuration.',
            tradeoffs:
              'Fastest rollout for Microsoft 365 users, with per-user sign-in. It is Genie only. Answers stay in Teams, and the preview needs an account admin toggle and a Microsoft 365 admin install.',
          },
        ],
        recommendation:
          'Start with the managed Genie One MCP server for MCP-capable assistants and the Teams app for Microsoft 365 users. Add a custom server on Apps only when a tool has no managed equivalent.',
      },
      links: [
        {
          label: 'Genie One MCP server',
          url: 'https://docs.databricks.com/aws/en/agents/mcp-tools/genie-mcp',
          note: 'Endpoint, tools, and the sunset of the Beta endpoint on October 31, 2026.',
        },
        {
          label: 'Genie Agent MCP server',
          url: 'https://docs.databricks.com/aws/en/agents/mcp-tools/genie-agent',
        },
        {
          label: 'Databricks-provided MCP services',
          url: 'https://docs.databricks.com/aws/en/agents/mcp-tools/built-in-mcp-services',
        },
        {
          label: 'Custom MCP servers on Apps',
          url: 'https://docs.databricks.com/aws/en/agents/mcp-tools/custom-mcp',
        },
      ],
    },
    {
      id: 'flow',
      heading: 'From the assistant to governed data',
      prose:
        'Every MCP path follows the same route. The assistant starts an OAuth sign-in, receives a token for the user, and calls the Databricks endpoint with it. Genie or a function runs under that identity, and Unity Catalog checks the data.',
      diagram: {
        type: 'flow',
        title: 'An outside assistant calling Genie',
        description:
          'A user asks a question in an outside assistant. The assistant signs the user in through a Databricks OAuth app connection and calls the Databricks MCP endpoint with the user token. The endpoint calls a Genie Agent or a Unity Catalog function, which reads Unity Catalog data under the user’s permissions. Gateway usage and query history record the call. An account admin registers the OAuth app connection.',
        nodes: [
          {
            id: 'assistant',
            label: 'Outside assistant',
            sub: 'ChatGPT, Gemini, Copilot',
            col: 0,
            row: 0,
            kind: 'surface',
            icon: 'saas',
            domain: 'apps',
            detail:
              'The tool the user already works in. It sends the question as an MCP tool call and shows the answer. What it keeps depends on the vendor and plan.',
          },
          {
            id: 'oauth',
            label: 'OAuth sign-in',
            sub: 'per-user token',
            col: 1,
            row: 0,
            icon: 'id-provider',
            domain: 'governance',
            detail:
              'The user signs in to Databricks and the assistant receives a token scoped to that user. Scope is ai-gateway for the gateway endpoints and genie for the Genie Agent endpoint.',
          },
          {
            id: 'mcp',
            label: 'Databricks MCP endpoint',
            sub: 'managed or on Apps',
            col: 2,
            row: 0,
            kind: 'highlight',
            icon: 'network',
            domain: 'ai',
            detail:
              'A Streamable HTTP endpoint on the workspace host. It lists the tools the caller may use and runs the tools/call request as that caller.',
          },
          {
            id: 'agent',
            label: 'Genie Agent',
            sub: 'curated, read-only',
            col: 3,
            row: 0,
            icon: 'gear-lava',
            domain: 'ai',
            detail:
              'Writes read-only SQL from the agent’s curated sources and runs it on its SQL warehouse. Returns the answer and the generated SQL.',
          },
          {
            id: 'uc',
            label: 'Unity Catalog data',
            sub: 'grants, filters, masks',
            col: 4,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'governance',
            detail:
              'Checks every table against the asking user, so row filters and column masks apply. Data stays here and only the answer travels out.',
          },
          {
            id: 'admin',
            label: 'Account admin',
            sub: 'OAuth app connection',
            col: 1,
            row: 1,
            icon: 'users',
            domain: 'neutral',
            detail:
              'Registers the custom OAuth app connection for clients that cannot register themselves. This is an account-level action, so an account admin does it.',
          },
          {
            id: 'fn',
            label: 'UC function tool',
            sub: 'optional custom tool',
            col: 3,
            row: 1,
            icon: 'gear-data',
            domain: 'data',
            detail:
              'A Unity Catalog function or custom tool on Apps, exposed over MCP. Callers need EXECUTE on it, and it can run as the user or as the app.',
          },
          {
            id: 'audit',
            label: 'System tables',
            sub: 'usage, query history',
            col: 2,
            row: 1,
            icon: 'list',
            domain: 'governance',
            detail:
              'system.ai_gateway.usage records gateway MCP calls. system.query.history records the statements a Genie Agent ran, with who asked and which warehouse.',
          },
        ],
        edges: [
          { from: 'assistant', to: 'oauth', label: 'sign in' },
          { from: 'oauth', to: 'mcp', label: 'user token' },
          { from: 'mcp', to: 'agent', label: 'genie tool' },
          { from: 'agent', to: 'uc', label: 'as the asker' },
          { from: 'admin', to: 'oauth', label: 'registers', dashed: true },
          { from: 'mcp', to: 'audit', label: 'recorded', dashed: true },
          { from: 'fn', to: 'uc' },
        ],
        legend: [
          { kind: 'surface', label: 'Where users ask' },
          { kind: 'highlight', label: 'What you expose' },
          { kind: 'store', label: 'Governed data' },
        ],
      },
    },
    {
      id: 'assistants',
      heading: 'Which assistant, for which audience',
      prose:
        'Each assistant has its own sign-in screen, its own admin switch, and its own limits. The table compares them. The sections after it give the steps.',
      diagram: {
        type: 'matrix',
        title: 'Assistants side by side',
        description:
          'ChatGPT, Gemini Enterprise, Gemini CLI, Copilot Studio, the Teams app, and Claude Code compared on who sets them up, the sign-in model, what the user can do, and the main limit.',
        corner: 'Assistant',
        columns: ['Who sets it up', 'Sign-in', 'What the user can do', 'Main limit'],
        rows: [
          {
            label: 'ChatGPT',
            sub: 'custom MCP server',
            cells: [
              { state: 'own', text: 'Workspace admin or owner', sub: 'Business: admins only' },
              { state: 'own', text: 'OAuth per user', sub: 'client ID from you' },
              { state: 'own', text: 'Call Genie tools in chat' },
              { state: 'optional', text: 'Web only', sub: 'not mobile' },
            ],
          },
          {
            label: 'Gemini Enterprise',
            sub: 'custom MCP data store',
            cells: [
              { state: 'own', text: 'Google Cloud admin', sub: 'org policy override' },
              { state: 'own', text: 'OAuth 2.0 per user' },
              { state: 'own', text: 'Enabled actions only', sub: 'off by default' },
              { state: 'optional', text: '100 actions', sub: 'per data store' },
            ],
          },
          {
            label: 'Gemini CLI',
            sub: 'settings.json',
            cells: [
              { state: 'own', text: 'The developer' },
              { state: 'own', text: 'OAuth per user', sub: 'in the CLI' },
              { state: 'own', text: 'Call tools from a terminal' },
              { state: 'optional', text: 'Local machine' },
            ],
          },
          {
            label: 'Copilot Studio',
            sub: 'Databricks Genie tool',
            cells: [
              { state: 'own', text: 'Power Platform maker', sub: 'plus workspace admin' },
              { state: 'own', text: 'Connection', sub: 'see the Copilot Studio step' },
              { state: 'own', text: 'Genie inside a custom agent' },
              { state: 'optional', text: 'Preview', sub: 'Managed MCP on' },
            ],
          },
          {
            label: 'Teams app',
            sub: 'Databricks Genie',
            cells: [
              { state: 'own', text: 'Account admin and M365 admin' },
              { state: 'own', text: 'Workspace URL, then sign in' },
              { state: 'own', text: 'Ask Genie in chat' },
              { state: 'optional', text: 'Public Preview' },
            ],
          },
          {
            label: 'Claude Code',
            sub: 'claude mcp add',
            cells: [
              { state: 'own', text: 'The developer' },
              { state: 'own', text: 'OAuth per user', sub: 'client ID from you' },
              { state: 'own', text: 'Call tools from a terminal' },
              { state: 'optional', text: 'Local machine' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Documented by the vendor' },
          { state: 'optional', label: 'Limit to plan for' },
        ],
      },
      options: {
        caption: 'Which assistant for which audience',
        rows: [
          {
            option: 'Teams app or Copilot Studio',
            when: 'The audience is in Microsoft 365 and the company standard is Teams.',
            tradeoffs:
              'Least setup for end users. Both are previews, so check support terms before a broad rollout. Copilot Studio lets you wrap Genie in a custom agent with other tools, at the cost of more to maintain.',
          },
          {
            option: 'ChatGPT or Gemini Enterprise',
            when: 'The company has licensed one of them for staff and wants data questions in the same place.',
            tradeoffs:
              'An admin creates and publishes the connector once. Each user signs in to Databricks. Users see only the tools you enable, and what the vendor retains follows your plan with them.',
          },
          {
            option: 'Gemini CLI or Claude Code',
            when: 'Developers and analysts who already work in a terminal.',
            tradeoffs:
              'Each person configures their own client, so there is no central switch except the OAuth app connection. Good for a pilot. Weak for a controlled audience.',
          },
        ],
        recommendation:
          'Pick the assistant the audience already uses and has licensed. Pilot in Teams or a CLI, then publish a connector in ChatGPT or Gemini Enterprise once the tool list is settled.',
      },
    },
    {
      id: 'chatgpt',
      heading: 'ChatGPT',
      prose:
        'ChatGPT connects to remote MCP servers from custom MCP server connections on the web. On Business, only workspace admins and owners can create and publish them. On Enterprise and Edu, admins can grant selected members permission to create them, and only admins and owners publish. Mobile is not supported.',
      steps: [
        {
          title: 'Register an OAuth app connection in Databricks',
          body: 'An account admin adds a connection in the account console under Settings, App connections. Enter the redirect URL that ChatGPT gives you for the connector and the ai-gateway scope for the Genie One endpoint. Generate a client secret if the ChatGPT form asks for one. OpenAI does not document where its OAuth form takes a client ID, so test this step before you plan a rollout. Changes take up to 30 minutes.',
        },
        {
          title: 'Add the server in ChatGPT',
          body: 'Open Plugins, select the plus button, then Add custom MCP server. Enter a name, the endpoint https://<workspace-host>/ai-gateway/mcp-services/system.ai.genie_one_mcp, and choose OAuth. Acknowledge the risk warning, then select Create as a plugin and review the discovered tools. Older workspaces show Settings, Apps, Create instead, where you select Scan Tools.',
        },
        {
          title: 'Keep the sign-in alive',
          body: 'Request offline_access so the provider issues refresh tokens. OpenAI notes that without refresh tokens users may need to sign in again when access expires.',
        },
      ],
      links: [
        {
          label: 'OpenAI: connecting custom MCP servers in ChatGPT',
          url: 'https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt',
        },
        { label: 'OpenAI privacy policy', url: 'https://openai.com/policies/privacy-policy/' },
      ],
    },
    {
      id: 'gemini',
      heading: 'Gemini CLI and Gemini Enterprise',
      prose:
        'Gemini has two routes. Gemini CLI reads remote servers from settings.json and handles the OAuth sign-in in the terminal. Gemini Enterprise adds a Custom MCP Server data store that an administrator creates once for the organization.',
      steps: [
        {
          title: 'Gemini CLI',
          body: 'Add the server to ~/.gemini/settings.json, then run /mcp auth databricks-genie in the CLI and sign in. Gemini CLI stores tokens in ~/.gemini/mcp-oauth-tokens.json and refreshes them. Use httpUrl for Streamable HTTP and includeTools to expose only the Genie tools.',
          code: `{
  "mcpServers": {
    "databricks-genie": {
      "httpUrl": "https://<workspace-host>/ai-gateway/mcp-services/system.ai.genie_one_mcp",
      "oauth": {
        "enabled": true,
        "clientId": "<oauth-app-client-id>",
        "scopes": ["ai-gateway", "offline_access"],
        "authorizationUrl": "https://<workspace-host>/oidc/v1/authorize",
        "tokenUrl": "https://<workspace-host>/oidc/v1/token",
        "redirectUri": "http://localhost:7777/oauth/callback"
      },
      "includeTools": ["genie_ask", "genie_poll_response", "genie_get_query_result"]
    }
  }
}`,
        },
        {
          title: 'Gemini Enterprise',
          body: 'In Google Cloud, open Gemini Enterprise, then Data stores, Create data store, and choose Custom MCP Server. Enter the endpoint and choose OAuth 2.0 with the authorization URL, token URL, client ID, client secret, and scopes. Register https://vertexaisearch.cloud.google.com/oauth-redirect as the redirect URI in the Databricks app connection. After the store is Active, use Reload custom actions and enable only the tools you want, because all actions start disabled. The administrator needs the Discovery Engine Editor role and an organization policy override. The connector supports Streamable HTTP only, with a publicly trusted TLS certificate, and at most 100 enabled actions.',
        },
      ],
      links: [
        {
          label: 'Gemini CLI: MCP servers',
          url: 'https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md',
        },
        {
          label: 'Gemini Enterprise: set up a custom MCP server data store',
          url: 'https://docs.cloud.google.com/gemini/enterprise/docs/connectors/custom-mcp-server/set-up-custom-mcp-server',
        },
        { label: 'Google privacy policy', url: 'https://policies.google.com/privacy' },
      ],
    },
    {
      id: 'copilot',
      heading: 'Microsoft Copilot Studio and Copilot Cowork',
      prose:
        'Copilot Studio adds a Databricks Genie tool to a custom agent. Genie Agents as Copilot Studio tools have been in Public Preview since November 14, 2025, and the workspace needs the Managed MCP Servers preview. Connecting Genie to Microsoft Copilot Cowork through the Genie managed MCP server has been in Beta since June 16, 2026.',
      steps: [
        {
          title: 'Prepare Databricks',
          body: 'A workspace admin turns on Managed MCP Servers on the Previews page. Give the Genie Agent a clear name and description, because Copilot Studio uses them to choose the tool. Create a Databricks connection in Microsoft Power Platform. The Databricks page does not say whether that connection signs in per user or uses a service principal, so check the connection type before you share the agent.',
        },
        {
          title: 'Add the tool',
          body: 'In Copilot Studio, create or open an agent and choose a model (Databricks recommends Sonnet 4.5 and does not require it). Add the instruction "Always continue polling the Genie Agent until you receive a response. Do not stop after a few seconds." Under Tools, add a tool, search Databricks or select Model Context Protocol, choose Databricks Genie, pick your connection, and set the Agent ID.',
        },
        {
          title: 'Publish',
          body: 'In Settings, under Orchestration, set AI orchestration to Yes, then publish. Publish the agent to Teams or Microsoft 365 to share it, or call it from Power Apps.',
        },
      ],
      links: [
        {
          label: 'Use Databricks data in Microsoft Copilot Studio',
          url: 'https://docs.databricks.com/aws/en/integrations/msft-power-platform/copilot-studio',
        },
        { label: 'Microsoft privacy statement', url: 'https://privacy.microsoft.com/en-us/privacystatement' },
      ],
    },
    {
      id: 'teams',
      heading: 'The Genie app in Microsoft Teams',
      prose:
        'The Databricks Genie app brings Genie into Teams chat. It went to Beta on June 10, 2026 and to Public Preview on July 17, 2026. In August 2026 the sign-in changed from a server hostname to the workspace URL. Questions and history are processed in the user’s workspace region, and the docs say the central request service in East US 2 does not persist or log request or answer content.',
      steps: [
        {
          title: 'Account admin',
          body: 'Enable Databricks Genie for Microsoft Teams on the account console Previews page. This is an account-level setting. A workspace admin checks the security settings Allow connection to collaboration platforms and Allow public messages in collaboration platforms. With the second off, every response is private to the asker.',
        },
        {
          title: 'Microsoft 365 admin',
          body: 'Find Databricks Genie in the Microsoft marketplace, install it, and approve the requested permissions. If users see Need admin approval, a Microsoft Entra administrator grants tenant-wide consent to the Databricks enterprise application.',
        },
        {
          title: 'Each user',
          body: 'In Teams, open Apps, then Databricks Genie, and ask a question. When prompted, select Configure, enter the workspace URL, and sign in to Databricks. If the workspace uses IP access lists, add the East US 2 control plane outbound IPs. File upload needs the Genie One File Upload preview and OneDrive for Business. Limits are 5 files per message and 20 MiB per file, in direct messages only.',
        },
      ],
      links: [
        {
          label: 'Databricks Genie app in Microsoft Teams',
          url: 'https://docs.databricks.com/aws/en/integrations/msft-teams',
        },
      ],
    },
    {
      id: 'claude',
      heading: 'Claude Code',
      prose:
        'Claude Code needs two commands. Because Databricks does not support dynamic client registration, pass the client ID from your app connection and a fixed callback port that matches its redirect URL, http://localhost:8080/callback in this example.',
      steps: [
        {
          title: 'Add the server',
          body: 'Run the command, enter the client secret at the masked prompt, then run /mcp inside Claude Code and sign in.',
          code: `claude mcp add --transport http \\
  --client-id <oauth-app-client-id> \\
  --client-secret \\
  --callback-port 8080 \\
  databricks-genie https://<workspace-host>/ai-gateway/mcp-services/system.ai.genie_one_mcp`,
        },
      ],
      links: [
        { label: 'Claude Code: connect to MCP servers', url: 'https://code.claude.com/docs/en/mcp' },
        { label: 'Anthropic privacy policy', url: 'https://www.anthropic.com/legal/privacy' },
      ],
    },
    {
      id: 'identity',
      heading: 'Identity: whose permissions apply',
      prose:
        'The agents, MCP, and model gateway guide compares the app identity with on-behalf-of access. For outside assistants, use a person’s token for questions a person asks.',
      options: {
        caption: 'Per-user OAuth or a service principal',
        rows: [
          {
            option: 'Per-user OAuth (on behalf of the user)',
            when: 'A person asks the question and the answer must follow their grants, row filters, and column masks.',
            tradeoffs:
              'Unity Catalog decides each answer, and the audit trail names the person. Each user signs in once, and refresh tokens keep it from repeating. It needs a registered OAuth app connection for clients without dynamic registration.',
          },
          {
            option: 'Service principal (OAuth M2M)',
            when: 'An unattended agent or scheduled workflow calls the endpoint, with no person present.',
            tradeoffs:
              'One identity and one set of grants to review. Every caller sees what the principal sees, so row filters and masks cannot vary by person. Never put it behind a shared chat assistant for staff with different access.',
          },
        ],
        recommendation:
          'Use per-user OAuth for any assistant a person types into. Keep service principals for unattended jobs, with least-privilege grants.',
      },
      points: [
        {
          strong: 'Scopes decide what the token can reach.',
          text: 'Use ai-gateway for gateway-hosted servers such as Genie One and genie for the Genie Agent endpoint. Request offline_access for refresh tokens. A custom OAuth app also includes openid, email, and profile, plus the SQL or All APIs scope you select.',
        },
        {
          strong: 'The OAuth app connection is account level.',
          text: 'Creating one in the account console, under Settings, App connections, is an account admin action. Public clients get no secret, and server-side clients do. Access tokens last 60 minutes by default and refresh tokens last 10,080 minutes. No step here creates one for you.',
        },
        {
          strong: 'Apps servers add CAN USE.',
          text: 'For a custom server on Apps, callers need CAN USE on the app, plus the app’s user authorization scopes.',
        },
      ],
      links: [
        {
          label: 'Authentication for MCP clients',
          url: 'https://docs.databricks.com/aws/en/agents/mcp-tools/authentication-networking',
        },
        {
          label: 'Custom OAuth app connections',
          url: 'https://docs.databricks.com/aws/en/integrations/enable-disable-oauth',
        },
      ],
    },
    {
      id: 'tools',
      heading: 'What to expose',
      prose: 'The tool list is the control that matters most. Keep it short, read-only, and tied to a curated source.',
      options: {
        caption: 'A Genie Agent or raw SQL tools',
        rows: [
          {
            option: 'Genie tools (Genie One or one Genie Agent)',
            when: 'Business users ask questions in plain language over curated tables or a metric view.',
            tradeoffs:
              'Definitions live in the agent, answers are read-only, and cost follows SQL warehouse use. Genie can ask a clarifying question or answer in text only. The agent endpoint keeps no conversation history.',
          },
          {
            option: 'Raw SQL tools (system.ai.dbsql, legacy /mcp/sql)',
            when: 'Engineers need arbitrary queries from a coding agent.',
            tradeoffs:
              'Any statement the user may run is allowed, so a wrong join or a large scan is possible. dbsql is Beta, and the legacy path bypasses Unity Gateway. Review cost and exposure for each user.',
          },
          {
            option: 'Unity Catalog function tools',
            when: 'A fixed, tested computation must run the same way every time.',
            tradeoffs:
              'Callers need EXECUTE, logic stays hidden, and results are predictable. Each function is a tool to maintain, and a function can only do what you wrote.',
          },
        ],
        recommendation:
          'Expose Genie tools to business users. Keep raw SQL for developer assistants, and use functions for fixed logic.',
      },
      points: [
        {
          strong: 'Select tools at registration.',
          text: 'Unity Gateway lets you choose tools by name or pattern. Unselected tools do not appear in tools/list and return an error when called. In Gemini CLI use includeTools. In Gemini Enterprise enable only the actions you want.',
        },
        {
          strong: 'Grant the MCP service, not the connection.',
          text: 'Callers need EXECUTE on the MCP, USE CATALOG on its catalog, and USE SCHEMA on its schema. End users do not need USE CONNECTION.',
        },
        {
          strong: 'Policies and limits are Beta or per minute.',
          text: 'MCP policies for sensitive data detection, custom SQL conditions, and external guardrails are Beta. Rate limits apply to tools/call in queries per minute and return HTTP 429 when exceeded. Jailbreak screening of MCP tool calls is in Beta as of October 2026.',
        },
      ],
      links: [
        {
          label: 'Govern an MCP',
          url: 'https://docs.databricks.com/aws/en/ai-gateway/govern-mcp-service',
        },
      ],
    },
    {
      id: 'audit',
      heading: 'Audit the outside calls',
      prose:
        'Two system tables cover the two endpoint families. Gateway endpoints write to system.ai_gateway.usage, and any Genie Agent writes its statements to system.query.history. The first query uses the documented columns, and select all columns once to see which one holds the caller.',
      steps: [
        {
          title: 'Gateway MCP calls',
          body: 'Count the tools called on the Genie One server.',
          code: `SELECT mcp_metadata.tool_name AS tool_name, COUNT(*) AS calls
FROM system.ai_gateway.usage
WHERE service_type = 'MCP_SERVICE'
  AND service_name = 'system.ai.genie_one_mcp'
GROUP BY mcp_metadata.tool_name
ORDER BY calls DESC;`,
        },
        {
          title: 'Statements a Genie Agent ran',
          body: 'Replace the ID with the agent behind the MCP endpoint. executed_as is the asking user, and the warehouse is the agent’s.',
          code: `SELECT executed_by, executed_as, compute.warehouse_id, client_application, start_time
FROM system.query.history
WHERE query_source.genie_space_id = '<genie-space-id>'
ORDER BY start_time DESC;`,
        },
      ],
      points: [
        {
          strong: 'Changes are in the audit log too.',
          text: 'system.access.audit records changes to and invocations of an MCP. Admins can also disable an OAuth client from account settings to cut off one assistant.',
        },
      ],
    },
    {
      id: 'data-leaving',
      heading: 'What leaves Databricks',
      prose:
        'Genie never copies tables. The MCP response carries the answer text, the generated SQL, and result rows up to the documented size limits, and the assistant receives all of it. After that the vendor’s terms apply. Databricks docs do not say what each assistant keeps, so read each vendor’s policy for your plan.',
      points: [
        {
          strong: 'Treat the result as data in the vendor tool.',
          text: 'Check retention, training use, and admin controls for the plan you license. Start from the policy pages linked in each assistant section: OpenAI, Google, Microsoft, and Anthropic.',
        },
        {
          strong: 'Limit rows and columns at the source.',
          text: 'Hide columns in the Genie Agent and mask sensitive ones in Unity Catalog. Masks apply before the answer leaves.',
        },
        {
          strong: 'Teams keeps content in region.',
          text: 'The Teams doc says questions and history are processed in the workspace region and the central service does not persist or log content.',
        },
        {
          strong: 'Allow the vendor networks.',
          text: 'If IP access lists are on, allow the provider outbound ranges for hosted assistants, or the sign-in and calls fail.',
        },
      ],
    },
    {
      id: 'run-it',
      heading: 'Run it',
      prose:
        'The reference bundle in reference/genie deploys a serverless job with two tasks. The first reuses the Genie Agent from the Genie Agents guide or creates one over the same sample tables. The second connects to the managed MCP endpoint with the Databricks MCP Python client, lists the tools, asks a sample question, and prints the answer and the SQL. That is the call an outside assistant makes. Example connector files for ChatGPT, Gemini, Copilot Studio, and Teams are in the guide folder.',
      points: [
        {
          strong: 'Setup before the run.',
          text: 'Enable Managed MCP Servers if you use the Genie Agent endpoint, make sure the run-as user has CAN RUN on the agent and SELECT on its tables, and ask an account admin for an OAuth app connection if you test an assistant. The Teams app needs a Microsoft 365 admin.',
        },
        {
          strong: 'Safe to rerun.',
          text: 'The agent is found by title and updated in place, and each step replaces its own rows in genie_external_ai_results. Nothing is created at account level.',
        },
      ],
    },
    {
      id: 'status',
      heading: 'Release stages',
      table: {
        caption: 'Stage and date, from the release notes',
        columns: ['Capability', 'Stage'],
        rows: [
          [
            'Genie One MCP server',
            'Generally available, September 25, 2026. The Beta endpoint /api/2.0/mcp/genie sunsets October 31, 2026.',
          ],
          ['Managed MCP servers', 'Public Preview, January 27, 2026.'],
          ['Genie Agents in Copilot Studio', 'Public Preview, November 14, 2025.'],
          ['Genie in Microsoft Copilot Cowork', 'Beta, June 16, 2026.'],
          [
            'Genie app in Microsoft Teams',
            'Beta June 10, 2026. Public Preview July 17, 2026. Workspace URL sign-in, August 2026.',
          ],
          ['Unity Gateway managed MCP connectors', 'Beta, August 2026.'],
        ],
      },
    },
  ],
  related: [
    { slug: 'genie-agents', title: 'Genie Agents: setup, instructions, and data handling' },
    { slug: 'agent-framework-support', title: 'Agents, MCP, and model gateway' },
    { slug: 'external-integrations', title: 'Partner tool integrations' },
    { slug: 'access-management', title: 'Access management' },
    { slug: 'databricks-apps', title: 'Databricks Apps, App Spaces and Serverless Micro Apps' },
  ],
};
