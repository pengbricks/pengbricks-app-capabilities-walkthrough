import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'access-management',
  area: 'Governance/Monitoring',
  title: 'Access management',
  intro:
    'Unity Catalog decides who can see and change data through privileges on securable objects, evaluated against account-level principals. A sound model is small: grant to groups, separate environments by catalog, let tags drive broad rules, own objects with groups or service principals, and audit continuously. This page lays out that model and the checks that keep it from drifting.',
  shortVersion: [
    {
      title: 'Grant to account-level groups, never to people.',
      body: 'A person joins or leaves a group in the identity provider. No grant has to change, and no one holds a forgotten direct grant.',
    },
    {
      title: 'One catalog per environment.',
      body: 'Dev, staging, and prod are separate catalogs bound to their own workspaces. Two schemas in one catalog share a blast radius.',
    },
    {
      title: 'Use ABAC for rules that span many tables.',
      body: 'Tag the data with governed tags and write one policy per tag, instead of a grant or function per table.',
    },
    {
      title: 'Own with groups and service principals.',
      body: "Ownership carries full control, including the right to grant. Move it off the creator's account for anything in production.",
    },
    {
      title: 'Audit what changed.',
      body: 'system.access.audit records grants, revokes, and ownership changes. Review them and alert on the ones that matter.',
    },
  ],
  sections: [
    {
      id: 'groups',
      heading: 'Grant to account-level groups',
      prose:
        'Unity Catalog privileges attach to account-level principals. Workspace-local groups are not Unity Catalog principals, so create groups in the account and sync them from your identity provider with automatic identity management or SCIM.',
      points: [
        {
          strong: 'Name groups by role and scope.',
          text: 'For example analysts-sales-prod or engineers-platform-dev. A group maps to a job function, not to a project that will end.',
        },
        {
          strong: 'Grant at the highest sensible level.',
          text: 'Privileges inherit down the hierarchy. USE CATALOG and SELECT on a schema cover current and future tables, so you do not re-grant for each new table.',
        },
        {
          strong: 'Grant the minimum.',
          text: 'Readers get USE CATALOG, USE SCHEMA, and SELECT. Writers add MODIFY. Only builders get CREATE TABLE. Avoid ALL PRIVILEGES.',
        },
        {
          strong: 'Check for direct grants.',
          text: 'Any grant whose principal is a user is a finding. Query information_schema for them on a schedule.',
        },
      ],
      examples: [
        {
          label: 'Read access for one group, and a check for person-level grants',
          language: 'sql',
          code: `GRANT USE CATALOG ON CATALOG prod TO \`analysts-sales\`;
GRANT USE SCHEMA, SELECT ON SCHEMA prod.sales TO \`analysts-sales\`;

SELECT grantee, table_schema, table_name, privilege_type
FROM prod.information_schema.table_privileges
WHERE grantee LIKE '%@%';`,
          notes: ['Rows from the second query are direct grants to people. Move each one to a group.'],
        },
      ],
      links: [
        {
          label: 'Manage privileges in Unity Catalog',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/manage-privileges/',
        },
        {
          label: 'Unity Catalog best practices',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/best-practices',
        },
      ],
    },
    {
      id: 'environments',
      heading: 'A catalog per environment, bound to its workspace',
      prose:
        'Make the environment boundary a catalog, not a schema. Each environment gets its own catalog, the catalog is bound to the workspace where that environment runs, and the privileges differ by environment.',
      diagram: {
        type: 'matrix',
        title: 'Same group, different environments',
        description:
          'In the dev catalog, bound to the dev workspace, engineers can read, write, and create tables, and analysts can read. In the prod catalog, bound to the prod workspace, engineers have read access only, analysts can read, and a deploy service principal is the only writer.',
        corner: 'Group ↓ · Catalog →',
        columns: ['dev (dev workspace)', 'prod (prod workspace)'],
        rows: [
          {
            label: 'Engineers',
            cells: [
              { state: 'own', text: 'Read, write, create' },
              { state: 'optional', text: 'Read only' },
            ],
          },
          {
            label: 'Analysts',
            cells: [
              { state: 'optional', text: 'Read' },
              { state: 'optional', text: 'Read' },
            ],
          },
          {
            label: 'Deploy service principal',
            cells: [
              { state: 'none', text: 'None needed' },
              { state: 'own', text: 'Write, owner of objects' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Write or create' },
          { state: 'optional', label: 'Read' },
          { state: 'none', label: 'No access' },
        ],
      },
      points: [
        {
          strong: 'Bindings add a second lock.',
          text: 'A catalog bound to the prod workspace is denied from the dev workspace even for users who hold privileges on it. You can mark a binding read-only.',
        },
        {
          strong: 'Promote with code.',
          text: 'Code and pipelines move from dev to prod through CI running as a service principal. People do not edit prod data by hand.',
        },
      ],
      links: [
        {
          label: 'Workspace-catalog binding',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/access-control/workspace-catalog-binding',
        },
      ],
    },
    {
      id: 'abac',
      heading: 'Use ABAC with governed tags for broad rules',
      prose:
        'When a rule applies to many tables, such as hide PII from everyone except the compliance team, do not grant or write a function table by table. Tag the data with a governed tag, then attach one attribute-based access control policy at the catalog or schema. The policy applies to every table or column that carries the tag, including tables added later.',
      points: [
        {
          strong: 'Governed tags.',
          text: 'Defined at the account with fixed allowed values and controlled permissions on who can create and assign them. Treat tagging as a security boundary, because changing a tag changes which policies apply.',
        },
        {
          strong: 'Policy types.',
          text: 'Row filter and column mask policies are generally available, including cross-engine enforcement. GRANT policies give dynamic privileges based on tags. See the row and column security guide for the details.',
        },
        {
          strong: 'Combine with direct grants carefully.',
          text: "A principal's effective privileges are the union of direct grants and GRANT policies, so review both.",
        },
      ],
      links: [
        {
          label: 'Attribute-based access control',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/',
        },
        {
          label: 'Best practices for ABAC policies',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/best-practices',
        },
      ],
    },
    {
      id: 'ownership',
      heading: 'Ownership, MANAGE, BROWSE, and READ METADATA',
      points: [
        {
          strong: 'Ownership.',
          text: 'The creator of an object is its first owner, and owners can grant on it. Transfer production catalogs, schemas, and tables to a group or a service principal, so the object does not depend on one person.',
        },
        {
          strong: 'MANAGE hygiene.',
          text: 'MANAGE lets a principal grant and change policies on an object. Give it to a small steward group, never broadly, and list who holds it. Owners of a parent catalog or schema can grant on everything below, so keep those owners few.',
        },
        {
          strong: 'BROWSE for discovery.',
          text: 'BROWSE on a catalog lets people see object names and comments in search and Catalog Explorer without being able to read data. Grant it widely so people can find what to request.',
        },
        {
          strong: 'READ METADATA for governance roles.',
          text: 'READ METADATA lets auditors and stewards view metadata, such as policies on a securable, without reading rows.',
        },
        {
          strong: 'Metastore admin is optional.',
          text: 'Assign it only if you need it, and assign it to a group.',
        },
      ],
    },
    {
      id: 'principals',
      heading: 'Service principals and credentials',
      prose:
        "Automation should not run as a person or hold a person's token. Give each pipeline or application its own service principal and grant it only what that workload needs.",
      points: [
        {
          strong: 'Workload identity federation first.',
          text: 'Let the CI system or cloud workload exchange its own identity token for a Databricks token. No secret is stored, so none can leak or expire unnoticed.',
        },
        {
          strong: 'OAuth M2M if you must hold a secret.',
          text: 'Keep the client secret in a secret manager, give it a short lifetime, and rotate it by creating the new secret before deleting the old one.',
        },
        {
          strong: 'Avoid PATs.',
          text: 'Personal access tokens are legacy and tied to a person. Restrict who can create them and review the ones that exist.',
        },
        {
          strong: 'Review the list.',
          text: 'List service principals through the SDK or the account console. Each should have an owner, a purpose, and a current secret or federation policy.',
        },
      ],
      links: [
        {
          label: 'Service principals',
          url: 'https://docs.databricks.com/aws/en/admin/users-groups/service-principals',
        },
        { label: 'OAuth token federation', url: 'https://docs.databricks.com/aws/en/dev-tools/auth/oauth-federation' },
        { label: 'OAuth M2M', url: 'https://docs.databricks.com/aws/en/dev-tools/auth/oauth-m2m' },
      ],
    },
    {
      id: 'audit',
      heading: 'Audit permission changes',
      prose:
        'Every grant, revoke, and ownership change is an event in system.access.audit. Permission changes on Unity Catalog objects are metastore-level events, so filter by the object name in request_params rather than by workspace_id.',
      examples: [
        {
          label: 'Grant and revoke events on one catalog in the last 30 days',
          language: 'sql',
          code: `SELECT event_time, user_identity.email AS actor,
       request_params['securable_full_name'] AS securable,
       request_params['changes'] AS changes,
       response.status_code AS status_code
FROM system.access.audit
WHERE event_date >= current_date() - INTERVAL 30 DAYS
  AND service_name = 'unityCatalog'
  AND action_name = 'updatePermissions'
  AND request_params['securable_full_name'] LIKE 'prod.%'
ORDER BY event_time DESC;`,
          notes: [
            'status_code separates applied changes from refused ones. Investigate repeated refusals.',
            'Alert on grants to individual users, grants of ALL PRIVILEGES, and changes to ownership of production objects.',
          ],
        },
      ],
      links: [
        { label: 'Audit log system table', url: 'https://docs.databricks.com/aws/en/admin/system-tables/audit-logs' },
      ],
    },
  ],
  related: [
    { slug: 'row-column-security', title: 'Row and column security' },
    { slug: 'platform-administration', title: 'Workspace and account administration' },
    { slug: 'data-sharing', title: 'Governed data sharing' },
  ],
};
