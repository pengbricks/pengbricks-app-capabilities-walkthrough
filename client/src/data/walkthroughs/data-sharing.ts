import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'data-sharing',
  area: 'Governance/Monitoring',
  title: 'Governed data sharing',
  intro:
    'OpenSharing (formerly Delta Sharing; the open protocol keeps the name Delta Sharing) lets you share live data and AI assets from Unity Catalog without copying them. The provider creates a share and a recipient, grants one to the other, and revokes when the relationship ends. This page covers which recipient type to pick, the privileges involved, how to share a subset safely, which assets you can share, how to harden credentials for recipients outside Databricks, what crossing a region or cloud costs, and how to audit it. It also names the cases where Clean Rooms or Marketplace fit better.',
  businessValue: {
    summary:
      'Data owners can give partners, customers, and other business units live access to governed data without copying it. This guide is for CDOs and data platform leads who must share outside the company and still control and audit it.',
    outcomes: [
      {
        title: 'No copies to reconcile',
        body:
          'OpenSharing shares live Unity Catalog data, so recipients read current data. There are no extracts to send, no stale copies, and no second set of files to secure.',
      },
      {
        title: 'Share only what is approved',
        body:
          'A view fixes the rows and columns a recipient sees, and the share holds the view, not the base table. Revoking the share ends access.',
      },
      {
        title: 'Controlled access for outside recipients',
        body:
          'Databricks-to-Databricks sharing needs no token. For open recipients, OIDC federation, short token lifetimes, and IP access lists limit the risk of a leaked credential.',
      },
      {
        title: 'A record of who received what',
        body:
          'Sharing activity appears in system tables, so security can review it. Cross-region and cross-cloud transfer is billed by the cloud provider, which finance should plan for.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Prefer Databricks-to-Databricks when the recipient has Unity Catalog.',
      body: 'There is no token to manage, and the recipient adds its own governance. Use an open recipient only for people on other platforms.',
    },
    {
      title: 'Share a view to share a subset.',
      body: 'Tables with row filters or column masks are not shared. A view that fixes the rows and columns carries the restriction, and you add the view, not the base table.',
    },
    {
      title: 'Harden every open recipient.',
      body: 'Prefer OIDC federation. If you must use a bearer token, set a short lifetime, add an IP access list, and rotate.',
    },
    {
      title: 'Know what shares and what does not.',
      body: 'Tables, views, schemas, volumes, materialized views, streaming tables, and metric views are shareable, with the limits listed below.',
    },
    {
      title: 'Cross-region and cross-cloud sharing costs egress.',
      body: 'Sharing in the same region is free of egress charges. Across regions or clouds the cloud provider bills transfer, so plan for it.',
    },
  ],
  sections: [
    {
      id: 'recipients',
      heading: 'Pick the recipient type',
      prose:
        'The recipient type decides how the consumer authenticates and what they can do with the data. The provider chooses it when creating the recipient.',
      diagram: {
        type: 'matrix',
        title: 'Databricks-to-Databricks and open recipients',
        description:
          'A Databricks-to-Databricks recipient has a Unity Catalog workspace, is identified by a sharing identifier, uses no token, and mounts the share as a catalog it governs itself. An open recipient is on any platform, authenticates with OIDC federation or a bearer token, and reads through an OpenSharing client or connector with a credential from the provider.',
        corner: 'Aspect ↓ · Recipient →',
        columns: ['Databricks-to-Databricks', 'Open (Databricks-to-Open)'],
        rows: [
          {
            label: 'Who it is for',
            cells: [
              { state: 'own', text: 'Has a Unity Catalog workspace' },
              { state: 'optional', text: 'Any platform or client' },
            ],
          },
          {
            label: 'Authentication',
            cells: [
              { state: 'own', text: 'Sharing identifier, no token' },
              { state: 'optional', text: 'OIDC federation or bearer token' },
            ],
          },
          {
            label: 'Recipient governance',
            cells: [
              { state: 'own', text: 'Grants, lineage, and its own row filters and masks' },
              { state: 'none', text: 'Whatever the client provides' },
            ],
          },
          {
            label: 'Assets',
            cells: [
              { state: 'own', text: 'Widest set of asset types and features' },
              { state: 'optional', text: 'Tables, views, and the types the open protocol supports' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Preferred when available' },
          { state: 'optional', label: 'Use when needed' },
          { state: 'none', label: 'Not provided' },
        ],
      },
      links: [
        { label: 'What is OpenSharing?', url: 'https://docs.databricks.com/aws/en/delta-sharing/' },
        {
          label: 'Databricks-to-Databricks protocol',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/share-data-databricks',
        },
        {
          label: 'Databricks-to-Open protocol',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/share-data-open',
        },
      ],
    },
    {
      id: 'privileges',
      heading: 'Privileges to set up and grant a share',
      prose: 'Give these to a group, not to a person, and make a group the share owner.',
      table: {
        columns: ['Task', 'Needs'],
        rows: [
          ['Create a share', 'CREATE SHARE on the metastore, in a workspace attached to that metastore'],
          [
            'Add a table, view, or other asset',
            'Share owner, USE CATALOG and USE SCHEMA on its parents, and SELECT on the asset. Keep the SELECT, or the asset stops being shared.',
          ],
          ['Create a recipient', 'Metastore admin or CREATE RECIPIENT on the metastore'],
          [
            'Grant a recipient access to a share',
            'Metastore admin, or (USE SHARE and SET SHARE PERMISSION, or share owner) and (USE RECIPIENT, or recipient owner)',
          ],
          ['Assign an IP access list to an existing recipient', 'Recipient owner'],
          ['Read audit events', 'SELECT on system.access.audit'],
        ],
      },
      points: [
        {
          strong: 'Ownership matters.',
          text: 'The share owner needs enough access to every asset in the share, including tables added to a shared schema later. Object creators have to grant it.',
        },
        {
          strong: 'Revoke to end access.',
          text: 'REVOKE on the share cuts the recipient off for new reads. For an open recipient, also rotate or drop the recipient to retire the credential.',
        },
      ],
    },
    {
      id: 'subsets',
      heading: 'Share a subset with a view',
      prose:
        'OpenSharing does not share a table that has row filters or column masks on it; the provider skips it. To give a recipient only some rows or columns, create a view over the table that selects them, and add the view to the share instead of the base table. The recipient never sees the base table or the columns you left out.',
      examples: [
        {
          label: 'A view that fixes the region and drops a PII column',
          language: 'sql',
          code: `CREATE OR REPLACE VIEW sales.shared.orders_west AS
SELECT order_id, order_date, region, product_id, amount
FROM sales.core.orders
WHERE region = 'WEST';

CREATE SHARE IF NOT EXISTS partner_orders;
ALTER SHARE partner_orders ADD VIEW sales.shared.orders_west AS shared.orders;
GRANT SELECT ON SHARE partner_orders TO RECIPIENT partner_acme;`,
          notes: [
            'Use AS to give the recipient a neutral schema and table name.',
            'A recipient on Databricks can apply its own row filters and column masks to shared tables in its metastore.',
          ],
        },
      ],
      points: [
        {
          strong: 'ABAC-secured tables.',
          text: 'Sharing a table or schema secured by ABAC policies is in preview. Only the share owner, or a user excluded from the policies, can add it, and the policy does not govern what the recipient reads. Share a view when the recipient should see less.',
        },
      ],
    },
    {
      id: 'assets',
      heading: 'What you can share',
      table: {
        caption: 'Shareable assets and their status in the current documentation',
        columns: ['Asset', 'Status and limits'],
        rows: [
          ['Delta tables', 'GA. Tables with row filters, column masks, collations, or SHALLOW CLONE are skipped.'],
          ['Views, including dynamic views', 'GA. Defined with a supported subset of functions.'],
          [
            'Schemas',
            'GA. New tables in the schema become visible automatically; aliases and partitions are not available.',
          ],
          ['Volumes', 'GA.'],
          [
            'Materialized views and streaming tables',
            'GA. The object itself cannot have row filters; open recipients read the current snapshot only.',
          ],
          [
            'Metric views',
            'GA (September 2026). Query with MEASURE() on serverless compute. A metric view over tables with row filters, masks, or ABAC policies cannot be shared.',
          ],
          [
            'Notebooks, AI models, Python UDFs, and other types',
            'Listed as shareable in the documentation. Check the page for each type before you commit to it.',
          ],
        ],
      },
      links: [
        { label: 'Create shares', url: 'https://docs.databricks.com/aws/en/delta-sharing/create-share' },
        {
          label: 'Access shared data as a recipient',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/recipient',
        },
      ],
    },
    {
      id: 'hardening',
      heading: 'Harden open recipients',
      prose:
        'An open recipient holds a credential that works from anywhere until it expires. Reduce what that credential can do.',
      steps: [
        {
          title: 'Prefer OIDC federation',
          body: "The recipient's identity provider issues short-lived JWTs, enforces MFA, and controls their lifetime. Databricks validates the token against a federation policy you create and never issues a long-lived secret. Email-based activation is not available in this flow.",
        },
        {
          title: 'If you use bearer tokens, set a short lifetime',
          body: 'The token lifetime defaults to the metastore setting; lower it there or per recipient. Tokens issued before December 8, 2025 with no expiry, or an expiry after December 8, 2026, expire on December 8, 2026. Renew them on a schedule you control.',
        },
        {
          title: 'Add an IP access list',
          body: 'Allow lists only, up to 100 IPv4 addresses or CIDR ranges per recipient, independent of workspace IP access lists. It covers the REST API, the activation URL, and credential download. Without SecureConnect, storage URLs are reachable from any IP.',
        },
        {
          title: 'Send credentials over a secure channel',
          body: 'The activation link downloads the credential file once. Treat the file as a secret, and drop or rotate the recipient when the engagement ends.',
        },
      ],
      options: {
        caption: 'How an open recipient authenticates',
        rows: [
          {
            option: 'OIDC federation',
            when: 'The recipient\'s identity provider can issue JWTs and their client supports federation.',
            tradeoffs:
              'Tokens are short-lived and the identity provider enforces MFA and sets lifetimes. Databricks never issues a long-lived secret. The recipient needs an identity provider you can write a federation policy for, and email activation is not available.',
          },
          {
            option: 'Bearer token',
            when: 'The recipient has no OIDC provider, or the client only accepts a credential file.',
            tradeoffs:
              'Works with the widest set of clients and is simple to start. The credential is a secret that works from anywhere until it expires, so you set a short lifetime, renew it on a schedule, add an IP access list, and send it over a secure channel.',
          },
        ],
        recommendation:
          'Use OIDC federation whenever the recipient can support it. Use a bearer token only when it cannot, and pair it with a short lifetime and an IP access list.',
      },
      links: [
        {
          label: 'OIDC federation for recipients',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/create-recipient-oidc-fed',
        },
        {
          label: 'Bearer-token recipients and lifetime',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/create-recipient-token',
        },
        {
          label: 'IP access lists for recipients',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/access-list',
        },
        { label: 'Create a recipient', url: 'https://docs.databricks.com/aws/en/delta-sharing/create-recipient' },
      ],
    },
    {
      id: 'alternatives',
      heading: 'When Clean Rooms or Marketplace fit better',
      options: {
        caption: 'Which sharing mechanism fits the need',
        rows: [
          {
            option: 'A share and a recipient',
            when: 'Give a known recipient read access to live data.',
            tradeoffs:
              'No copy to keep in sync, and you audit access through system tables. The recipient reads the rows you expose, so share a view when it should see a subset. Cross-region and cross-cloud reads can incur egress charges.',
          },
          {
            option: 'Clean Rooms',
            when: 'Two or more parties compute on combined sensitive data without seeing each other\'s raw rows.',
            tradeoffs:
              'Strongest isolation, because only approved code runs, on serverless compute over OpenSharing. It takes more setup and approval than a plain share, and collaborators work inside what the clean room allows.',
          },
          {
            option: 'Marketplace',
            when: 'Publish a dataset or AI asset to many consumers, free or paid, with listings and terms.',
            tradeoffs:
              'Reach and a standard listing and terms process. You give up the one-to-one control of a named recipient, and a listing takes effort to prepare and maintain.',
          },
          {
            option: 'Replicate to their storage or account',
            when: 'The recipient needs its own writable copy or must be isolated from your storage.',
            tradeoffs:
              'The recipient is independent of your platform. You pay for storage, a copy pipeline, and egress, the copy lags the source, and you lose governance over the data once it leaves.',
          },
        ],
        recommendation:
          'Start with a share to a named recipient. Move to Clean Rooms when neither side may see the other\'s raw rows, to Marketplace when the audience is open, and replicate only when the recipient needs a writable or isolated copy.',
      },
      links: [
        { label: 'Clean Rooms', url: 'https://docs.databricks.com/aws/en/clean-rooms/' },
        { label: 'Marketplace', url: 'https://docs.databricks.com/aws/en/marketplace/' },
        { label: 'Create and manage shares', url: 'https://docs.databricks.com/aws/en/delta-sharing/create-share' },
        {
          label: 'Publish data in Marketplace',
          url: 'https://docs.databricks.com/aws/en/marketplace/get-started-provider',
        },
      ],
    },
    {
      id: 'egress',
      heading: 'Cross-region and cross-cloud egress',
      prose:
        'A share points at your data in place. The recipient reads it through pre-signed URLs or scoped credentials, so nothing is copied, and sharing within a region has no egress charge.',
      points: [
        {
          strong: 'Across regions or clouds.',
          text: 'Your cloud provider can bill data transfer when the recipient reads from another region or cloud. Large, frequently read tables multiply it.',
        },
        {
          strong: 'Ways to contain it.',
          text: "Share from Cloudflare R2, which has no egress fees. Replicate a table into the recipient's region once, and share the replica. Or have recipients read the data once and cache it.",
        },
        {
          strong: 'SecureConnect.',
          text: 'If the provider uses SecureConnect, Databricks bills the data transfer instead of the cloud vendor, and the recipient IP access list also applies to storage.',
        },
        {
          strong: 'Views, materialized views, and streaming tables.',
          text: 'Databricks materializes these for sharing. Events appear in system.sharing.materialization_history.',
        },
      ],
    },
    {
      id: 'audit',
      heading: 'Audit sharing with system tables',
      prose:
        'Provider audit logs record what you do and what recipients do with your shares. They live in system.access.audit once an account admin enables the audit system table.',
      examples: [
        {
          label: 'Recent sharing activity for one share',
          language: 'sql',
          code: `SELECT event_time, action_name, user_identity.email AS actor,
       request_params, response.status_code
FROM system.access.audit
WHERE event_date >= current_date() - INTERVAL 7 DAYS
  AND service_name = 'unityCatalog'
  AND (action_name LIKE 'deltaSharing%' OR action_name IN ('createShare', 'updateShare', 'createRecipient'))
ORDER BY event_time DESC;`,
          notes: [
            'deltaSharingQueriedTable and deltaSharingQueriedTableChanges record recipient reads of tables shared by pre-signed URL.',
            'Event names and request_params vary by asset type; check the OpenSharing events list and filter on the share or recipient in request_params. Audit rows arrive after the event.',
          ],
        },
      ],
      links: [
        { label: 'Audit and monitor data sharing', url: 'https://docs.databricks.com/aws/en/delta-sharing/audit-logs' },
      ],
    },
  ],
  related: [
    { slug: 'access-management', title: 'Access management' },
    { slug: 'row-column-security', title: 'Row and column security' },
    { slug: 'platform-administration', title: 'Workspace and account administration' },
  ],
};
