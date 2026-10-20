import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'environment-workspaces-catalogs',
  area: 'CI/CD & Version Control Guides',
  title: 'Workspaces and catalogs across dev, test, stage, and prod',
  intro:
    'Four environments need three kinds of boundary: where code runs (workspaces), where data lives (catalogs and storage), and who can change what (identities). This page compares the common workspace topologies, then puts the three catalog layouts side by side: a catalog per environment, a catalog per environment and domain, and one catalog with environment schemas. It shows the bindings, storage, identities, and commands behind the strongest layout and the databricks.yml that deploys to it. The reference bundle runs the weakest layout, because one workspace can only show that one, and audits it. For the shorter overview of the same ground, read the Environment separation page.',
  shortVersion: [
    {
      title: 'Prod gets its own workspace and its own catalog.',
      body: 'Merging dev and test is fine for a small team. Prod always stands alone, with its own identities, storage, and network rules.',
    },
    {
      title: 'A catalog per environment is the default.',
      body: 'dev, test, stage, and prod each hold domain schemas. Add the domain to the catalog name (dev_sales) only when domains have different owners.',
    },
    {
      title: 'One catalog with environment schemas is the weak option.',
      body: 'A workspace binding applies to a whole catalog, so it cannot keep dev away from prod schemas, and all environments share one storage location.',
    },
    {
      title: 'Isolate and bind every catalog.',
      body: 'Set isolation mode ISOLATED and bind each catalog to its own workspace. Bind prod into stage read-only only when a parity check needs it.',
    },
    {
      title: 'Code moves; data does not.',
      body: 'The same commit deploys to every target. Each environment fills its tables from its own sources, with generated or masked data outside prod.',
    },
  ],
  sections: [
    {
      id: 'topology',
      heading: 'Workspace topology',
      prose:
        'A workspace is where code runs and where people sign in. The topology decides how much a mistake in one environment can reach. Every workspace in a region attaches to the same Unity Catalog metastore, because an account gets only one metastore per region. Separation then comes from catalogs, bindings, and identities, not from extra metastores.',
      diagram: {
        type: 'flow',
        title: 'Four workspaces on one metastore',
        description:
          'One Unity Catalog metastore for the region. Four workspaces attach to it: dev, test, stage, and prod. Prod is drawn heavier because it always stands alone.',
        nodes: [
          { id: 'ms', label: 'Unity Catalog metastore', sub: 'one per region', col: 0, row: 1, kind: 'store' },
          { id: 'dev', label: 'dev workspace', sub: 'engineers deploy here', col: 1, row: 0 },
          { id: 'test', label: 'test workspace', sub: 'integration runs', col: 1, row: 1 },
          { id: 'stage', label: 'stage workspace', sub: 'release rehearsal', col: 1, row: 2 },
          { id: 'prod', label: 'prod workspace', sub: 'always its own', col: 1, row: 3, kind: 'highlight' },
        ],
        edges: [
          { from: 'ms', to: 'dev', label: 'attached' },
          { from: 'ms', to: 'test' },
          { from: 'ms', to: 'stage' },
          { from: 'ms', to: 'prod' },
        ],
        legend: [
          { kind: 'store', label: 'Account-level metadata' },
          { kind: 'highlight', label: 'Never shared with other environments' },
        ],
      },
      table: {
        caption: 'Choosing a topology',
        columns: ['Topology', 'When it fits'],
        rows: [
          ['Four workspaces: dev, test, stage, prod', 'Several teams, or a release process with a rehearsal. Test runs integration against generated data. Stage mirrors prod configuration at a smaller scale.'],
          ['Dev and test merged', 'Small teams. Databricks suggests two workspaces (dev and prod) up to about five engineers and three (dev, staging, prod) beyond that. Run integration tests in the dev workspace in their own schema so they never touch a personal sandbox.'],
          ['Prod on its own', 'Always. Prod has its own identities, secrets, quotas, network rules, and catalog. Regulated industries go further and use a separate cloud account.'],
          ['One metastore per region', 'All environment workspaces in the region share it, so grants, lineage, and system tables span the whole path. Use separate regions or accounts only for data-sovereignty or regulatory requirements that catalog-level isolation cannot meet.'],
        ],
      },
      links: [
        { label: 'Developer best practices: isolate workspace environments', url: 'https://docs.databricks.com/aws/en/developers/best-practices' },
        { label: 'Unity Catalog best practices', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/best-practices' },
      ],
    },
    {
      id: 'layouts',
      heading: 'What "your catalog" looks like in each layout',
      prose:
        'The catalog is the first level of a table name, so the layout decides what every table is called and what a boundary can cover. Three layouts are common. Layout (a) is the default for most teams. Layout (b) adds the domain to the catalog name when domains have different owners and budgets. Layout (c) keeps one catalog and puts the environment in the schema name. It works for a small team and gives up the boundaries that bindings and storage provide.',
      diagram: {
        type: 'matrix',
        title: 'Three catalog layouts side by side',
        description:
          'A comparison of three layouts across catalog names, schema names, the prod table name, the bundle variables, workspace bindings, and storage. Layouts (a) and (b) have a catalog per environment, so each can have its own binding and storage. Layout (c) has one catalog, so bindings and storage are shared.',
        corner: 'What changes',
        columns: ['(a) Catalog per environment', '(b) Per environment and domain', '(c) One catalog'],
        rows: [
          {
            label: 'Catalogs',
            cells: [
              { state: 'own', text: 'dev, test, stage, prod' },
              { state: 'own', text: 'dev_sales … prod_sales' },
              { state: 'optional', text: 'analytics', sub: 'one for all environments' },
            ],
          },
          {
            label: 'Schemas',
            cells: [
              { state: 'own', text: 'sales, finance', sub: 'domains' },
              { state: 'own', text: 'reporting, raw', sub: 'layers' },
              { state: 'optional', text: 'dev_sales … prod_sales', sub: 'environment in the name' },
            ],
          },
          {
            label: 'Prod table',
            cells: [
              { state: 'own', text: 'prod.sales.daily_revenue' },
              { state: 'own', text: 'prod_sales.reporting.daily_revenue' },
              { state: 'optional', text: 'analytics.prod_sales.daily_revenue' },
            ],
          },
          {
            label: 'Bundle variables',
            sub: 'catalog / schema',
            cells: [
              { state: 'own', text: 'prod / sales' },
              { state: 'own', text: 'prod_sales / reporting' },
              { state: 'optional', text: 'analytics / prod_sales' },
            ],
          },
          {
            label: 'Workspace binding',
            cells: [
              { state: 'own', text: 'One per environment' },
              { state: 'own', text: 'One per environment and domain' },
              { state: 'none', text: 'None between environments', sub: 'one binding for the catalog' },
            ],
          },
          {
            label: 'Managed storage',
            cells: [
              { state: 'own', text: 'Own bucket per environment' },
              { state: 'own', text: 'Own bucket per environment' },
              { state: 'none', text: 'One location for all', sub: 'schema-level storage is possible' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Separated per environment' },
          { state: 'optional', label: 'Works, but weaker' },
          { state: 'none', label: 'Shared by all environments' },
        ],
      },
      table: {
        caption: 'The name one sales table gets in each layout',
        columns: ['Layout and environment', 'Three-level name'],
        rows: [
          ['(a) dev', 'dev.sales.daily_revenue'],
          ['(a) prod', 'prod.sales.daily_revenue'],
          ['(b) dev', 'dev_sales.reporting.daily_revenue'],
          ['(b) prod', 'prod_sales.reporting.daily_revenue'],
          ['(c) dev', 'analytics.dev_sales.daily_revenue'],
          ['(c) prod', 'analytics.prod_sales.daily_revenue'],
        ],
      },
      examples: [
        {
          label: 'One bundle, three mappings: the prod target',
          language: 'yaml',
          code: `# Layout (a): catalog per environment
variables: { catalog: prod, schema: sales }

# Layout (b): catalog per environment and domain
variables: { catalog: prod_sales, schema: reporting }

# Layout (c): one catalog, environment in the schema
variables: { catalog: analytics, schema: prod_sales }`,
          notes: ['Each target sets only these two variables. Resource files never contain a catalog name.'],
        },
        {
          label: 'Resource files read the variables',
          language: 'yaml',
          code: `resources:
  jobs:
    daily_revenue:
      parameters:
        - name: table
          default: \${var.catalog}.\${var.schema}.daily_revenue`,
          notes: ['The same job definition produces the right name in every layout and target.'],
        },
      ],
      points: [
        {
          strong: 'Why (c) is weaker: no binding boundary.',
          text: 'A workspace binding attaches to a whole catalog. Every workspace that needs any environment must be bound to the one catalog, so dev can see the prod schema in Catalog Explorer and only schema grants stand in the way. A catalog per environment lets you bind prod to the prod workspace and nothing else.',
        },
        {
          strong: 'Why (c) is weaker: shared storage.',
          text: 'Managed tables from all environments land under one managed location, so one cloud role can reach them all. Layouts (a) and (b) give each catalog its own location, credential, and bucket. You can set a managed location on a single schema in (c), which helps but is easy to forget.',
        },
        {
          strong: 'Pick by ownership, not by taste.',
          text: 'Use (b) when each domain team owns its catalogs, budget, and grants. Use (a) when one platform team owns them. Move from (c) to (a) before the first sensitive dataset lands.',
        },
      ],
      links: [
        { label: 'What are catalogs?', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/create-catalogs' },
        { label: 'Bundle variables', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/variables' },
      ],
    },
    {
      id: 'bindings',
      heading: 'Bindings, storage, and credentials',
      prose:
        'By default every catalog is OPEN to every workspace on the metastore. Setting its isolation mode to ISOLATED makes the workspace bindings count: a workspace that is not bound gets an error, even for users with grants. A binding is read-write by default and can be read-only. Storage works the same way: each catalog gets its own managed location, which sits inside an external location that uses a storage credential, and credentials and external locations can be bound to workspaces too.',
      diagram: {
        type: 'flow',
        title: 'The prod catalog, from bucket to workspace',
        description:
          'The prod bucket is reached through the prod_storage credential and the prod_managed external location. The prod catalog uses that location as its managed location and is ISOLATED. It is bound read-write to the prod workspace and read-only to the stage workspace for parity checks. The dev and test workspaces have no binding, so they cannot see it.',
        nodes: [
          { id: 'bucket', label: 'Prod bucket', sub: 'its own container', col: 0, row: 1, kind: 'store' },
          { id: 'cred', label: 'prod_storage', sub: 'storage credential', col: 1, row: 1, mono: true },
          { id: 'loc', label: 'prod_managed', sub: 'external location', col: 2, row: 1, mono: true },
          { id: 'cat', label: 'prod', sub: 'catalog, ISOLATED', col: 3, row: 1, kind: 'highlight', mono: true },
          { id: 'wsprod', label: 'prod workspace', sub: 'read-write', col: 4, row: 0 },
          { id: 'wsstage', label: 'stage workspace', sub: 'read-only, for parity', col: 4, row: 1 },
          { id: 'wsdev', label: 'dev and test', sub: 'no binding: not visible', col: 4, row: 2, kind: 'gate' },
        ],
        edges: [
          { from: 'bucket', to: 'cred', label: 'cloud role' },
          { from: 'cred', to: 'loc' },
          { from: 'loc', to: 'cat', label: 'managed location' },
          { from: 'cat', to: 'wsprod', label: 'binding' },
          { from: 'cat', to: 'wsstage', label: 'binding', dashed: true },
          { from: 'cat', to: 'wsdev', label: 'blocked', dashed: true },
        ],
        legend: [
          { kind: 'highlight', label: 'Catalog' },
          { kind: 'gate', label: 'No access' },
          { kind: 'dashed', label: 'Optional or denied' },
        ],
      },
      points: [
        {
          strong: 'Isolation first, then bindings.',
          text: 'The bindings are only consulted once the catalog is ISOLATED. Catalogs created from SQL or the API start OPEN. The CLI command is catalogs update with --isolation-mode ISOLATED, then workspace-bindings update-bindings.',
        },
        {
          strong: 'Read-only prod in stage.',
          text: 'A BINDING_TYPE_READ_ONLY binding lets stage compare against prod data for parity checks and blocks every write from stage. Add it only when a check needs it, and remove it afterwards.',
        },
        {
          strong: 'One managed location per catalog.',
          text: 'Give each catalog a MANAGED LOCATION inside its environment\'s external location. Each environment then writes to its own bucket, through its own credential.',
        },
        {
          strong: 'Bind credentials and locations too.',
          text: 'Storage credentials and external locations take bindings, so a dev workspace cannot use the prod cloud role or browse the prod bucket. Their isolation flag is ISOLATION_MODE_ISOLATED, not ISOLATED.',
        },
        {
          strong: 'Who can change a binding.',
          text: 'A metastore admin, the catalog owner, or a user with MANAGE on the catalog. Viewing bindings needs READ METADATA.',
        },
      ],
      links: [
        { label: 'Workspace-catalog binding', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/access-control/workspace-catalog-binding' },
        { label: 'Managed storage locations', url: 'https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage' },
        { label: 'External locations', url: 'https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/external-locations' },
        { label: 'Storage credentials', url: 'https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/storage-credentials' },
      ],
    },
    {
      id: 'sandboxes',
      heading: 'Personal sandboxes in dev',
      prose:
        'Developers need a place to break things. In dev, give each person a schema of their own instead of a copy of the catalog. Bundle development mode does this for you: it prefixes the schema with dev_<you>_, so two people deploy the same bundle to the same catalog without colliding. Developers get create rights on dev only. Nothing they build there is promoted; the commit is.',
      points: [
        {
          strong: 'The schema variable stays plain.',
          text: 'The target sets schema once. Development mode adds dev_<you>_ in front, so the same bundle yields dev_rob_peng_envdemo for one person and dev_ana_envdemo for another.',
        },
        {
          strong: 'Clean-up is one command.',
          text: 'bundle destroy drops a person\'s schema and everything in it. Shared dev data lives in a separate, owned schema that nobody destroys.',
        },
        {
          strong: 'Sandboxes stay in dev.',
          text: 'Test, stage, and prod have no personal schemas. Their schemas are created by the bundle and owned by the environment\'s service principal.',
        },
      ],
      links: [
        { label: 'Deployment modes', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/deployment-modes' },
      ],
    },
    {
      id: 'identities',
      heading: 'Identities',
      prose:
        'Name each identity for what it does in each environment. Use account-level groups, one set per environment, and never grant to individual users. Each environment gets a deploy service principal, which signs in from CI and creates the resources. Each also gets a run-as service principal, which jobs and pipelines run as and which owns prod objects. People read prod and change nothing there.',
      diagram: {
        type: 'matrix',
        title: 'Who can do what, by environment',
        description:
          'Engineers write in dev and read in test, stage, and prod. Analysts read in prod only. The deploy service principal deploys in test, stage, and prod, and engineers deploy to dev themselves. The run-as service principal owns the objects in test, stage, and prod.',
        corner: 'Identity',
        columns: ['dev', 'test', 'stage', 'prod'],
        rows: [
          {
            label: 'Engineers',
            sub: 'account group',
            cells: [
              { state: 'own', text: 'Write', sub: 'own sandbox' },
              { state: 'optional', text: 'Read' },
              { state: 'optional', text: 'Read' },
              { state: 'optional', text: 'Read' },
            ],
          },
          {
            label: 'Analysts',
            sub: 'account group',
            cells: [
              { state: 'none', text: 'No access' },
              { state: 'none', text: 'No access' },
              { state: 'none', text: 'No access' },
              { state: 'optional', text: 'Read' },
            ],
          },
          {
            label: 'Deploy service principal',
            sub: 'signs in from CI',
            cells: [
              { state: 'none', text: 'Not used', sub: 'people deploy' },
              { state: 'own', text: 'Deploys' },
              { state: 'own', text: 'Deploys' },
              { state: 'own', text: 'Deploys', sub: 'after approval' },
            ],
          },
          {
            label: 'Run-as service principal',
            sub: 'one per environment',
            cells: [
              { state: 'none', text: 'You run it' },
              { state: 'own', text: 'Owns and writes' },
              { state: 'own', text: 'Owns and writes' },
              { state: 'own', text: 'Owns and writes' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Writes or deploys' },
          { state: 'optional', label: 'Read only' },
          { state: 'none', label: 'No access' },
        ],
      },
      points: [
        {
          strong: 'Groups per environment.',
          text: 'Create account-level groups such as dev-engineers and prod-analysts, ideally from your identity provider. Workspace-local groups cannot take Unity Catalog grants, and a group made in one workspace does not exist in the others.',
        },
        {
          strong: 'Split deploy from run.',
          text: 'The deploy principal needs little or no data access. The run-as principal needs only the data its workloads touch. Rotating one does not break the other.',
        },
        {
          strong: 'Prod objects belong to a service principal.',
          text: 'The creator of an object is its first owner, so a person who deploys prod by hand becomes its owner. Make the run-as service principal the catalog owner, and deploy prod only from CI.',
        },
        {
          strong: 'People read prod.',
          text: 'Give them SELECT on the prod catalog through a group. A change to prod goes through Git and CI, not through a SQL editor.',
        },
      ],
      links: [
        { label: 'Run as a service principal', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/run-as' },
        { label: 'Service principals', url: 'https://docs.databricks.com/aws/en/admin/users-groups/service-principals' },
        { label: 'Groups', url: 'https://docs.databricks.com/aws/en/admin/users-groups/groups' },
        { label: 'Privileges and ownership', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/manage-privileges/' },
      ],
    },
    {
      id: 'promotion',
      heading: 'Promotion: code moves, data doesn\'t',
      prose:
        'A release is a Git commit. CI deploys that commit to each environment in turn, and every environment builds its tables from its own sources. Nothing is copied from prod down. Where a lower environment needs realistic data, give it a generated or masked sample, or share one approved dataset out of prod with OpenSharing.',
      diagram: {
        type: 'flow',
        title: 'Code goes forward; each environment has its own data',
        description:
          'One commit deploys to dev, then test, then stage, then prod, with approvals before stage and prod. Below, each environment reads its own data: generated samples in dev and test, a masked or shared sample in stage, and real sources in prod.',
        nodes: [
          { id: 'commit', label: 'Git commit', sub: 'one SHA, one release', col: 0, row: 0, kind: 'store' },
          { id: 'dev', label: 'dev', sub: 'CI deploys', col: 1, row: 0 },
          { id: 'test', label: 'test', sub: 'integration run', col: 2, row: 0 },
          { id: 'stage', label: 'stage', sub: 'approval, then deploy', col: 3, row: 0, kind: 'gate' },
          { id: 'prod', label: 'prod', sub: 'approval, then deploy', col: 4, row: 0, kind: 'highlight' },
          { id: 'gen', label: 'Generated samples', sub: 'seeded, no real data', col: 1, row: 1, kind: 'surface' },
          { id: 'gen2', label: 'Generated samples', sub: 'larger, with bad rows', col: 2, row: 1, kind: 'surface' },
          { id: 'mask', label: 'Masked or shared', sub: 'approved OpenSharing', col: 3, row: 1, kind: 'surface' },
          { id: 'real', label: 'Real sources', sub: 'prod systems only', col: 4, row: 1, kind: 'surface' },
        ],
        edges: [
          { from: 'commit', to: 'dev', label: 'deploy' },
          { from: 'dev', to: 'test' },
          { from: 'test', to: 'stage' },
          { from: 'stage', to: 'prod' },
          { from: 'gen', to: 'dev', dashed: true },
          { from: 'gen2', to: 'test', dashed: true },
          { from: 'mask', to: 'stage', dashed: true },
          { from: 'real', to: 'prod', dashed: true },
        ],
        legend: [
          { kind: 'gate', label: 'Approval gate' },
          { kind: 'surface', label: 'Data source' },
          { kind: 'dashed', label: 'Reads' },
        ],
      },
      points: [
        {
          strong: 'Generate, don\'t copy.',
          text: 'A seeded generator gives the same rows every run, so a failing test is reproducible. The reference job loads 50 generated orders in dev, test, and stage and none in prod.',
        },
        {
          strong: 'Mask when you need the shape of real data.',
          text: 'Build the masked copy inside prod with a reviewed job, and move only the masked output to the lower environment.',
        },
        {
          strong: 'OpenSharing for approved datasets.',
          text: 'When environments sit on different metastores or in different regions, a share gives the lower environment read-only access to one approved dataset. It is not a way around the prod binding.',
        },
        {
          strong: 'Same commit, same tag.',
          text: 'Pass the commit SHA as the release variable, so every job in every environment carries the release it came from.',
        },
      ],
      links: [
        { label: 'OpenSharing', url: 'https://docs.databricks.com/aws/en/delta-sharing/' },
        { label: 'GitHub Actions with Databricks', url: 'https://docs.databricks.com/aws/en/dev-tools/ci-cd/github' },
      ],
    },
    {
      id: 'cost',
      heading: 'Cost and tags',
      prose:
        'Tag every resource with its environment and release, and attach a serverless usage policy per environment so serverless spend carries the same label. System tables then answer "what did stage cost last month" without a spreadsheet. A governed tag on environment keeps the values consistent, and it can also reject yours.',
      table: {
        caption: 'Where the environment label comes from',
        columns: ['Source', 'What it labels'],
        rows: [
          ['presets.tags on each bundle target', 'Jobs and pipelines: environment and release. They appear in system.billing.usage as custom_tags.'],
          ['Serverless usage policy per environment (Public Preview)', 'Serverless notebooks, jobs, pipelines, and apps that use the policy. Its tags propagate to custom_tags.'],
          ['Governed tag environment on schemas and catalogs', 'Data objects. Allowed values are fixed by the tag policy.'],
          ['Budgets', 'Serverless usage policy tags let you attribute usage to a specific budget, so spend can be tracked per environment.'],
        ],
      },
      examples: [
        {
          label: 'DBUs by environment, last 30 days',
          language: 'sql',
          code: `SELECT custom_tags['environment'] AS environment, round(sum(usage_quantity), 1) AS dbus
FROM system.billing.usage
WHERE usage_unit = 'DBU' AND usage_date >= date_sub(current_date(), 30)
GROUP BY 1 ORDER BY 2 DESC`,
          notes: ['Rows with a null environment are untagged spend. Chase those first.'],
        },
      ],
      points: [
        {
          strong: 'Governed tags can refuse your names.',
          text: 'In the reference workspace the environment tag allows only dev, staging, prod, and demo. Tagging a schema test or stage was refused, so the reference job reports that as a warning. Match your environment names to the policy, or ask its owner to add them.',
        },
        {
          strong: 'Serverless usage policies were budget policies.',
          text: 'The feature was renamed. It is Public Preview, and a user can only pick policies they have been granted.',
        },
      ],
      links: [
        { label: 'Serverless usage policies', url: 'https://docs.databricks.com/aws/en/admin/usage/budget-policies' },
        { label: 'Billable usage system table', url: 'https://docs.databricks.com/aws/en/admin/system-tables/billing' },
        { label: 'Governed tags', url: 'https://docs.databricks.com/aws/en/admin/governed-tags/' },
      ],
    },
    {
      id: 'setup',
      heading: 'Set it up, step by step',
      prose:
        'This is the sequence for layout (a). A metastore admin runs steps 1 to 4 once. Each command is checked against the installed CLI\'s help and the bindings documentation. This repo does not run them, because they need four workspaces and cloud roles. The files are in setup/ in the reference bundle.',
      steps: [
        {
          title: '1. Create a storage credential per environment',
          body: 'Each credential points at a different cloud role. Azure and GCP use azure_managed_identity and databricks_gcp_service_account in the same JSON.',
        },
        {
          title: '2. Create external locations and catalogs',
          body: 'The external location sits on the environment\'s bucket. The catalog\'s MANAGED LOCATION is a path inside it. You need CREATE CATALOG on the metastore and CREATE MANAGED STORAGE on the location.',
        },
        {
          title: '3. Isolate each catalog and bind it to its workspace',
          body: 'Run catalogs update --isolation-mode ISOLATED, then workspace-bindings update-bindings for the environment\'s workspace. Optionally add prod to stage as BINDING_TYPE_READ_ONLY.',
        },
        {
          title: '4. Grant to groups and move ownership to service principals',
          body: 'Engineers get ALL PRIVILEGES in dev and SELECT elsewhere. The run-as service principal owns test, stage, and prod. Analysts get SELECT on prod.',
        },
        {
          title: '5. Check the result',
          body: 'workspace-bindings get-bindings catalog <name> lists each catalog\'s workspaces. SHOW GRANTS ON CATALOG shows who holds what. The reference audit job does the same checks for you.',
        },
      ],
      links: [
        { label: 'Create catalogs', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/create-catalogs' },
        { label: 'Manage privileges', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/manage-privileges/' },
        { label: 'Databricks CLI commands', url: 'https://docs.databricks.com/aws/en/dev-tools/cli/commands' },
      ],
    },
    {
      id: 'targets',
      heading: 'The databricks.yml targets block',
      prose:
        'The bundle that deploys to these environments has one target per environment. Each target sets its workspace host, its catalog variable, and (outside dev) production mode and the service principal that runs the resources. The placeholders below are the only things you replace. CI signs in as the deploy service principal, so the root_path resolves to that principal\'s folder.',
      table: {
        caption: 'What each target sets',
        columns: ['Target', 'Settings'],
        rows: [
          ['dev', 'mode: development. The developer deploys from an IDE and runs as themselves. The schema gets a dev_<you>_ prefix.'],
          ['test', 'mode: production. Deployed by CI. run_as the test service principal. catalog: test.'],
          ['stage', 'mode: production. Deployed by CI after approval. run_as the stage service principal. catalog: stage.'],
          ['prod', 'mode: production, git branch main only. Deployed by CI after approval. run_as the prod service principal. catalog: prod.'],
        ],
      },
      points: [
        {
          strong: 'The reference bundle differs on purpose.',
          text: 'It deploys all four targets to one workspace, with schemas in one catalog, and uses a name prefix to keep them apart. The four-workspace file is validated with --strict in a scratch copy that uses a real host. It is not deployed.',
        },
        {
          strong: 'Production mode needs a fixed root_path.',
          text: 'validate fails without one. A path under the deploying identity\'s user folder that names the target passes --strict. /Workspace/Shared raises a warning, which --strict treats as an error.',
        },
      ],
      links: [
        { label: 'Bundle configuration: targets', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/settings' },
        { label: 'Specify a run identity', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/run-as' },
        { label: 'Workload identity federation for GitHub Actions', url: 'https://docs.databricks.com/aws/en/dev-tools/auth/provider-github' },
      ],
    },
    {
      id: 'reference-run',
      heading: 'What the reference run shows',
      prose:
        'The reference workspace has one workspace and one catalog, so the run shows layout (c) and audits it. It cannot show bindings between environments, per-environment storage, or per-environment identities. It does read the real isolation mode, bindings, owner, and grants of the catalog and judges them. The job deploys with the dev target; the audit table is rebuilt on every run.',
      table: {
        caption: 'Audit findings from the dev target',
        columns: ['Check', 'Finding'],
        rows: [
          ['layout (info)', 'Layout (c): one catalog with environment schemas.'],
          ['environments (info)', 'Only dev exists. With test, stage, and prod also deployed, this check passes.'],
          ['isolation, bindings (pass)', 'The catalog is ISOLATED and bound to this one workspace, read-write.'],
          ['owner, storage (pass)', 'A service principal owns the catalog, and it has its own managed location.'],
          ['sandbox, tag (pass)', 'The dev schema is a personal sandbox and is tagged environment=dev.'],
          ['boundary (warn)', 'Environments share one catalog: a binding cannot keep dev away from prod inside it, and they share one managed location.'],
        ],
      },
      points: [
        {
          strong: 'The catalog is fine; the layout is the issue.',
          text: 'Every catalog-level check passes. The one warning is about layout (c) itself, which is the point of the comparison above.',
        },
        {
          strong: 'Prod run, all four deployed.',
          text: 'The prod target passed the grants check (no person can write to the prod schema) and warned that a person owns the prod schema, because a person deployed it. In a real prod, CI deploys as the service principal.',
        },
        {
          strong: 'Governed tags rejected test and stage.',
          text: 'The metastore\'s environment tag allows only dev, staging, prod, and demo. The test and stage schemas stayed untagged, and the audit warned.',
        },
      ],
    },
  ],
  related: [
    { slug: 'github-cicd', title: 'GitHub-based CI/CD' },
    { slug: 'dab-starter', title: 'Running a Declarative Automation Bundle' },
    { slug: 'dataops', title: 'Pipeline operations' },
    { slug: 'access-management', title: 'Access management' },
    { slug: 'git-collaboration', title: 'Collaborating on Databricks projects with Git' },
  ],
};
