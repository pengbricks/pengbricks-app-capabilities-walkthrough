import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'ontology',
  area: 'AI Guides',
  title: 'Databricks Ontology best practices',
  intro:
    'Genie Ontology is the governed context layer that helps Genie One, Genie Code, and other agents understand how your organization talks about its data. This guide focuses on the operating model: combine modeled and learned knowledge, put each kind of meaning in the right object, certify the sources that matter, and test real questions before scaling. Use the separate Domains and Subdomains and Pages guides for detailed implementation patterns.',
  businessValue: {
    summary:
      'A governed ontology gives people and agents the same map of the business: where to look, what a term means, how a KPI is calculated, and which source the organization trusts.',
    outcomes: [
      {
        title: 'Faster business discovery',
        body: 'Consumers browse assets by business purpose instead of guessing which catalog, schema, or table name belongs to their question.',
      },
      {
        title: 'Consistent definitions',
        body: 'Pages define terms such as customer and churn, while metric views define the calculations behind revenue and other KPIs.',
      },
      {
        title: 'More trustworthy answers',
        body: 'Genie gives modeled knowledge priority over conflicting learned context and cites Pages so users can inspect the source.',
      },
      {
        title: 'Delegated stewardship',
        body: 'Domain owners manage their branch, Page publishers maintain definitions, and curators certify the sources the organization vouches for.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Model the head; let Genie learn the tail.',
      body: 'Explicitly model business-critical concepts and KPIs. Genie can learn lower-risk context from governed dashboards, queries, metric views, and Genie Agents.',
    },
    {
      title: 'Organize around the business.',
      body: 'Create domains for stable business areas such as Customer, Product, Sales, or Finance. Add subdomains only when they make discovery or ownership clearer.',
    },
    {
      title: 'Use Pages for meaning.',
      body: 'A Page is the authoritative definition of a term, entity, or acronym. Give it an owner, synonyms, sources, and related assets, then publish and certify it.',
    },
    {
      title: 'Use metric views for calculations.',
      body: 'A Page explains revenue in words. A metric view implements revenue as a governed calculation that SQL, dashboards, and agents can query.',
    },
    {
      title: 'Separate owner, publisher, and curator duties.',
      body: 'The owner is accountable for the concept, MANAGE PAGES controls publication, and domain curators certify or deprecate Pages and assets.',
    },
    {
      title: 'Test the questions that matter.',
      body: 'Use known-good SQL and representative business questions to check whether ontology changes improve answers before you expand to another domain.',
    },
  ],
  prerequisites: [
    {
      slug: 'domains-subdomains',
      title: 'Databricks Domains and Subdomains',
      why: 'The ontology needs a business-aligned organization and stewardship boundary.',
    },
    {
      slug: 'pages',
      title: 'Databricks Pages',
      why: 'The ontology uses Pages as authoritative definitions of business concepts.',
    },
  ],
  sections: [
    {
      id: 'layers',
      heading: 'How modeled knowledge reaches an answer',
      prose:
        'Genie Ontology combines modeled knowledge that people govern with learned knowledge extracted from governed assets and usage. When they conflict, modeled knowledge takes precedence. The reference flow below shows the metric and agent layers; domains, Pages, and certification add navigation, definitions, and trust around them.',
      diagram: {
        type: 'flow',
        title: 'Business term to Genie answer',
        description:
          'Table and column comments, governed tags, and certification describe the raw tables in Unity Catalog. A metric view defines measures, dimensions, and synonyms on top of them. The Genie Agent adds instructions, sample questions, and example queries. A user question is answered with MEASURE queries against the metric view.',
        nodes: [
          {
            id: 'raw',
            label: 'Tables and columns',
            sub: 'comments, tags, certified',
            col: 0,
            row: 0,
            kind: 'store',
            domain: 'governance',
            icon: 'database',
            detail:
              'Raw tables in Unity Catalog described by comments, governed tags, and certification. Meaning is written next to the data.',
          },
          {
            id: 'view',
            label: 'Metric view',
            sub: 'measures, synonyms',
            col: 1,
            row: 0,
            kind: 'highlight',
            domain: 'governance',
            icon: 'data-model',
            detail:
              'The governed semantic layer. It defines measures, dimensions, and synonyms once for dashboards, Genie, notebooks, and SQL.',
          },
          {
            id: 'space',
            label: 'Genie Agent',
            sub: 'glossary, samples',
            col: 2,
            row: 0,
            kind: 'surface',
            domain: 'apps',
            icon: 'gear-maroon',
            detail:
              'Adds instructions, sample questions, and example queries on top of the metric view, so Genie matches business words.',
          },
          {
            id: 'ask',
            label: 'User question',
            sub: 'uses business words',
            col: 3,
            row: 0,
            domain: 'neutral',
            icon: 'users',
            detail: 'A question in business words, such as turnover for revenue, which appears in no column name.',
          },
          {
            id: 'sql',
            label: 'MEASURE() query',
            sub: 'names, not codes',
            col: 3,
            row: 1,
            domain: 'apps',
            icon: 'warehouse',
            detail:
              'Genie answers with MEASURE() queries against the metric view, so results use names instead of codes.',
          },
        ],
        edges: [
          { from: 'raw', to: 'view' },
          { from: 'view', to: 'space' },
          { from: 'ask', to: 'space' },
          { from: 'space', to: 'sql' },
        ],
        legend: [
          { kind: 'highlight', label: 'Single definition of each term' },
          { kind: 'surface', label: 'Genie Agent' },
        ],
      },
      table: {
        caption: 'Terms a metric view defines (example)',
        columns: ['Term', 'Definition and synonyms'],
        rows: [
          ['Revenue', 'SUM(net_amt) for completed orders. Synonyms: sales, net sales, bookings, turnover, income'],
          [
            'Active Customers',
            'Distinct customers with a completed order. Synonyms: active accounts, buying customers',
          ],
          ['Average Order Value', 'Revenue / completed orders. Synonyms: AOV, average order size, basket size'],
          ['Customer Segment', 'E, M, S mapped to Enterprise, Mid-Market, SMB. Synonyms: tier, account type'],
          ['Region', 'NA, EM, AP mapped to North America, EMEA, APAC. Synonyms: territory, geo'],
        ],
      },
      links: [
        { label: 'Genie Ontology', url: 'https://docs.databricks.com/aws/en/genie/genie-ontology' },
        { label: 'Unity Catalog semantics', url: 'https://docs.databricks.com/aws/en/uc-semantics' },
      ],
    },
    {
      id: 'components',
      heading: 'Connect the ontology layers',
      prose:
        'Domains and Pages have their own implementation guides. In the ontology, they work with metric views, certification, curated Genie Agents, and learned knowledge to answer four different questions: where to look, what a concept means, how a KPI is calculated, and which source to trust.',
      table: {
        caption: 'Role of each ontology component',
        columns: ['Component', 'Role in the ontology'],
        rows: [
          ['Domain or subdomain', 'Organizes assets by business purpose and creates a boundary for delegated stewardship.'],
          ['Page', 'Defines a business term, entity, KPI, or acronym in words and links it to evidence and implementation assets.'],
          ['Metric view', 'Implements reusable calculations, dimensions, filters, display metadata, and synonyms.'],
          ['Certification', 'Marks Pages and assets the organization vouches for and deprecates sources consumers should avoid.'],
          ['Curated Genie Agent', 'Applies focused instructions, example SQL, and a tested question-answering experience to one domain.'],
          ['Learned knowledge', 'Adds context from governed assets and usage when no modeled definition needs to settle the answer.'],
        ],
      },
      points: [
        {
          strong: 'Model only what must be right.',
          text: 'Define business-critical concepts and KPIs explicitly. Let Genie learn lower-risk context from governed assets instead of modeling every possible term.',
        },
        {
          strong: 'Give each definition one home.',
          text: 'Link the layers rather than copying the same prose or calculation into Pages, metric views, dashboards, and agent instructions.',
        },
        {
          strong: 'Use authority signals deliberately.',
          text: 'Modeled knowledge, certified assets, and curated agents guide Genie when learned sources disagree.',
        },
      ],
      links: [
        { label: 'Genie Ontology', url: 'https://docs.databricks.com/aws/en/genie/genie-ontology' },
        { label: 'Unity Catalog semantics', url: 'https://docs.databricks.com/aws/en/uc-semantics' },
      ],
    },
    {
      id: 'metrics',
      heading: 'Put each kind of meaning in the right object',
      prose:
        'A good ontology does not copy the same definition into every surface. Give each piece of meaning one authoritative home and link the layers together. Metric views remain the queryable implementation for measures and dimensions.',
      points: [
        {
          strong: 'Put the business rule in the measure.',
          text: 'Define revenue with the filter that excludes cancelled orders. Every consumer then gets the same number, and Genie queries it with MEASURE() instead of re-deriving it.',
        },
        {
          strong: 'Map codes to names in dimensions.',
          text: 'A CASE expression turns E, M, S into Enterprise, Mid-Market, SMB once. Users see names, and a question about a tier finds the dimension.',
        },
        {
          strong: 'Add the words people use.',
          text: 'List synonyms from real questions and support tickets, not guesses. A synonym such as turnover for revenue lets Genie match a word that appears in no column name.',
        },
        {
          strong: 'Pre-join in the view.',
          text: 'A metric view over a fact table and its dimensions gives Genie one object to query and keeps an agent within its limit of 50 tables and views.',
        },
      ],
      options: {
        caption: 'Where each part of the ontology belongs',
        rows: [
          {
            option: 'Domain or subdomain',
            when: 'You need a business-aligned place to browse assets and a boundary for delegated stewardship.',
            tradeoffs:
              'Domains answer where to look. Keep the hierarchy stable and shallow; do not mirror every catalog, schema, org-chart level, or temporary project.',
          },
          {
            option: 'Metric view measure or dimension',
            when: 'A calculation, a filter such as completed orders, or a code-to-name mapping that several consumers need.',
            tradeoffs:
              'One governed definition serves dashboards, Genie, notebooks, and SQL, so the number matches everywhere. It is YAML that someone owns and versions, and you add synonyms yourself.',
          },
          {
            option: 'Table and column comments and tags',
            when: 'Describing what raw columns mean.',
            tradeoffs:
              'Cheap to write, and AI-generated comments give a first draft that you should review. A comment describes a column and cannot hold logic, so it does not guarantee the same calculation across consumers.',
          },
          {
            option: 'Page',
            when: 'A business term, entity, or acronym that needs one authoritative definition, owned by a domain.',
            tradeoffs:
              'A Page has an owner, synonyms, a description, a body, related assets, and sources, and it inherits access from its domain. Genie One prioritizes it over learned context and cites it. A Page holds no calculation, so keep the measure in a metric view and link to it.',
          },
          {
            option: 'Genie Agent instructions and SQL expressions',
            when: 'A rule belongs to one agent, such as tone or when to ask a clarifying question.',
            tradeoffs:
              'Fast to change and scoped to that agent. Dashboards and other agents do not see it, and example SQL can drift away from the official definition.',
          },
        ],
        recommendation:
          'Use domains for navigation and stewardship, Pages for business meaning, metric views for calculations, comments and tags for asset-specific context, and focused Genie Agents for the final user experience.',
      },
      links: [
        {
          label: 'Metric views',
          url: 'https://docs.databricks.com/aws/en/metric-views/',
        },
        { label: 'Pages', url: 'https://docs.databricks.com/aws/en/uc-semantics/pages' },
        {
          label: 'Agent metadata in metric views',
          url: 'https://docs.databricks.com/aws/en/metric-views/data-modeling/semantic-metadata',
          note: 'Display names, formats, and synonyms.',
        },
        {
          label: 'Curate an effective Genie Agent',
          url: 'https://docs.databricks.com/aws/en/genie-agents/best-practices',
        },
        { label: 'AI-generated comments', url: 'https://docs.databricks.com/aws/en/comments/ai-comments' },
      ],
    },
    {
      id: 'governance',
      heading: 'Use a clear stewardship model',
      prose:
        'Ownership, publishing, and certification are different jobs. Separate them so a Page has an accountable owner, a controlled publication path, and an independent trust signal.',
      steps: [
        {
          title: 'Delegate the domain branch',
          body: 'Use account-level MANAGE DISCOVER only for cross-domain administration. Grant MANAGE DOMAIN to the curator group responsible for one branch and its descendants.',
        },
        {
          title: 'Control who can publish Pages',
          body: 'MANAGE PAGES lets a group review, publish, and maintain Pages without full domain administration. Review default grants, assign a steward group, and keep the concept owner as the accountable business contact.',
        },
        {
          title: 'Certify the complete definition',
          body: 'Confirm that the Page, metric view, source assets, and owner agree before the domain curator certifies them. Deprecate stale sources instead of leaving conflicting definitions active.',
        },
        {
          title: 'Govern tags and comments as supporting metadata',
          body: 'Use tag policies for controlled classifications such as sensitivity and lifecycle. Review AI-generated comments before publication. Tags and comments describe assets; they do not replace a concept Page or KPI calculation.',
        },
        {
          title: 'Correct the source of learned knowledge',
          body: 'Learned snippets are not directly editable. Fix the dashboard, query, agent, wiki, or comment that produced bad context, or replace the concept with modeled knowledge.',
        },
      ],
      links: [
        {
          label: 'Domains and permissions',
          url: 'https://docs.databricks.com/aws/en/uc-semantics/domains',
        },
        {
          label: 'Pages and permissions',
          url: 'https://docs.databricks.com/aws/en/uc-semantics/pages',
        },
        {
          label: 'Governed tags',
          url: 'https://docs.databricks.com/aws/en/admin/governed-tags',
        },
        {
          label: 'Tag policies',
          url: 'https://docs.databricks.com/aws/en/admin/tag-policies',
        },
        {
          label: 'AI-generated comments',
          url: 'https://docs.databricks.com/aws/en/comments/ai-comments',
        },
        {
          label: 'Certify or deprecate data',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/certify-deprecate-data',
        },
      ],
    },
    {
      id: 'benchmarks',
      heading: 'Build one thin slice, test it, then expand',
      prose:
        'Start with one workflow, one domain, and one metric. A small end-to-end slice exposes unclear ownership and conflicting definitions before you build a large taxonomy. Benchmarks turn interpretation into a score.',
      points: [
        {
          strong: 'Cover the vocabulary.',
          text: 'Include a question for each synonym and each coded dimension. A question that uses turnover, tier, or territory tests the semantics, not just the SQL.',
        },
        {
          strong: 'Model one concept end to end.',
          text: 'Create the domain branch, Page, metric view, certified assets, and focused Genie Agent for one high-value workflow before adding the next branch.',
        },
        {
          strong: 'Score before and after each change.',
          text: 'Run the set before you add a synonym, a comment, or an instruction, and again after. Keep the change when the score rises, and revert when it falls.',
        },
        {
          strong: 'Compare result rows, not text.',
          text: 'A code such as NA is not the same answer as North America. Matching on values catches answers that are technically correct but unreadable.',
        },
        {
          strong: 'Inspect the cited source.',
          text: 'Open the Genie Ontology citations and verify the Page, asset, author, domains, and lineage that supported the answer.',
        },
      ],
      links: [
        {
          label: 'Test and monitor a Genie Agent',
          url: 'https://docs.databricks.com/aws/en/genie/benchmarks',
          note: 'Benchmarks and response feedback.',
        },
      ],
    },
    {
      id: 'answers',
      heading: 'Illustration: the same questions, before and after',
      prose:
        'The reference bundle tests the metric-view layer of the ontology. It asks five questions over raw coded tables, then repeats them over a metric view with comments, tags, synonyms, instructions, and example SQL. The run does not create domains or Pages; govern those through Discover or the Pages REST API.',
      diagram: {
        type: 'matrix',
        title: 'What each setup answered (illustrative)',
        description:
          'Over raw tables the agent returned codes such as S, M, E, NA, or W, and counted cancelled and returned orders in revenue for some questions. Over the metric view it returned business names and matched the expected rows.',
        corner: 'Question ↓ · Setup →',
        columns: ['Raw tables', 'With semantics'],
        rows: [
          {
            label: 'Revenue by segment',
            cells: [
              {
                state: 'none',
                text: 'Codes S, M, E',
                sub: 'counts all orders',
                detail:
                  'Over raw tables the agent returned codes S, M, E and counted cancelled and returned orders in revenue.',
              },
              { state: 'own', text: 'Matches', sub: 'completed orders, names' },
            ],
          },
          {
            label: 'Active customers by region',
            cells: [
              {
                state: 'none',
                text: 'Codes AP, EM, NA',
                sub: 'counts right, labels wrong',
                detail:
                  'Over raw tables the agent counted customers correctly but labeled regions with codes AP, EM, NA.',
              },
              { state: 'own', text: 'Matches', sub: 'region names' },
            ],
          },
          {
            label: 'Enterprise order value',
            cells: [
              {
                state: 'none',
                text: 'Average over all orders',
                sub: 'includes cancelled',
                detail:
                  "Over raw tables the average included cancelled orders. The metric view's AOV measure matched the expected rows.",
              },
              { state: 'own', text: 'Matches', sub: 'AOV measure' },
            ],
          },
          {
            label: 'Top region in a month',
            cells: [
              {
                state: 'none',
                text: 'Region code',
                sub: 'includes cancelled orders',
                detail: 'Over raw tables the answer was a region code and included cancelled orders.',
              },
              { state: 'own', text: 'Region name', sub: 'completed orders only' },
            ],
          },
          {
            label: 'Cancellations by channel',
            cells: [
              {
                state: 'none',
                text: 'Codes W, S, P',
                sub: 'counts right, labels wrong',
                detail:
                  'Over raw tables the agent counted cancellations correctly but labeled channels with codes W, S, P.',
              },
              { state: 'own', text: 'Matches', sub: 'channel names' },
            ],
          },
        ],
        legend: [
          { state: 'none', label: 'Does not match expected rows' },
          { state: 'own', label: 'Matches expected rows' },
        ],
        caption: 'Illustrative, on generated data. Score your own agent with benchmarks on your own questions.',
      },
    },
  ],
  related: [
    { slug: 'domains-subdomains', title: 'Databricks Domains and Subdomains' },
    { slug: 'pages', title: 'Databricks Pages' },
    { slug: 'unity-catalog-edm', title: 'Unity Catalog with an enterprise data management program' },
  ],
};
