import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'databricks-apps',
  area: 'General Guides',
  title: 'Databricks Apps, App Spaces and Serverless Micro Apps',
  intro:
    'Databricks Apps runs your own web app next to your data, under Unity Catalog. Start with a standard Databricks App when you write the code yourself, and use Genie App Builder inside an App Space when a prompt should produce the app. Serverless Micro Apps were announced on June 16, 2026 and have no public docs yet. This page covers how to pick between them, app.yaml and resources, deployment, compute size and scaling, app and user authorization, App Spaces, Genie App Builder, and limits and logs. Database work is in the Lakebase apps guide.',
  businessValue: {
    summary:
      'Teams get internal data and AI apps without a separate hosting stack, and security reviews the identity and access model once.',
    outcomes: [
      {
        title: 'Apps beside the data',
        body: 'Apps run on the Databricks serverless platform, sign users in with OAuth, and reach warehouses, models, and tables under Unity Catalog. There is no separate server, network path, or login to secure.',
      },
      {
        title: 'Access that follows the user',
        body: 'With user authorization, row filters and column masks apply to the person using the app. An app that serves everyone the same data can use its own service principal with least privilege.',
      },
      {
        title: 'Governance set once',
        body: 'An App Space fixes the scopes, spend policy, and permissions for every app inside it. Admins review the space instead of each app, and builders move faster inside it.',
      },
      {
        title: 'Cost that matches use',
        body: 'A standard app bills per hour of provisioned capacity while it runs. Genie App Builder apps scale to zero when idle, and are free during Beta. Pick the model that fits how often people use the app.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Default to a standard Databricks App.',
      body: 'It is generally available, takes Streamlit, Dash, Gradio, React, Angular, Svelte, or Express, and gives you a compute size and horizontal scaling. Use Genie App Builder for prompt-built internal tools and wait for Micro Apps.',
    },
    {
      title: 'Declare resources, then reference them with valueFrom.',
      body: 'Add a SQL warehouse, secret, endpoint, or Lakebase database as an app resource with a key and a permission. app.yaml reads it with valueFrom, so no ID or secret sits in code.',
    },
    {
      title: 'Deploy from a bundle or Git for anything shared.',
      body: 'The UI suits a first try. A Declarative Automation Bundle or a Git source gives a reviewable, repeatable release. The CLI and API cover scripting.',
    },
    {
      title: 'Start at Medium, 0.5 DBU per hour.',
      body: 'Large is 1 DBU per hour and XLarge is 3. Horizontal scaling runs 1 to 5 instances and is generally available as of September 29, 2026.',
    },
    {
      title: 'Use user authorization when data access depends on the person.',
      body: 'The app receives a scoped user token and Unity Catalog enforces that user’s permissions. Use the app service principal for shared and background work. Many apps use both.',
    },
    {
      title: 'Set up an App Space (Beta) when several people build apps.',
      body: 'It carries the scopes, a serverless usage policy, and permissions for every app in it. Genie App Builder only builds inside a space, and both are free during Beta.',
    },
  ],
  prerequisites: [
    {
      slug: 'access-management',
      title: 'Access management',
      why: 'App authorization and user authorization both rest on Unity Catalog grants, groups, and service principals.',
    },
    {
      slug: 'dab-starter',
      title: 'Running a Declarative Automation Bundle',
      why: 'The repeatable way to deploy an app is a bundle, so you need its layout, targets, and deploy commands.',
    },
  ],
  sections: [
    {
      id: 'what-it-is',
      heading: 'What Databricks Apps is',
      prose:
        'A Databricks App is a web app that Databricks hosts, runs, and secures for you. You build it in Python (Streamlit, Dash, Gradio) or Node.js (React, Angular, Svelte, Express), develop it locally, and deploy it to a workspace. Common uses are dashboards, RAG chat apps, data entry forms, and operational tools. Each app gets its own URL and runs as its own service principal. Users sign in with OAuth, and the app calls resources under Unity Catalog. An App Space groups apps under shared governance, and Genie App Builder can create apps inside one.',
      diagram: {
        type: 'flow',
        title: 'Who the app acts as on each edge',
        description:
          'Users sign in to an app, which is a Databricks App or a Genie App Builder app inside an App Space. The App Space passes its scopes and usage policy to the app. The app calls a SQL warehouse and a Genie Agent with the user token, and a serving endpoint, Lakebase database, and secrets with its service principal. Unity Catalog governs all the resources.',
        nodes: [
          {
            id: 'users',
            label: 'Users',
            sub: 'sign in with OAuth',
            col: 0,
            row: 2,
            kind: 'surface',
            icon: 'users',
            domain: 'apps',
            detail:
              'Workspace users open the app URL and sign in with OAuth. On first use, the app asks them to grant each scope it requests.',
          },
          {
            id: 'space',
            label: 'App Space (Beta)',
            sub: 'scopes, policy, access',
            col: 1,
            row: 0,
            icon: 'checklist',
            domain: 'governance',
            detail:
              'The governance boundary. Its user authorization scopes, serverless usage policy, and permissions apply to every app in the space.',
          },
          {
            id: 'app',
            label: 'Your app',
            sub: 'Apps or App Builder',
            col: 1,
            row: 2,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'apps',
            detail:
              'A Databricks App you write, or a Genie App Builder app inside an App Space. It runs as a service principal and can also act as the signed-in user.',
          },
          {
            id: 'wh',
            label: 'SQL warehouse',
            sub: 'CAN USE',
            col: 2,
            row: 0,
            icon: 'warehouse',
            domain: 'data',
            detail:
              'Runs the app’s SQL. With the sql scope the query runs as the user, so row filters and column masks apply to that person.',
          },
          {
            id: 'ep',
            label: 'Serving endpoint',
            sub: 'CAN QUERY',
            col: 2,
            row: 1,
            icon: 'gear-maroon',
            domain: 'ai',
            detail:
              'A model serving endpoint the app queries. A shared model call usually runs as the app service principal with query permission on the endpoint.',
          },
          {
            id: 'lb',
            label: 'Lakebase',
            sub: 'Postgres database',
            col: 2,
            row: 2,
            icon: 'cloud-database',
            domain: 'data',
            detail:
              'A Lakebase database added as an app resource. The app connects as its service principal, and the Lakebase apps guide covers the connection.',
          },
          {
            id: 'genie',
            label: 'Genie Agent',
            sub: 'CAN RUN',
            col: 2,
            row: 3,
            icon: 'data-search',
            domain: 'ai',
            detail:
              'A Genie Agent attached as a resource. With the genie scope the question runs as the user, so Unity Catalog checks that person’s access.',
          },
          {
            id: 'secrets',
            label: 'Secrets',
            sub: 'CAN READ',
            col: 2,
            row: 4,
            icon: 'id-provider',
            domain: 'governance',
            detail:
              'Secret scopes hold external API keys. The app reads them through valueFrom as its service principal, so no key sits in code.',
          },
          {
            id: 'uc',
            label: 'Unity Catalog',
            sub: 'governs every resource',
            col: 3,
            row: 2,
            kind: 'store',
            icon: 'database',
            domain: 'governance',
            detail:
              'Applies grants, row filters, and column masks to the identity on each call, which is the user or the app service principal.',
          },
        ],
        edges: [
          { from: 'users', to: 'app', label: 'OAuth sign-in' },
          { from: 'space', to: 'app', label: 'inherited settings', dashed: true },
          { from: 'app', to: 'wh', label: 'user token' },
          { from: 'app', to: 'ep', label: 'app identity' },
          { from: 'app', to: 'lb', label: 'app identity' },
          { from: 'app', to: 'genie', label: 'user token' },
          { from: 'app', to: 'secrets', label: 'app identity' },
          { from: 'wh', to: 'uc' },
          { from: 'ep', to: 'uc' },
          { from: 'lb', to: 'uc' },
          { from: 'genie', to: 'uc' },
          { from: 'secrets', to: 'uc' },
        ],
        legend: [
          { kind: 'surface', label: 'People' },
          { kind: 'highlight', label: 'The app' },
          { kind: 'dashed', label: 'Inherited governance' },
        ],
        caption:
          'The edge labels show the common choice for each resource. Authorization is set per request, so a resource that takes a scope can also be called with the app identity.',
      },
      links: [
        { label: 'Databricks Apps', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/' },
        { label: 'Key concepts', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/key-concepts' },
      ],
    },
    {
      id: 'choose-runtime',
      heading: 'Pick the app type',
      prose:
        'Three options exist, and they differ in release stage first. A standard Databricks App is generally available. Genie App Builder and App Spaces are in Beta as of the September 23, 2026 release note. Serverless Micro Apps were announced on June 16, 2026 with private previews coming soon, and the public sources say nothing more.',
      options: {
        caption: 'App type, by fit and tradeoff',
        rows: [
          {
            option: 'Standard Databricks App',
            when: 'You write the code, or need a specific framework, a larger compute size, horizontal scaling, or a production support commitment.',
            tradeoffs:
              'Most flexible, and generally available. You own the code and its upkeep. It bills per hour of provisioned capacity while running, so an idle app that stays running still costs. Governance is per app unless you place it in a space.',
          },
          {
            option: 'Genie App Builder app (Beta)',
            when: 'An internal tool where a plain-language description reaches a working app, and you want to prototype and review fast.',
            tradeoffs:
              'Quickest to a working app, and scale to zero keeps idle cost low. It builds only on AppKit, has a short cold start, runs one instance, has no public internet egress, and is limited to listed regions. Free during Beta, with later pricing unstated.',
          },
          {
            option: 'Serverless Micro App (announced)',
            when: 'Infrequently used departmental tools, once a preview is open to you. Confirm availability in the release notes first.',
            tradeoffs:
              'The announcement describes a micro VM per app, fast start, scale to zero, and usage-based billing. Frameworks, limits, price, and stage are not public, so you cannot size cost or plan a release around it.',
          },
        ],
        recommendation:
          'Default to a standard Databricks App for anything with real users, and use Genie App Builder for internal prototypes inside an App Space. Treat Micro Apps as a watch item until the release notes show a preview for your workspace.',
      },
      links: [
        {
          label: 'Enabling governed vibe coding for enterprise apps',
          url: 'https://www.databricks.com/blog/enabling-governed-vibe-coding-enterprise-apps-databricks',
          note: 'June 16, 2026 announcement.',
        },
        {
          label: 'September 2026 release notes',
          url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/september',
        },
      ],
    },
    {
      id: 'compare',
      heading: 'The three options side by side',
      diagram: {
        type: 'matrix',
        title: 'Databricks App, Genie App Builder app and Serverless Micro App',
        description:
          'A matrix of six traits across the three options. A standard app runs on a dedicated instance and bills while running. A Genie App Builder app scales between zero and one instance and is built on AppKit inside an App Space. A Serverless Micro App is announced with a micro VM runtime and usage-based billing, and little else is public.',
        corner: 'Trait',
        columns: ['Databricks App', 'Genie App Builder app', 'Serverless Micro App'],
        rows: [
          {
            label: 'Compute model',
            cells: [
              {
                state: 'own',
                text: 'Dedicated instance',
                sub: 'Medium, Large, XLarge',
                detail: '1 to 5 instances with horizontal scaling. Compute sizes are Medium, Large, and XLarge.',
              },
              {
                state: 'optional',
                text: 'On-demand serverless',
                sub: '0 to 1 instance',
                detail:
                  'An isolated, on-demand serverless runtime inside an App Space. Each app scales between zero and one instance.',
              },
              {
                state: 'optional',
                text: 'Micro VM per app',
                sub: 'announced',
                detail:
                  'The June 16, 2026 blog says each app runs in its own lightweight virtual machine on a micro VM-based runtime.',
              },
            ],
          },
          {
            label: 'Idle cost',
            cells: [
              {
                state: 'none',
                text: 'Billed while running',
                detail:
                  'Billed per hour of provisioned capacity while the app runs. Stop the app to stop the charge. A stopped app is not reachable.',
              },
              {
                state: 'own',
                text: 'Scales to zero',
                sub: 'after 30 min idle',
                detail:
                  'Default idle time is 30 minutes. The next request waits through a short cold start. No charge during Beta.',
              },
              {
                state: 'own',
                text: 'Scales to zero',
                sub: 'usage-based billing',
                detail:
                  'Described as usage-based, not reserved capacity. The rate and the idle behavior are not public.',
              },
            ],
          },
          {
            label: 'Framework choice',
            cells: [
              {
                state: 'own',
                text: 'Your choice',
                sub: 'Python or Node.js',
                detail: 'Streamlit, Dash, Gradio, React, Angular, Svelte, Express, or any command you set in app.yaml.',
              },
              {
                state: 'none',
                text: 'AppKit only',
                detail: 'Genie App Builder builds on Databricks AppKit, the Databricks framework for data and AI apps.',
              },
              { state: 'none', text: 'Not public', detail: 'No public page lists supported frameworks.' },
            ],
          },
          {
            label: 'Governance boundary',
            cells: [
              {
                state: 'optional',
                text: 'Per app or App Space',
                detail: 'Set scopes and permissions on each app, or place the app in an App Space.',
              },
              {
                state: 'own',
                text: 'App Space',
                detail:
                  'The space sets authorization scopes, the serverless usage policy, and permissions for every app it holds.',
              },
              {
                state: 'optional',
                text: 'Not public',
                detail:
                  'The blog places Micro Apps in Databricks Apps. Its governance model is not described in public docs.',
              },
            ],
          },
          {
            label: 'Release stage',
            cells: [
              {
                state: 'own',
                text: 'Generally available',
                sub: 'compute sizes: Jan 28, 2026',
                detail: 'Horizontal scaling reached general availability on September 29, 2026.',
              },
              {
                state: 'optional',
                text: 'Beta',
                sub: 'Sept 23, 2026',
                detail:
                  'Genie App Builder and App Spaces. A workspace admin must turn on Governed agentic app-building from the Previews page.',
              },
              {
                state: 'none',
                text: 'Announced',
                sub: 'June 16, 2026',
                detail:
                  'Private previews were described as coming soon. Check the release notes for the current stage.',
              },
            ],
          },
          {
            label: 'How you deploy',
            cells: [
              {
                state: 'own',
                text: 'UI, CLI, bundle, API, Git',
                detail:
                  'From a workspace folder or a Git repository. A Declarative Automation Bundle gives a repeatable release.',
              },
              {
                state: 'optional',
                text: 'Prompt, preview, deploy',
                detail: 'Describe the app in the Build tab, refine it in the live preview, then deploy it.',
              },
              { state: 'none', text: 'Not public', detail: 'No public deployment steps exist yet.' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Strong fit' },
          { state: 'optional', label: 'Partial or conditional' },
          { state: 'none', label: 'Limited or not public' },
        ],
        caption: 'Micro App cells reflect the announcement only. Check the release notes before you rely on them.',
      },
    },
    {
      id: 'app-yaml',
      heading: 'app.yaml and the start command',
      prose:
        'app.yaml is optional and sits in the project root. Without it, Databricks runs a Python app with python <my-app.py>, using the first .py file it finds, and a Node.js app with npm run start. Add app.yaml to set another start command or to pass environment variables. Databricks does not run the command in a shell, so variables defined outside the config are not available. The exception is DATABRICKS_APP_PORT, and the app must listen on 0.0.0.0 and that port.',
      steps: [
        {
          title: 'Set the command and the environment',
          body: 'An env entry takes either a fixed value or a valueFrom reference to a resource key. Put non-secret settings in value and everything else behind valueFrom.',
          code: `command: ['streamlit', 'run', 'app.py']
env:
  - name: 'STREAMLIT_GATHER_USAGE_STATS'
    value: 'false'
  - name: 'DATABRICKS_WAREHOUSE_ID'
    valueFrom: 'sql-warehouse'
  - name: 'EXTERNAL_API_KEY'
    valueFrom: 'api-key'`,
        },
        {
          title: 'List dependencies in the project',
          body: 'Python apps use requirements.txt, or pyproject.toml with uv.lock. Node.js apps use package.json. Pin versions so a redeploy builds the same app.',
        },
        {
          title: 'Write logs to stdout and stderr',
          body: 'The Logs tab shows only what the app prints, and Databricks does not keep logs when the app compute shuts down.',
        },
      ],
      links: [
        {
          label: 'Configure app execution with app.yaml',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-runtime',
        },
        {
          label: 'Best practices',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/best-practices',
        },
      ],
    },
    {
      id: 'resources',
      heading: 'Resources and valueFrom',
      prose:
        'A resource gives the app access to a workspace object without a hard-coded ID or secret. The docs list 14 types: Databricks app, Genie Agent, Lakebase database, Lakeflow job, MLflow experiment, model serving endpoint, Unity Gateway model service, secret, SQL warehouse, Unity Catalog connection, table, function, volume, and AI Search index. Each has a default key and permission levels, such as Can use or Can manage on a warehouse and Can read on a secret. The object must already exist, and you need Can manage on both the object and the app to add it.',
      points: [
        {
          strong: 'The resource key is the contract.',
          text: 'You name a key when you add the resource, and app.yaml points at that key with valueFrom. Rename the underlying warehouse and nothing in the code changes.',
        },
        {
          strong: 'The grant goes to the app service principal.',
          text: 'Adding a resource gives the app’s own identity the permission you choose. Pick the lowest level that works, and never share a service principal between apps.',
        },
        {
          strong: 'Secrets belong behind valueFrom.',
          text: 'Do not put keys in env values or in the repository. Databricks injects DATABRICKS_CLIENT_ID and DATABRICKS_CLIENT_SECRET for the app identity itself.',
        },
        {
          strong: 'Keep development and production apart.',
          text: 'Databricks recommends separate workspaces. In a bundle, declare the resources in YAML so each target binds its own warehouse and endpoint.',
        },
        {
          strong: 'Send database work to Lakebase.',
          text: 'Add a Lakebase database as a resource for transactional state. The Lakebase apps guide covers token refresh, synced tables, and branches.',
        },
      ],
      links: [
        {
          label: 'Add resources to a Databricks app',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources',
        },
      ],
    },
    {
      id: 'deploy',
      heading: 'Deploy an app',
      prose:
        'The source can be a workspace folder or a Git repository (GitHub, GitLab, Bitbucket, Azure DevOps, or AWS CodeCommit). The interface can be the UI, the Databricks CLI, Declarative Automation Bundles, or the API. A workspace admin can require Git-only deployments under Settings, Development, Apps. A Git deployment can start from a subdirectory, and the app then cannot read files outside it.',
      options: {
        caption: 'Deployment path, by fit and tradeoff',
        rows: [
          {
            option: 'UI from a workspace folder',
            when: 'A first deploy or a throwaway prototype.',
            tradeoffs:
              'Fastest to try. Nothing records which code or settings produced a release, and each edit is a manual step.',
          },
          {
            option: 'Git source with the CLI',
            when: 'The code already lives in a repository and a branch, tag, or commit should define the release.',
            tradeoffs:
              'The release maps to one commit. The app service principal needs a Git credential for a private repository, and the settings still live outside the repository unless a bundle holds them.',
          },
          {
            option: 'Declarative Automation Bundle',
            when: 'Several environments, CI/CD, or an app that ships with its warehouse, job, or database.',
            tradeoffs:
              'Code, resources, scopes, and compute size sit in one reviewed file, and each target changes only its variables. It adds a bundle to maintain.',
          },
        ],
        recommendation:
          'Use a bundle for anything others depend on, with the source in Git. Use the UI only to try an idea. The API suits custom tooling.',
      },
      steps: [
        {
          title: 'Define the app in a bundle',
          body: 'resources.apps holds the source path, user authorization scopes, and resources. The key under resources becomes the key that app.yaml reads with valueFrom.',
          code: `resources:
  apps:
    sales_app:
      name: sales-app
      source_code_path: ./app
      user_api_scopes:
        - sql
      resources:
        - name: sql-warehouse
          sql_warehouse:
            id: \${var.warehouse_id}
            permission: CAN_USE`,
        },
        {
          title: 'Validate, deploy, and run it',
          body: 'A bundle deploy uploads the files and creates the app. bundle run starts or redeploys it.',
          code: `databricks bundle validate -t dev
databricks bundle deploy -t dev
databricks bundle run sales_app -t dev`,
        },
        {
          title: 'Or deploy from Git without a bundle',
          body: 'Create the app with a repository, then deploy a branch, tag, or commit. Add --git-source-code-path to deploy a subdirectory.',
          code: `databricks apps create my-app --git-url https://github.com/org/repo --git-provider gitHub
databricks apps deploy my-app --git-branch main
databricks apps deploy my-app --git-tag v1.0.0`,
        },
      ],
      links: [
        {
          label: 'Deploy a Databricks app',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy',
        },
        {
          label: 'Bundle resources',
          url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/resources',
          note: 'The apps resource and its fields.',
        },
      ],
    },
    {
      id: 'compute',
      heading: 'Compute size and horizontal scaling',
      prose:
        'Compute sizing reached general availability in the January 28, 2026 release note, and the docs now list three sizes. Medium is the default. A size change takes effect when the update finishes, and the app keeps running on the old size until then. An app bills while it is Running. Deploying and Crashed states do not bill, and a Stopped app costs nothing.',
      table: {
        caption: 'Instance sizes and DBU rates',
        columns: ['Size', 'Capacity and rate'],
        rows: [
          ['Medium (default)', 'Up to 2 vCPU, 6 GB. 0.5 DBU per hour. Dashboards, simple visualizations, and forms.'],
          ['Large', 'Up to 4 vCPU, 12 GB. 1 DBU per hour. Large datasets or high concurrency.'],
          ['XLarge', 'Up to 12 vCPU, 48 GB. 3 DBU per hour. Memory-heavy or highly concurrent apps.'],
        ],
      },
      options: {
        caption: 'One instance or several',
        rows: [
          {
            option: 'Single instance',
            when: 'An internal tool with modest traffic where a short outage during a deploy is acceptable.',
            tradeoffs:
              'Lowest cost. One failure or deploy interrupts the app, and one process handles all concurrency.',
          },
          {
            option: 'Horizontal scaling, 2 to 5 instances',
            when: 'Many concurrent users or an app that needs to stay up during releases.',
            tradeoffs:
              'Zero-downtime deployments and best-effort session affinity. Cost grows in step with the instance count, the Logs tab shows one instance at a time, and persistent state needs an external store.',
          },
        ],
        recommendation:
          'Start at Medium with one instance. Move to Large only after you see a limit, and use at least two instances when the app has to stay available. The range is 1 to 5, with at most 20 scaled apps per workspace.',
      },
      points: [
        {
          strong: 'Horizontal scaling is generally available.',
          text: 'The September 29, 2026 release note moved it from the May 2026 Beta to general availability. One app URL fronts all instances.',
        },
        {
          strong: 'Session affinity is best effort.',
          text: 'Browser apps get it from the __Host-databricks-app-router cookie. API clients send an X-Routing-Key header with a stable value.',
        },
        {
          strong: 'Declare every dependency.',
          text: 'A horizontally scaled app has no pre-installed libraries, so list them in requirements.txt or pyproject.toml.',
        },
      ],
      links: [
        {
          label: 'Configure compute resources for an app',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/compute-size',
        },
        {
          label: 'Horizontal scaling for Databricks apps',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/horizontal-scaling',
        },
      ],
    },
    {
      id: 'authorization',
      heading: 'App and user authorization',
      prose:
        'Every app has a service principal, and app authorization uses it. User authorization (on-behalf-of-user) sends the signed-in person’s token to the app in the x-forwarded-access-token header, so Unity Catalog applies that person’s grants, row filters, and column masks. Both use OAuth 2.0, and an app can use them together, for example to log with its own identity and query as the user.',
      options: {
        caption: 'Authorization model, by fit and tradeoff',
        rows: [
          {
            option: 'App authorization (service principal)',
            when: 'Background tasks, shared reference data, logging, calls to external services, or any action that is the same for every user.',
            tradeoffs:
              'One set of grants to review and audit, and it works with no user present. Every user sees what the principal can see, so per-person row filters and masks do not apply.',
          },
          {
            option: 'User authorization (on behalf of user)',
            when: 'Data queries, compute, and Genie questions that must follow each person’s Unity Catalog permissions.',
            tradeoffs:
              'Row filters and masks hold per user and the audit trail names the person. You declare scopes, users consent on first use, and the token works only inside the workspace. Reaching another workspace needs the app deployed there or M2M OAuth.',
          },
        ],
        recommendation:
          'Use user authorization for anything tied to a person’s data access, and the app service principal with least privilege for shared work. Request the fewest scopes the app needs.',
      },
      steps: [
        {
          title: 'Declare the scopes',
          body: 'Add scopes under User authorization in the app configuration, or set user_api_scopes in a bundle or with the CLI. The documented API scopes are ai-functions, ai-gateway, apps, files, genie, model-serving, postgres, sql, vector-search, and sql:restricted-query for read-only queries. SDK scopes such as catalog.tables and workspace.workspace take a :read form for GET-only access. With no scopes selected, an app gets iam.access-control:read and iam.current-user:read.',
        },
        {
          title: 'Read the user token per request',
          body: 'Take the token from the request header and build a client with it. Do not cache it across users.',
          code: `from flask import request

user_token = request.headers.get('x-forwarded-access-token')`,
        },
        {
          title: 'Restrict what developers can add',
          body: 'A workspace admin can set an allowlist of scopes under Settings, Development, Apps. The default allows every supported scope.',
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
      id: 'governance',
      heading: 'Govern per app or in an App Space',
      prose:
        'An App Space (Beta) is a governance boundary. Admins define who can create and use apps, what permissions the apps have, and which spend policy applies. Every app in the space inherits those settings, so developers cannot tune them app by app. The space name cannot be changed after you create it.',
      options: {
        caption: 'Where governance lives',
        rows: [
          {
            option: 'Per app',
            when: 'A single app with its own resources, owner, and review, or an app that needs a boundary no existing space has.',
            tradeoffs:
              'Full control and no Beta dependency. Each app needs its own review, scope list, and cost tracking, which becomes slow once many people build apps.',
          },
          {
            option: 'App Space (Beta)',
            when: 'Several builders share the same data access, scopes, and cost policy, or you use Genie App Builder.',
            tradeoffs:
              'Review once and pre-approve the environment, with one usage policy for spend. Builders give up per-app tuning, an app that needs a different boundary moves to another space, and the feature is in Beta.',
          },
        ],
        recommendation:
          'Use a space for team and project work and for anything Genie App Builder creates. Keep a single production app per-app only when it needs settings a shared space would not allow.',
      },
      points: [
        {
          strong: 'User authorization scopes.',
          text: 'A new space starts with the Data + AI preset of 11 scopes: sql:restricted-query, genie, catalog.catalogs:read, catalog.schemas:read, catalog.tables:read, files, model-serving, ai-functions, ai-gateway, mcp.external, and mcp.functions. Admins can narrow them. Role-based access control lets users pick any role at sign-in or only the selected role.',
        },
        {
          strong: 'Serverless usage policy.',
          text: 'Apps in a space run under a serverless usage policy, so cost attribution and budgets are set once. See the cost and chargeback guide for how policies tag spend.',
        },
        {
          strong: 'Permissions.',
          text: 'CAN CREATE APP lets a user build apps in the space. CAN MANAGE changes the space settings. CAN READ views the space without creating apps.',
        },
        {
          strong: 'Patterns the docs name.',
          text: 'Public apps for the whole workspace, team apps for one group, and project apps for one initiative. Choose one space per pattern.',
        },
      ],
      steps: [
        {
          title: 'Enable the preview',
          body: 'A workspace admin opens the Previews page in workspace settings and turns on Governed agentic app-building. This covers both App Spaces and Genie App Builder.',
        },
        {
          title: 'Create and configure the space',
          body: 'Set the authorization scopes, the serverless usage policy, and the permissions. Grant CAN CREATE APP to the people who will build.',
        },
        {
          title: 'Build or move apps in',
          body: 'Builders open the Build tab on the Apps home page, pick the space, and start. Genie App Builder only builds inside a space.',
        },
      ],
      links: [
        { label: 'App Spaces', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-spaces' },
        {
          label: 'Manage previews',
          url: 'https://docs.databricks.com/aws/en/admin/workspace-settings/manage-previews',
        },
      ],
    },
    {
      id: 'genie-app-builder',
      heading: 'Genie App Builder (Beta)',
      prose:
        'Genie App Builder generates a Databricks app from a plain-language prompt, shows a working preview, and lets you refine it with follow-up prompts before you deploy. The June 16, 2026 blog adds that you can supply a screenshot for context, that it presents a plan to review, and that the preview updates in a side pane as it builds. The September 23, 2026 release note and docs describe the Beta.',
      points: [
        {
          strong: 'Build flow.',
          text: 'Open the Build tab on the Apps home page, pick an App Space, optionally name the app, and enter a prompt. Sign in to view the preview, iterate, and deploy. Databricks recommends short prompts and many iterations over one large prompt. Be specific about pages, inputs, charts, filters, default values, and where the app writes data.',
        },
        {
          strong: 'Runtime.',
          text: 'Apps use Databricks AppKit and run on an isolated, on-demand serverless runtime. Each app scales between zero and one instance and scales down after a default 30 minutes of idle time. The first request after that waits through a cold start.',
        },
        {
          strong: 'State.',
          text: 'Memory and local disk are lost on scale-down. Keep state in a Lakebase table, a Unity Catalog volume, or another external store. For an always-on app or horizontal scaling, use a standard Databricks App.',
        },
        {
          strong: 'Requirements.',
          text: 'You need CAN CREATE APP on the space and a workspace admin who enabled the preview. Partner-powered AI features must be on at the account and workspace level. Beta regions are ten AWS regions and eighteen Azure regions, and GCP, GovCloud, and Azure China are not supported.',
        },
        {
          strong: 'Network and packages.',
          text: 'Apps have no general public internet egress. Outbound access reaches the workspace and the managed npm and PyPI proxies. Custom package repositories are not supported.',
        },
        {
          strong: 'Cost.',
          text: 'There is no charge for Genie App Builder, App Spaces, or the apps built with it during Beta. Pricing for Beta features can change, and no post-Beta price is public.',
        },
      ],
      links: [
        {
          label: 'Genie App Builder',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/genie-app-builder',
        },
        {
          label: 'Build governed data and AI apps without code (Beta)',
          url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/september',
          note: 'September 23, 2026.',
        },
      ],
    },
    {
      id: 'micro-apps',
      heading: 'Serverless Micro Apps',
      prose:
        'Databricks announced Serverless Micro Apps on June 16, 2026 at Data + AI Summit. Each app runs in its own lightweight virtual machine on a micro VM-based runtime, which allows fast startup and scale to zero. Billing is usage-based instead of reserved capacity. The blog says private previews are coming soon.',
      points: [
        {
          strong: 'What is not public.',
          text: 'There is no docs page or release note with the supported frameworks, limits, rates, regions, or release stage. Do not assume Genie App Builder’s limits or pricing apply to them.',
        },
        {
          strong: 'How to track it.',
          text: 'Watch the Databricks release notes for a preview or availability entry, and ask your account team for access to a private preview.',
        },
        {
          strong: 'What to do now.',
          text: 'Build on a standard Databricks App or Genie App Builder. Keep resources, authorization, and the bundle clean so a later move is a runtime change and not a rewrite.',
        },
      ],
      links: [
        {
          label: 'Enabling governed vibe coding for enterprise apps',
          url: 'https://www.databricks.com/blog/enabling-governed-vibe-coding-enterprise-apps-databricks',
        },
        { label: 'Databricks release notes', url: 'https://docs.databricks.com/aws/en/release-notes/' },
      ],
    },
    {
      id: 'limits-logs',
      heading: 'Limits, logs and telemetry',
      points: [
        {
          strong: 'Limits.',
          text: 'A workspace holds at most 100 Databricks apps, and the limits page says this is fixed. Horizontal scaling allows 1 to 5 instances per app and 20 scaled apps per workspace. An app must exit within 15 seconds of SIGTERM or it receives SIGKILL.',
        },
        {
          strong: 'Logs.',
          text: 'The Logs tab, or the app URL with /logz appended, shows App, System, Build, and HTTP sources. The app must write to stdout and stderr, and logs are not kept when the compute shuts down.',
        },
        {
          strong: 'App telemetry (Beta).',
          text: 'Collects traces, logs, and metrics into Unity Catalog tables. Turn it on for a horizontally scaled app, because the Logs tab shows one instance at a time.',
        },
        {
          strong: 'Audit and cost.',
          text: 'system.access.audit records app permission changes and user authorization events. system.billing.usage tracks app DBUs. The Insights tab (Beta) shows viewers and health.',
        },
        {
          strong: 'State.',
          text: 'Memory is lost on restart. Persist state in Databricks SQL tables, workspace files, a Unity Catalog volume, or a Lakebase database.',
        },
      ],
      links: [
        { label: 'Resource limits', url: 'https://docs.databricks.com/aws/en/resources/limits' },
        {
          label: 'Monitor a Databricks app',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/monitor',
        },
      ],
    },
    {
      id: 'run-it',
      heading: 'Run it',
      prose:
        'The reference bundle deploys one small FastAPI app and a job of five notebooks. The notebooks read the app through the SDK, check its health, flag idle running apps across the workspace, list App Spaces (Beta) read-only, and stop the app when you ask. The app bills about 0.5 DBU per hour while it runs.',
      steps: [
        {
          title: 'Deploy the bundle and start the app.',
          body: 'Deploy creates the app. Running it deploys the source and starts the compute, which is when billing begins.',
          code: `databricks bundle deploy --target dev --var catalog=<catalog> --var warehouse_id=<id> --var app_service_principal=<app-id>
databricks bundle run databricks_apps_demo --target dev --var ...`,
        },
        {
          title: 'Run the job.',
          body: 'It reads the app, calls /whoami/app and /whoami/user to show the two identities, audits every app for cost, and looks at App Spaces without creating one.',
          code: `databricks bundle run capability_guides_databricks_apps --target dev --var ...`,
        },
        {
          title: 'Stop the app when you are done.',
          body: 'Run the job again with stop_app set to true. Stopping a stopped app does nothing. Delete the app with databricks apps delete when you no longer need it.',
          code: `databricks bundle run capability_guides_databricks_apps --params stop_app=true --target dev --var ...`,
        },
      ],
    },
  ],
  related: [
    { slug: 'lakebase-apps', title: 'App development with Lakebase' },
    { slug: 'external-integrations', title: 'Partner tool integrations' },
    { slug: 'agent-build-deployment', title: 'Building and shipping agents' },
    { slug: 'genie-agents', title: 'Genie Agents: setup, instructions, and data handling' },
    { slug: 'cost-chargeback', title: 'Cost tracking and chargeback' },
  ],
};
