import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Do I need four workspaces?',
    answer:
      'No. Prod always gets its own workspace, but small teams can merge dev and test. Databricks suggests two workspaces (dev and prod) up to about five engineers and three (dev, staging, prod) beyond that. Run integration tests in the dev workspace in their own schema so they never touch a personal sandbox.',
    links: [
      {
        label: 'Developer best practices: isolate workspace environments',
        url: 'https://docs.databricks.com/aws/en/developers/best-practices',
      },
    ],
  },
  {
    question: 'Do I need a separate metastore per environment?',
    answer:
      'No. An account gets only one metastore per region, so every workspace in the region attaches to the same one. Separation comes from catalogs, bindings, and identities. Use separate regions or accounts only for data-sovereignty or regulatory needs that catalog-level isolation cannot meet.',
  },
  {
    question: 'Why is one catalog with environment schemas the weak option?',
    answer:
      'A workspace binding attaches to a whole catalog, so dev can see the prod schema in Catalog Explorer and only schema grants stand in the way. Managed tables from all environments also share one managed location. It can work for a small team, but move to a catalog per environment before the first sensitive dataset lands.',
  },
  {
    question: 'Why does my catalog binding have no effect?',
    answer:
      'Bindings are only consulted once the catalog is ISOLATED, and catalogs created from SQL or the API start OPEN. Run catalogs update with --isolation-mode ISOLATED, then workspace-bindings update-bindings. Storage credentials and external locations take bindings too.',
    links: [
      {
        label: 'Workspace-catalog binding',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/access-control/workspace-catalog-binding',
      },
    ],
  },
  {
    question: 'How do lower environments get realistic data?',
    answer:
      'Code moves between environments and data does not, so generate data in dev and test. Add a masked copy built inside prod, or an OpenSharing share of one approved dataset, in stage only when tests need real shapes. Do not copy prod tables down.',
  },
  {
    question: 'How do I see what each environment costs?',
    answer:
      'Tag every resource with its environment and release. presets.tags on each bundle target label jobs and pipelines, and a serverless usage policy per environment (Public Preview) labels serverless spend. Both appear in system.billing.usage as custom_tags. A governed tag can reject names its policy does not allow. In the reference workspace the environment tag allowed only dev, staging, prod, and demo, so test and stage were refused.',
    links: [
      { label: 'Serverless usage policies', url: 'https://docs.databricks.com/aws/en/admin/usage/budget-policies' },
    ],
  },
];
