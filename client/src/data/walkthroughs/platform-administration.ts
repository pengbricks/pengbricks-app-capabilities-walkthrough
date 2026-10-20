import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'platform-administration',
  area: 'Governance/Monitoring',
  title: 'Workspace and account administration',
  intro:
    'Databricks administration splits into the account, which owns identity, metastores, workspaces, and billing, and the workspaces, which own compute, jobs, and day-to-day work. Getting that split right is most of the job. This page covers the operating model, how to manage identity and credentials, the network and encryption controls to decide on early, how to govern serverless and classic compute, and how to keep all of it in code.',
  shortVersion: [
    {
      title: 'Manage identity at the account.',
      body: 'Sync users and groups from your identity provider, grant to account groups, and run automation as service principals.',
    },
    {
      title: 'One metastore per region, many workspaces.',
      body: 'Attach every workspace in a region to the same metastore. Use workspace-catalog bindings to keep production catalogs out of development workspaces.',
    },
    {
      title: 'Prefer OAuth to personal access tokens.',
      body: 'Use OAuth M2M or workload identity federation for automation, OAuth sign-in for people, and restrict or scope any PAT you keep.',
    },
    {
      title: 'Decide the network posture before the first workload.',
      body: 'Serverless egress control, Private Link, IP access lists, customer-managed keys, and the compliance security profile are cheaper to start with than to retrofit.',
    },
    {
      title: 'Serverless first; policies for classic.',
      body: 'Govern serverless with budget policies, base environments, and egress rules. Use cluster policies only where classic compute remains. Put it all in Terraform or bundles.',
    },
  ],
  sections: [
    {
      id: 'model',
      heading: 'The account and workspace operating model',
      prose:
        'Put each responsibility at the level that owns it. Most governance work belongs at the account and metastore, not in each workspace.',
      diagram: {
        type: 'flow',
        title: 'What lives at which level',
        description:
          'The account holds identity, workspaces, network and encryption configuration, billing, and one Unity Catalog metastore per region. Workspaces in a region attach to that regional metastore. Catalogs sit in the metastore, and workspace-catalog bindings decide which workspaces can reach each catalog. Compute, jobs, and workspace settings live inside each workspace.',
        lanes: [
          { label: 'Account', fromRow: 0, toRow: 0 },
          { label: 'Regional metastore', fromRow: 1, toRow: 1 },
          { label: 'Workspaces', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          { id: 'id', label: 'Identity', sub: 'users, groups, SPs', col: 0, row: 0, kind: 'highlight' },
          { id: 'net', label: 'Network and keys', sub: 'policies, CMK', col: 1, row: 0 },
          { id: 'bill', label: 'Billing and budgets', sub: 'system.billing', col: 2, row: 0 },
          { id: 'ms', label: 'Metastore', sub: 'one per region', col: 0, row: 1, kind: 'store' },
          { id: 'cat', label: 'Catalogs', sub: 'dev, staging, prod', col: 1, row: 1, kind: 'store' },
          { id: 'dev', label: 'Dev workspace', sub: 'binds dev catalog', col: 0, row: 2, kind: 'surface' },
          { id: 'prod', label: 'Prod workspace', sub: 'binds prod catalog', col: 1, row: 2, kind: 'surface' },
        ],
        edges: [
          { from: 'id', to: 'ms' },
          { from: 'ms', to: 'cat' },
          { from: 'cat', to: 'dev', label: 'binding', dashed: true },
          { from: 'cat', to: 'prod', label: 'binding', dashed: true },
        ],
        legend: [
          { kind: 'highlight', label: 'Single source of identity' },
          { kind: 'store', label: 'Governed data' },
          { kind: 'surface', label: 'Where work runs' },
        ],
      },
      points: [
        {
          strong: 'Roles.',
          text: 'Account admins manage the account. Metastore admins are optional; assign them only if you need them, and to a group. Workspace admins manage one workspace. Give the billing admin role to the people who manage budgets and usage policies.',
        },
        {
          strong: 'Workspace-catalog binding.',
          text: 'Binding a catalog to specific workspaces denies access from every other workspace, even for users who hold privileges on it. A binding can be read-only for a workspace. The catalog owner or someone with MANAGE sets it.',
        },
        {
          strong: 'Separate environments by workspace and catalog.',
          text: "Use a catalog per environment and bind it to that environment's workspace, instead of two schemas in one catalog.",
        },
        {
          strong: 'Own objects with groups.',
          text: 'The creator of an object is its first owner. Reassign ownership of production objects to a group or service principal.',
        },
      ],
      links: [
        { label: 'Manage your Databricks account', url: 'https://docs.databricks.com/aws/en/admin/account-settings/' },
        {
          label: 'Workspace-catalog binding',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/access-control/workspace-catalog-binding',
        },
        {
          label: 'Unity Catalog best practices',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/best-practices',
        },
      ],
    },
    {
      id: 'identity',
      heading: 'Identity: groups, service principals, and credentials',
      steps: [
        {
          title: 'Sync identities from your identity provider',
          body: 'Turn on automatic identity management, or SCIM provisioning, at the account. Users and groups from your IdP appear in Databricks without manual creation, and removing someone in the IdP removes their access.',
        },
        {
          title: 'Use account-level groups for every grant',
          body: 'Unity Catalog grants take account principals. Workspace-local groups cannot be granted Unity Catalog privileges, so do not create them for access control.',
        },
        {
          title: 'Run automation as service principals',
          body: 'Jobs, pipelines, apps, and CI/CD run as a service principal, so a person leaving does not break them. Make a group the owner and manager of each service principal.',
        },
        {
          title: 'Authenticate service principals with OAuth',
          body: 'Use OAuth machine-to-machine (client ID and secret with a short token lifetime), or, better, workload identity federation, which exchanges a token from GitHub Actions, Azure DevOps, or another trusted issuer so no long-lived secret exists.',
        },
        {
          title: 'Set a PAT stance',
          body: 'Prefer OAuth for people and automation. Personal access tokens are legacy: disable them where you can, restrict who can create them, give them short lifetimes, and review and revoke tokens on a schedule.',
        },
      ],
      links: [
        {
          label: 'Automatic identity management',
          url: 'https://docs.databricks.com/aws/en/admin/users-groups/automatic-identity-management',
        },
        {
          label: 'Service principals',
          url: 'https://docs.databricks.com/aws/en/admin/users-groups/service-principals',
        },
        { label: 'OAuth M2M', url: 'https://docs.databricks.com/aws/en/dev-tools/auth/oauth-m2m' },
        { label: 'OAuth token federation', url: 'https://docs.databricks.com/aws/en/dev-tools/auth/oauth-federation' },
        {
          label: 'Monitor and revoke personal access tokens',
          url: 'https://docs.databricks.com/aws/en/admin/access-control/tokens',
        },
      ],
    },
    {
      id: 'network',
      heading: 'Network security and encryption',
      prose: 'Choose these at design time. Each one touches how workspaces, storage, and clients connect.',
      table: {
        columns: ['Control', 'What it does'],
        rows: [
          [
            'Serverless egress control',
            'Network policies decide which internet destinations serverless compute can reach. Start with restricted access and add the DNS names your workloads need, including external model providers and MCP servers.',
          ],
          [
            'Private Link',
            'Private connectivity from your network to the workspace (front end) and from compute to the control plane and storage (back end). Add private connectivity from serverless compute to your storage as needed.',
          ],
          [
            'IP access lists',
            'Allow lists for workspace access, and a separate list for the account console. They apply to users and API clients coming from the internet.',
          ],
          [
            'Customer-managed keys',
            'Encrypt managed services, workspace storage, and Unity Catalog data with keys you hold in your KMS.',
          ],
          [
            'Compliance security profile',
            'A workspace-level setting that applies hardened images, encryption, and monitoring for standards such as HIPAA and PCI. Plan for it when you create the workspace, and confirm which features your region supports.',
          ],
        ],
      },
      links: [
        {
          label: 'Serverless egress control',
          url: 'https://docs.databricks.com/aws/en/security/network/serverless-network-security/network-policies',
        },
        { label: 'Networking overview', url: 'https://docs.databricks.com/aws/en/security/network/' },
        {
          label: 'IP access lists',
          url: 'https://docs.databricks.com/aws/en/security/network/front-end/ip-access-list',
        },
        {
          label: 'Customer-managed keys',
          url: 'https://docs.databricks.com/aws/en/security/keys/customer-managed-keys',
        },
        {
          label: 'Compliance security profile',
          url: 'https://docs.databricks.com/aws/en/security/privacy/security-profile',
        },
      ],
    },
    {
      id: 'compute',
      heading: 'Govern serverless first, and classic only where it remains',
      points: [
        {
          strong: 'Serverless budget policies.',
          text: 'A policy carries tags that Databricks writes to billing records for serverless notebooks, jobs, pipelines, apps, and serving endpoints. Assign policies to groups and service principals so spend is attributable without the user doing anything. The docs now call these serverless usage policies, and the billing column is usage_policy_id.',
        },
        {
          strong: 'Base environments.',
          text: 'A workspace admin defines a cached base environment from a YAML specification of approved libraries, and sets it as the default for serverless notebooks. Users start fast, with dependencies you have vetted.',
        },
        {
          strong: 'Budgets.',
          text: 'Account admins create budgets that alert by email when monthly spend crosses a threshold, scoped to workspaces or tags.',
        },
        {
          strong: 'Cluster policies, for classic compute only.',
          text: 'Policies limit node types, size, autotermination, and enforce tags on classic compute. They do not apply to serverless, so do not rely on them to control serverless spend.',
        },
      ],
      links: [
        {
          label: 'Serverless usage policies',
          url: 'https://docs.databricks.com/aws/en/admin/usage/budget-policies',
        },
        {
          label: 'Workspace base environments',
          url: 'https://docs.databricks.com/aws/en/admin/workspace-settings/base-environment',
        },
        { label: 'Compute policies', url: 'https://docs.databricks.com/aws/en/admin/clusters/policies' },
      ],
    },
    {
      id: 'as-code',
      heading: 'Administer with code',
      prose:
        'Console clicks do not leave a history, and they differ between environments. Put administration in code so a pull request is the change record.',
      points: [
        {
          strong: 'Terraform for the platform.',
          text: 'Use the Databricks Terraform provider for the account (workspaces, metastores, network configuration, groups, service principals) and for workspace objects (catalogs, grants, cluster policies, warehouses, budgets). Keep account and workspace configurations in separate state.',
        },
        {
          strong: 'Bundles for workloads.',
          text: 'Declarative Automation Bundles (formerly Databricks Asset Bundles) deploy jobs, pipelines, dashboards, and apps per target. Platform teams own the platform in Terraform and application teams own their bundles.',
        },
        {
          strong: 'Review and detect drift.',
          text: 'Apply from CI as a service principal that uses workload identity federation. Run a plan on a schedule to catch changes made by hand.',
        },
        {
          strong: 'Read the audit log.',
          text: 'system.access.audit records who changed what. Alert on changes to admin roles, grants on production catalogs, and token creation.',
        },
      ],
      links: [
        { label: 'Databricks Terraform provider', url: 'https://docs.databricks.com/aws/en/dev-tools/terraform/' },
        { label: 'Declarative Automation Bundles', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/' },
      ],
    },
    {
      id: 'system-tables',
      heading: 'Enable system tables early',
      prose:
        'Billing, audit, lineage, and compute history only start accumulating when the tables are on, so enable them when you set up the account.',
      points: [
        {
          strong: 'Requirement.',
          text: 'The account needs at least one Unity Catalog workspace. System tables cover every workspace in the account (or region, for regional tables) but can be read only from a Unity Catalog workspace.',
        },
        {
          strong: 'Access.',
          text: 'Account admins who are also metastore admins can read them by default. Everyone else needs USE CATALOG on system plus USE SCHEMA and SELECT on the schema. Share through views for most users.',
        },
        {
          strong: 'Use them for routine work.',
          text: 'Failed runs, idle warehouses, expiring tokens, and spend by tag are queries over system tables and the account APIs, not custom collectors.',
        },
      ],
      links: [{ label: 'System tables reference', url: 'https://docs.databricks.com/aws/en/admin/system-tables/' }],
    },
  ],
  related: [
    { slug: 'access-management', title: 'Access management' },
    { slug: 'monitoring', title: 'Platform observability' },
    { slug: 'cost-chargeback', title: 'Cost tracking and chargeback' },
  ],
};
