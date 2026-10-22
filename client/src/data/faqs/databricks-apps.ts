import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'What is Databricks Apps and which frameworks does it support?',
    answer:
      'Databricks Apps lets you build and run secure data and AI web applications on the Databricks platform without managing separate infrastructure. The docs list Streamlit, Dash and Gradio for Python, and React, Angular, Svelte and Express for Node.js. Apps integrate with Unity Catalog, Databricks SQL and OAuth, and the product is generally available.',
    links: [
      { label: 'Databricks Apps overview', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/' },
      { label: 'Key concepts', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/key-concepts' },
    ],
  },
  {
    question: 'How do I deploy a Databricks app, and what does app.yaml do?',
    answer:
      'You can deploy from the workspace UI, the Databricks CLI, Declarative Automation Bundles or the API, using either workspace folders or a Git repository as the source. The optional app.yaml file in the project root sets the start command and extra environment variables. Without it, Databricks runs Python apps with python <my-app.py> and Node.js apps with npm run start. Environment variables take either a fixed value or a valueFrom reference to a resource such as a secret.',
    links: [
      { label: 'Deploy a Databricks app', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy' },
      {
        label: 'Configure app execution with app.yaml',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-runtime',
      },
    ],
  },
  {
    question: 'Which resources can a Databricks app use?',
    answer:
      'The resources page lists 14 types, including SQL warehouses, model serving endpoints, Lakebase databases, secrets, Lakeflow jobs, Genie Agents, MLflow experiments, Unity Catalog tables, volumes, functions and connections. You add each one in the Apps UI with a permission level and a key, then reference the key from app.yaml with valueFrom. The resource must already exist, and you need Can manage on both the resource and the app.',
    links: [
      {
        label: 'Add resources to a Databricks app',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources',
      },
    ],
  },
  {
    question: 'What limits apply to Databricks Apps?',
    answer:
      'A workspace can hold at most 100 Databricks apps, and the limits page says this cannot be increased. A horizontally scaled app runs 1 to 5 instances, and a workspace supports at most 20 horizontally scaled apps. An app must shut down within 15 seconds of receiving SIGTERM, or it is stopped with SIGKILL.',
    links: [
      { label: 'Resource limits', url: 'https://docs.databricks.com/aws/en/resources/limits' },
      {
        label: 'Horizontal scaling',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/horizontal-scaling',
      },
      { label: 'Best practices', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/best-practices' },
    ],
  },
  {
    question: 'What are Serverless Micro Apps, and are they available?',
    answer:
      'Serverless Micro Apps run each app in its own lightweight virtual machine on a new micro VM-based runtime. The apps start fast and scale down when idle. The June 16, 2026 Databricks blog announced them with private previews coming soon, and no public docs page or release note describes general availability. Check the release notes for the current stage before you commit a project to them.',
    links: [
      {
        label: 'Enabling governed vibe coding for enterprise apps',
        url: 'https://www.databricks.com/blog/enabling-governed-vibe-coding-enterprise-apps-databricks',
      },
    ],
  },
  {
    question: 'How do I get access to Genie App Builder and App Spaces?',
    answer:
      'Both are in Beta. A workspace admin must turn on "Governed agentic app-building" from the Previews page. Users then need the CAN CREATE APP permission on an App Space and open the Build tab on the Apps home page. The docs list region limits during Beta (specific AWS and Azure regions, with GCP and GovCloud excluded) and require partner-powered AI features at the account and workspace level.',
    links: [
      {
        label: 'Genie App Builder',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/genie-app-builder',
      },
      { label: 'App Spaces', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-spaces' },
      {
        label: 'September 2026 release notes',
        url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/september',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'When should I pick a Serverless Micro App over a standard Databricks App?',
    answer:
      "Pick a Micro App for departmental tools and line-of-business workflows that people use now and then, since the blog describes usage-based billing and scale-down when idle. Stay with a standard Databricks App when you need today's supported behaviour, such as a chosen compute size, horizontal scaling or a custom Python or Node.js framework. Micro Apps were announced with private previews coming soon, so confirm availability in the release notes before you plan around them.",
    links: [
      {
        label: 'Enabling governed vibe coding for enterprise apps',
        url: 'https://www.databricks.com/blog/enabling-governed-vibe-coding-enterprise-apps-databricks',
      },
      { label: 'Databricks Apps overview', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/' },
    ],
  },
  {
    kind: 'decision',
    question: 'When should I use Genie App Builder instead of writing the app myself?',
    answer:
      'Use Genie App Builder for internal tools where a plain-language description gets you to a working app, and write the code yourself when you need a framework, layout or behaviour the generator cannot produce. The builder works inside an App Space on the AppKit framework and shows a live preview as it builds. It is in Beta, so treat it as a fast way to prototype and review internal apps rather than as the only path for critical workloads.',
    links: [
      {
        label: 'Genie App Builder',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/genie-app-builder',
      },
      {
        label: 'Enabling governed vibe coding for enterprise apps',
        url: 'https://www.databricks.com/blog/enabling-governed-vibe-coding-enterprise-apps-databricks',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'When should I set up an App Space?',
    answer:
      'Set one up when several developers will build apps that share the same data access, authorization scopes and cost policy. An admin configures user authorization, a serverless usage policy and permissions once, and every app in the space inherits them. The docs name three patterns: workspace-wide public apps, team-specific apps and project-based apps. A single one-off app that has its own resources does not need a space.',
    links: [{ label: 'App Spaces', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-spaces' }],
  },
  {
    kind: 'decision',
    question: 'Should my app use app authorization or user authorization?',
    answer:
      "Use app authorization (the app service principal) for shared work that does not depend on who is signed in, such as background tasks, logging metrics or calling external services. Use user authorization, also called on-behalf-of-user, when the app must respect each person's Unity Catalog permissions, such as row-level filters. Many apps combine both. User authorization needs declared scopes, and its tokens only work inside the workspace, so cross-workspace access needs the app deployed in the target workspace or M2M OAuth.",
    links: [
      {
        label: 'Databricks Apps authorization',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'Should I build a Databricks app, a dashboard or a Genie Agent for my use case?',
    answer:
      'Build an app when you need custom interface logic or behaviour that a prebuilt analytics surface does not offer, and choose a dashboard or a Genie Agent when the need is reporting or natural-language questions over governed data. The two combine well, because a Genie Agent is one of the resources an app can use. The public docs do not give a formal selection guide, so decide based on how much custom logic the users need.',
    links: [
      {
        label: 'Add resources to a Databricks app',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources',
      },
      { label: 'Databricks Apps overview', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/' },
    ],
  },
  {
    kind: 'decision',
    question: 'Which compute size should I choose for a Databricks app?',
    answer:
      'Start with Medium, the default, and move up only if you see performance problems or know the app needs more. The docs say Medium suits typical dashboards and visualizations. Test a larger size in development first, because each step raises the hourly DBU rate.',
    links: [
      {
        label: 'Configure compute resources for an app',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/compute-size',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What do I give up with scale-to-zero compared with an always-on app?',
    answer:
      'You trade cold starts for lower idle cost. Genie App Builder apps scale between zero and one instance and scale down after a default 30 minutes of idle time, so the next visitor waits through a cold start. State survives only in external storage such as Lakehouse tables or Unity Catalog volumes. A standard Databricks App stays warm while running, but the docs say it bills per hour of provisioned capacity until you stop it.',
    links: [
      {
        label: 'Genie App Builder',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/genie-app-builder',
      },
      { label: 'Key concepts', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/key-concepts' },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What does a bigger compute size cost?',
    answer:
      'Each step up in size multiplies the hourly rate. The compute size page lists Medium (up to 2 vCPU, 6 GB) at 0.5 DBU per hour, Large (up to 4 vCPU, 12 GB) at 1 DBU per hour and XLarge (up to 12 vCPU, 48 GB) at 3 DBU per hour. The January 28, 2026 release note announced general availability with Medium and Large, and the current docs page also lists XLarge. After a size change, the app keeps running on the old size until the update finishes.',
    links: [
      {
        label: 'Configure compute resources for an app',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/compute-size',
      },
      {
        label: 'January 2026 release notes',
        url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/january',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'How much flexibility do I lose with a generated AppKit app compared with custom code?',
    answer:
      'A generated app gains speed and built-in behaviour, and loses framework choice. Genie App Builder produces apps on AppKit, which the blog says includes caching, telemetry and retry logic, and it uses awareness of your workspace tables and semantic layer. A custom Databricks App can use Streamlit, Dash, Gradio, React, Angular, Svelte or Express and a start command of your choice. Take the generated route for standard internal tools and the custom route when you need control over the stack.',
    links: [
      {
        label: 'Enabling governed vibe coding for enterprise apps',
        url: 'https://www.databricks.com/blog/enabling-governed-vibe-coding-enterprise-apps-databricks',
      },
      { label: 'Databricks Apps overview', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/' },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What changes when governance is set per App Space instead of per app?',
    answer:
      'Every app in the space gets the same settings, so you give up per-app control and save review work. Settings in the space (authorization scopes, serverless usage policy and permissions) apply to every app in it, so developers cannot tune them individually. The blog frames this as moving from reactive per-app review to pre-approved environments. A new space starts with a Data + AI preset of 11 scopes, which admins can narrow. Apps that need a different boundary belong in a different space.',
    links: [
      { label: 'App Spaces', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-spaces' },
      {
        label: 'Enabling governed vibe coding for enterprise apps',
        url: 'https://www.databricks.com/blog/enabling-governed-vibe-coding-enterprise-apps-databricks',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What is the risk of building on Beta features like Genie App Builder and App Spaces?',
    answer:
      'Beta features can change, and the docs limit them today by region and by an admin opt-in. Genie App Builder and App Spaces are Beta (release notes dated September 23, 2026), and during Beta there is no charge for the builder, spaces or deployed apps. Pricing after Beta is not stated publicly, so avoid committing production cost models to the free period. Standard Databricks Apps are in production, and Serverless Micro Apps have no stated public stage beyond the June 2026 announcement.',
    links: [
      {
        label: 'Genie App Builder',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/genie-app-builder',
      },
      {
        label: 'September 2026 release notes',
        url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/september',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What does horizontal scaling cost compared with a single-instance app?',
    answer:
      'Horizontal scaling gives you availability and concurrency, and compute cost rises in proportion to instance count. You run an app on 1 to 5 instances behind one URL, and Databricks recommends at least 2 for availability. You also get best-effort session affinity and zero-downtime deployments. The Logs tab shows one instance at a time, so use app telemetry to see all of them.',
    links: [
      {
        label: 'Horizontal scaling for Databricks apps',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/horizontal-scaling',
      },
    ],
  },
];
