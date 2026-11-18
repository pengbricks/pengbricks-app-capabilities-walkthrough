import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'domains-subdomains',
  area: 'AI Guides',
  title: 'Databricks Domains and Subdomains',
  intro:
    'Domains and subdomains organize data and AI assets by business purpose on the Discover page. Curators can nest the hierarchy up to five levels deep, delegate responsibility for a branch, and give consumers a business-facing path to trusted assets without changing the underlying catalog structure.',
  businessValue: {
    summary:
      'A domain tree turns a technical catalog into a business map, so consumers know where to look and each branch has a clear stewardship boundary.',
    outcomes: [
      {
        title: 'Faster discovery',
        body: 'People browse Customer, Product, Finance, or another business area instead of guessing which catalog and schema contain the right asset.',
      },
      {
        title: 'Clear ownership',
        body: 'Each branch has a curator group that can maintain its descendants without receiving account-wide control.',
      },
      {
        title: 'Focused AI context',
        body: 'Pages, metric views, dashboards, and Genie Agents sit in the business area whose questions they answer.',
      },
      {
        title: 'Stable navigation',
        body: 'A shallow hierarchy based on durable business boundaries survives project, platform, and organization changes.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Model the business, not the storage layout.',
      body: 'Use stable areas such as Customer, Product, Sales, and Finance. Do not mirror catalogs, schemas, medallion layers, or temporary projects.',
    },
    {
      title: 'Keep the tree shallow.',
      body: 'Databricks supports one domain plus four subdomain levels. Add a level only when it changes ownership, audience, or navigation.',
    },
    {
      title: 'Delegate by branch.',
      body: 'Use MANAGE DISCOVER for account-wide curators and MANAGE DOMAIN for the group responsible for one domain or subdomain and its descendants.',
    },
    {
      title: 'Assign assets deliberately.',
      body: 'Assets can belong to multiple domains. Direct membership controls where they appear and how domain counts are reported.',
    },
    {
      title: 'Publish from the leaves upward.',
      body: 'Publish a new subdomain, then republish its parent so the child appears in the consumer-facing Discover tree.',
    },
  ],
  sections: [
    {
      id: 'hierarchy',
      heading: 'Design a business-facing hierarchy',
      prose:
        'A useful hierarchy follows how people ask questions and who can resolve disputes. Start with a few stable top-level areas, then add subdomains only where a branch needs a distinct owner or audience.',
      diagram: {
        type: 'flow',
        title: 'A shallow domain tree',
        description:
          'A Customer domain contains Analytics and Operations subdomains. The Analytics branch groups a Page, metric view, dashboard, and Genie Agent used to answer customer-performance questions.',
        nodes: [
          {
            id: 'customer',
            label: 'Customer',
            sub: 'top-level domain',
            col: 0,
            row: 0,
            kind: 'highlight',
            domain: 'governance',
            icon: 'users',
            detail: 'A durable business entity with a sponsor and a curator group responsible for the full branch.',
          },
          {
            id: 'analytics',
            label: 'Customer Analytics',
            sub: 'subdomain',
            col: 1,
            row: 0,
            kind: 'surface',
            domain: 'governance',
            icon: 'dashboard',
            detail: 'A separate branch because analytical assets, consumers, and stewards differ from operational workflows.',
          },
          {
            id: 'operations',
            label: 'Customer Operations',
            sub: 'subdomain',
            col: 1,
            row: 1,
            kind: 'box',
            domain: 'governance',
            icon: 'workflow',
            detail: 'An operational branch for service, lifecycle, and execution assets with its own audience and owners.',
          },
          {
            id: 'page',
            label: 'Active customer',
            sub: 'Page',
            col: 2,
            row: 0,
            kind: 'highlight',
            domain: 'governance',
            icon: 'list',
            detail: 'The authoritative definition of Active Customer within the Customer Analytics branch.',
          },
          {
            id: 'assets',
            label: 'Trusted assets',
            sub: 'metrics, dashboards, agent',
            col: 3,
            row: 0,
            kind: 'store',
            domain: 'data',
            icon: 'data-search',
            detail: 'The metric views, dashboards, tables, and agent that implement the concept and answer consumer questions.',
          },
        ],
        edges: [
          { from: 'customer', to: 'analytics' },
          { from: 'customer', to: 'operations' },
          { from: 'analytics', to: 'page' },
          { from: 'page', to: 'assets' },
        ],
        legend: [
          { kind: 'highlight', label: 'Governed business concept' },
          { kind: 'surface', label: 'Consumer-facing branch' },
          { kind: 'store', label: 'Related implementation assets' },
        ],
      },
      table: {
        caption: 'Good and weak hierarchy boundaries',
        columns: ['Prefer', 'Avoid'],
        rows: [
          ['Customer, Product, Finance, Supply Chain', 'Bronze, Silver, Gold'],
          ['Stable business capability', 'Quarterly initiative or migration project'],
          ['Distinct owner and consumer audience', 'A subdomain for every catalog or schema'],
          ['Names business users recognize', 'Internal platform abbreviations'],
        ],
      },
    },
    {
      id: 'permissions',
      heading: 'Delegate curation at the narrowest useful scope',
      prose:
        'Domain permissions inherit down the branch. Give account-wide authority to a small platform group and delegate each business branch to the steward group that can make decisions about it.',
      table: {
        caption: 'Domain management permissions',
        columns: ['Permission', 'Scope'],
        rows: [
          ['MANAGE DISCOVER', 'All domains, subdomains, and Pages. Use for the central governance team.'],
          ['MANAGE DOMAIN on a domain', 'That domain, every descendant, and their Pages. Use for a top-level business curator group.'],
          ['MANAGE DOMAIN on a subdomain', 'That subdomain, its descendants, and their Pages. Use for delegated branch ownership.'],
          ['MANAGE PAGES', 'Page publication and maintenance without permission to redesign the domain tree.'],
        ],
      },
      points: [
        {
          strong: 'Grant groups, not individuals.',
          text: 'Use curator and publisher groups so ownership survives role changes and access reviews remain understandable.',
        },
        {
          strong: 'Separate taxonomy from publication.',
          text: 'A central curator can own top-level naming while a domain group publishes its Pages and maintains its direct memberships.',
        },
        {
          strong: 'Document the decision boundary.',
          text: 'Record which group can rename, move, publish, certify, deprecate, or delete objects in each branch.',
        },
      ],
    },
    {
      id: 'membership',
      heading: 'Treat membership and publication as governed changes',
      prose:
        'Assets can belong to more than one domain, but each membership should serve a real discovery path. Direct membership, inherited tags, publication, and deletion have different effects.',
      steps: [
        {
          title: 'Inventory the questions and assets',
          body: 'Start with the questions consumers ask and the certified assets that answer them. Build the smallest branch that makes those assets easier to find.',
        },
        {
          title: 'Assign direct membership',
          body: 'Add an asset to each domain where consumers should find it. A child membership does not automatically add every ancestor membership.',
        },
        {
          title: 'Check inherited assignment',
          body: 'When domain tagging is applied to a catalog or schema, contained assets can inherit it. Confirm the effect before using a broad container as the assignment point.',
        },
        {
          title: 'Publish the branch',
          body: 'Publish child subdomains before their parent and confirm the cards, counts, descriptions, Pages, and related assets in the consumer view.',
        },
        {
          title: 'Review before deletion',
          body: 'Deleting a domain also removes its descendant subdomains. Rehome or deprecate dependent content before changing the tree.',
        },
      ],
      links: [
        { label: 'Domains and subdomains', url: 'https://docs.databricks.com/aws/en/uc-semantics/domains' },
        { label: 'Discover page', url: 'https://docs.databricks.com/aws/en/discover/discover-page' },
      ],
    },
    {
      id: 'checklist',
      heading: 'Review the tree before scaling it',
      points: [
        {
          strong: 'A consumer can predict where an asset belongs.',
          text: 'Test the hierarchy with people who did not design it. If they cannot place common assets consistently, simplify or rename the branches.',
        },
        {
          strong: 'Every branch has an accountable group.',
          text: 'Do not publish an orphaned domain. Name the curator group, its review cadence, and its escalation path.',
        },
        {
          strong: 'Depth earns its maintenance cost.',
          text: 'Each extra level should improve navigation or delegation. Collapse branches that only restate the parent.',
        },
        {
          strong: 'Metadata contains no sensitive text.',
          text: 'Keep PII, secrets, customer records, and regulated data out of domain names, descriptions, and tags.',
        },
      ],
    },
  ],
  related: [
    { slug: 'pages', title: 'Databricks Pages' },
    { slug: 'ontology', title: 'Databricks Ontology best practices' },
    { slug: 'unity-catalog-edm', title: 'Unity Catalog with an enterprise data management program' },
  ],
};
