import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'data-sharing',
  area: 'Governance/Monitoring',
  title: 'Governed data sharing',
  intro:
    'A job shares a view and a table with a token recipient, reads them with the open-source delta-sharing client, revokes the grant, and checks that the next read fails. The data is shared in place, so the recipient gets no copy. The workspace used for the reference run did not allow the job identity to create shares, so the run records that and shows what needs granting.',
  shortVersion: [
    {
      title: 'The view is the governance.',
      body: 'orders_west_v keeps one region (1,531 of 5,000 orders) and leaves out customer_email. The share exposes the view, not the sharing_orders table.',
    },
    {
      title: 'The recipient needs only a credential file.',
      body: 'A token recipient exchanges a one-time link for a bearer token. The delta-sharing client reads with that file and nothing else.',
    },
    {
      title: 'Revoking is one statement.',
      body: 'REVOKE SELECT ON SHARE removes the entitlement. The job retries the read until it fails, then drops the recipient.',
    },
    {
      title: 'No replication.',
      body: 'The client gets pre-signed URLs to the provider’s own files. The job checks those URLs sit under the source table path.',
    },
    {
      title: 'Audit events are copied to a table.',
      body: 'sharing_audit_events holds the Unity Catalog audit events for the share and recipient names.',
    },
  ],
  sections: [
    {
      id: 'lifecycle',
      heading: 'The share lifecycle',
      prose:
        'Three tasks run in order. The first builds the governed objects, the second runs the whole share, read, and revoke sequence, and the third collects audit events after they land in system.access.audit.',
      diagram: {
        type: 'flow',
        title: 'From governed view to revoked access',
        description:
          'The prepare_data task creates the sharing_orders and sharing_products tables and the orders_west_v view. The share_and_read task creates a share and a token recipient, grants SELECT, exchanges the activation link for a credential file, reads the view and the table with the delta-sharing client, revokes the grant, confirms the read fails, and drops the recipient. Results go to sharing_audit. The collect_audit_events task copies audit events to sharing_audit_events.',
        lanes: [
          { label: 'Provider objects', fromRow: 0, toRow: 0 },
          { label: 'Sharing lifecycle', fromRow: 1, toRow: 1 },
          { label: 'Recorded evidence', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          { id: 'orders', label: 'sharing_orders', mono: true, sub: '5,000 rows, comments', col: 0, row: 0, kind: 'store' },
          { id: 'view', label: 'orders_west_v', mono: true, sub: 'West only, no email', col: 1, row: 0, kind: 'highlight' },
          { id: 'products', label: 'sharing_products', mono: true, sub: '3 rows', col: 2, row: 0, kind: 'store' },
          { id: 'share', label: 'Share + recipient', sub: 'token, open sharing', col: 0, row: 1 },
          { id: 'grant', label: 'GRANT SELECT', sub: 'on the share', col: 1, row: 1 },
          { id: 'read', label: 'delta-sharing read', sub: 'credential file only', col: 2, row: 1 },
          { id: 'revoke', label: 'REVOKE, read again', sub: 'must fail', col: 3, row: 1, kind: 'gate' },
          { id: 'audit', label: 'sharing_audit', mono: true, sub: 'one row per check', col: 1, row: 2, kind: 'store' },
          { id: 'events', label: 'sharing_audit_events', mono: true, sub: 'system.access.audit', col: 3, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'orders', to: 'view' },
          { from: 'view', to: 'share' },
          { from: 'products', to: 'share' },
          { from: 'share', to: 'grant' },
          { from: 'grant', to: 'read' },
          { from: 'read', to: 'revoke' },
          { from: 'read', to: 'audit' },
          { from: 'revoke', to: 'events', label: 'audit events' },
        ],
        legend: [
          { kind: 'highlight', label: 'Restricts rows and columns' },
          { kind: 'gate', label: 'Access check' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
      },
    },
    {
      id: 'visibility',
      heading: 'What the recipient can see',
      prose:
        'The share lists the view and the sharing_products table under a neutral schema name, so the recipient never sees the provider schema. The sharing_orders table and the customer_email column are not in the share.',
      diagram: {
        type: 'matrix',
        title: 'Provider objects and what reaches the recipient',
        description:
          'sharing_orders has 5,000 rows and is visible to the provider only. orders_west_v has 1,531 rows without customer_email and is visible to the recipient. sharing_products has 3 rows and is visible to both. Column customer_email is provider only.',
        corner: 'Object ↓ · Who →',
        columns: ['Provider', 'Recipient'],
        rows: [
          {
            label: 'sharing_orders',
            sub: 'all regions, all columns',
            cells: [
              { state: 'own', text: '5,000 rows' },
              { state: 'none', text: 'not shared' },
            ],
          },
          {
            label: 'orders_west_v',
            sub: 'West, six columns',
            cells: [
              { state: 'own', text: '1,531 rows' },
              { state: 'own', text: '1,531 rows' },
            ],
          },
          {
            label: 'customer_email',
            sub: 'personal data column',
            cells: [
              { state: 'own', text: 'in sharing_orders' },
              { state: 'none', text: 'never shared' },
            ],
          },
          {
            label: 'sharing_products',
            sub: 'list prices',
            cells: [
              { state: 'own', text: '3 rows' },
              { state: 'own', text: '3 rows' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Visible' },
          { state: 'none', label: 'Not visible' },
        ],
        caption: 'Delta Sharing does not share tables that have row filters or column masks, so the view carries the restriction.',
      },
    },
    {
      id: 'replication',
      heading: 'Does the recipient need a copy?',
      prose:
        'No. Delta Sharing returns short-lived pre-signed URLs for the provider’s data files, and the client reads them directly. The job records the decision in sharing_audit as replication_required = false, after checking that every URL sits under the source table’s own storage path.',
      steps: [
        {
          title: 'Ask for the files',
          body: 'POST to the share endpoint’s query path for the sharing_products table with the bearer token.',
        },
        {
          title: 'Compare paths',
          body: 'served_from_source compares each URL path with the location from DESCRIBE DETAIL. One mismatch fails the check.',
          code: 'in_place = served_from_source(location, file_urls(response.text))',
        },
        {
          title: 'Store the result without secrets',
          body: 'The job keeps the URL path and drops the signed query string before writing it to the table.',
        },
      ],
    },
    {
      id: 'privileges',
      heading: 'What the metastore must allow',
      prose:
        'Creating a share and a recipient are metastore-level privileges. The workspace used for the reference run did not give them to the job identity, so the run records the gap instead of failing.',
      points: [
        {
          strong: 'Needed.',
          text: 'GRANT CREATE SHARE, CREATE RECIPIENT ON METASTORE to the identity that runs the job, from a metastore admin.',
        },
        {
          strong: 'Recorded.',
          text: 'share_and_read writes a BLOCKED row with that statement, and the denied createShare call (status 403) appears in sharing_audit_events.',
        },
        {
          strong: 'Cleanup.',
          text: 'With the privileges, the job drops the recipient at the end of each run, which invalidates the credential file. The share stays so its contents can be inspected.',
        },
      ],
    },
  ],
  related: [
    { slug: 'row-column-security', title: 'Row and column security' },
    { slug: 'access-management', title: 'Access management' },
  ],
};
