import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'ontology',
  area: 'AI Guides',
  title: 'Business terms and synonyms',
  intro:
    'Enterprise tables use codes such as seg_cd, rgn_cd, and ord_st. A person, a dashboard, or Genie can read them correctly only if the meaning is written down once, next to the data. There is no single ontology object to create in Unity Catalog. You build the governed semantic layer from comments, governed tags, metric views with synonyms, certification, and Genie Agent context, and you check it with benchmarks.',
  businessValue: {
    summary:
      'Data and analytics leaders need terms like revenue, segment, and active customer to mean the same thing for every person, dashboard, and AI agent. This guide builds that shared meaning in Unity Catalog next to the data.',
    outcomes: [
      {
        title: 'One definition of each metric',
        body:
          'A metric view holds the definition of revenue once. Dashboards, SQL users, and Genie all use it, so two teams stop reporting different totals for the same question.',
      },
      {
        title: 'Cryptic codes made readable',
        body:
          'Table and column comments, plus metric view synonyms, map seg_cd and similar codes to business terms. People and Genie can ask for sales or turnover and reach the same measure.',
      },
      {
        title: 'Trusted assets are visible',
        body:
          'The system.certification_status tag marks assets as certified or deprecated, so people and Genie One prefer the ones the data owner vouches for.',
      },
      {
        title: 'Changes are tested',
        body:
          'Genie benchmarks score the expected SQL for real questions before and after a change to the semantics. A definition edit that breaks answers shows up before users find it.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Define each term once, next to the data.',
      body: 'Revenue means completed orders. Segment codes map to names. Put those definitions in a metric view and in table and column comments, not in every dashboard or Genie Agent.',
    },
    {
      title: 'Metric views carry synonyms.',
      body: 'Agent metadata in a metric view adds display names, formats, and synonyms. Revenue can answer to sales or turnover, and Customer Segment to tier.',
    },
    {
      title: 'Govern tags with tag policies.',
      body: 'Governed tags are account-level tags with a policy for allowed keys, values, and who can assign them. Use them for domain, sensitivity, and business-term labels that stay consistent.',
    },
    {
      title: 'Generate comments, then review them.',
      body: 'AI-generated comments give you a first draft of table and column descriptions. An owner confirms them before Genie or users rely on them.',
    },
    {
      title: 'Certify what you vouch for.',
      body: 'The system.certification_status tag marks assets certified or deprecated, so people and Genie One prefer the trusted ones.',
    },
    {
      title: 'Prove it with benchmarks.',
      body: 'Write the expected SQL for the questions people ask and score the Genie Agent before and after each change to the semantics.',
    },
  ],
  sections: [
    {
      id: 'layers',
      heading: 'Where each term is defined',
      prose:
        'Each piece of meaning has one home. Genie reads all of them, and so do SQL users and dashboards that query the same objects.',
      diagram: {
        type: 'flow',
        title: 'Business term to Genie answer',
        description:
          'Table and column comments, governed tags, and certification describe the raw tables in Unity Catalog. A metric view defines measures, dimensions, and synonyms on top of them. The Genie Agent adds instructions, sample questions, and example queries. A user question is answered with MEASURE queries against the metric view.',
        nodes: [
          { id: 'raw', label: 'Tables and columns', sub: 'comments, tags, certified', col: 0, row: 0, kind: 'store' },
          { id: 'view', label: 'Metric view', sub: 'measures, synonyms', col: 1, row: 0, kind: 'highlight' },
          { id: 'space', label: 'Genie Agent', sub: 'glossary, samples', col: 2, row: 0, kind: 'surface' },
          { id: 'ask', label: 'User question', sub: 'uses business words', col: 3, row: 0 },
          { id: 'sql', label: 'MEASURE() query', sub: 'names, not codes', col: 3, row: 1 },
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
          ['Active Customers', 'Distinct customers with a completed order. Synonyms: active accounts, buying customers'],
          ['Average Order Value', 'Revenue / completed orders. Synonyms: AOV, average order size, basket size'],
          ['Customer Segment', 'E, M, S mapped to Enterprise, Mid-Market, SMB. Synonyms: tier, account type'],
          ['Region', 'NA, EM, AP mapped to North America, EMEA, APAC. Synonyms: territory, geo'],
        ],
      },
    },
    {
      id: 'metrics',
      heading: 'Metric views with synonyms',
      prose:
        'A metric view is the governed semantic layer: a Unity Catalog object that defines measures and dimensions in YAML once, for AI/BI dashboards, Genie, notebooks, and SQL. Agent metadata (YAML version 1.1) adds display names, formats, and synonyms to each measure and dimension.',
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
          strong: 'Add the words people actually use.',
          text: 'List synonyms from real questions and support tickets, not guesses. A synonym such as turnover for revenue lets Genie match a word that appears in no column name.',
        },
        {
          strong: 'Pre-join in the view.',
          text: 'A metric view over a fact table and its dimensions gives Genie one object to query and keeps an agent within its limit of 50 tables and views.',
        },
      ],
      options: {
        caption: 'Where to define a business term',
        rows: [
          {
            option: 'Metric view measure or dimension',
            when:
              'A calculation, a filter such as completed orders, or a code-to-name mapping that several consumers need.',
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
            option: 'Genie Agent instructions and SQL expressions',
            when: 'A rule belongs to one agent, such as tone or when to ask a clarifying question.',
            tradeoffs:
              'Fast to change and scoped to that agent. Dashboards and other agents do not see it, and example SQL can drift away from the official definition.',
          },
        ],
        recommendation:
          'Put shared measures and dimensions in a metric view, describe raw columns with comments and tags, and keep agent instructions for rules that belong to one agent.',
      },
      links: [
        {
          label: 'Metric views',
          url: 'https://docs.databricks.com/aws/en/metric-views/',
        },
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
      heading: 'Governed tags, comments, and certification',
      prose:
        'Metadata that people can edit freely drifts. Govern the vocabulary, draft descriptions with AI, and mark the assets you trust.',
      steps: [
        {
          title: 'Create governed tags with tag policies',
          body: 'A governed tag is an account-level tag whose policy fixes the allowed values and who may assign it. Create tags such as domain, sensitivity, and business_term, then apply them to tables, columns, dashboards, and Genie Agents. Do not put secrets in tag names or values: tag data is stored as plain text.',
        },
        {
          title: 'Draft comments with AI, then review',
          body: 'Unity Catalog can generate table and column comments from the schema and data. Use them as a draft. Genie relies on column descriptions, so a wrong one produces wrong SQL. Edit or reject any that do not match what you would write by hand.',
        },
        {
          title: 'Certify the assets you vouch for',
          body: 'Apply the system.certification_status tag with the value certified to the tables, metric views, and dashboards that meet your standard, and deprecated to the ones to avoid. It requires ASSIGN on the tag. Certified assets show a check mark and help Genie One prioritize trusted data.',
        },
      ],
      links: [
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
      heading: 'Check interpretation with Genie benchmarks',
      prose:
        'Benchmarks turn "does it understand our terms" into a score. Each benchmark is a business question plus the SQL that returns the right answer. Genie runs the question as a new conversation and compares its result with yours.',
      points: [
        {
          strong: 'Cover the vocabulary.',
          text: 'Include a question for each synonym and each coded dimension. A question that uses turnover, tier, or territory tests the semantics, not just the SQL.',
        },
        {
          strong: 'Add two to four phrasings of each question.',
          text: 'Users ask the same thing in different words. All phrasings share one gold query.',
        },
        {
          strong: 'Score before and after each change.',
          text: 'Run the set before you add a synonym, a comment, or an instruction, and again after. Keep the change when the score rises, and revert when it falls.',
        },
        {
          strong: 'Compare result rows, not text.',
          text: 'A code such as NA is not the same answer as North America. Matching on values catches answers that are technically correct but unreadable.',
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
        'The reference example asks a Genie Agent five questions over raw coded tables, then over a metric view with comments and synonyms. The five questions are a small illustration of the mechanism on generated data. They are not a measured accuracy figure, and your results depend on your data and questions.',
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
              { state: 'none', text: 'Codes S, M, E', sub: 'counts all orders' },
              { state: 'own', text: 'Matches', sub: 'completed orders, names' },
            ],
          },
          {
            label: 'Active customers by region',
            cells: [
              { state: 'none', text: 'Codes AP, EM, NA', sub: 'counts right, labels wrong' },
              { state: 'own', text: 'Matches', sub: 'region names' },
            ],
          },
          {
            label: 'Enterprise order value',
            cells: [
              { state: 'none', text: 'Average over all orders', sub: 'includes cancelled' },
              { state: 'own', text: 'Matches', sub: 'AOV measure' },
            ],
          },
          {
            label: 'Top region in a month',
            cells: [
              { state: 'none', text: 'Region code', sub: 'includes cancelled orders' },
              { state: 'own', text: 'Region name', sub: 'completed orders only' },
            ],
          },
          {
            label: 'Cancellations by channel',
            cells: [
              { state: 'none', text: 'Codes W, S, P', sub: 'counts right, labels wrong' },
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
    { slug: 'user-experience', title: 'Assistant user experience' },
    { slug: 'genie-agents', title: 'Genie Agents: setup, instructions, and data handling' },
    { slug: 'documentation-generation', title: 'Automated data documentation' },
  ],
};
