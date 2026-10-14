import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'ontology',
  area: 'AI Guides',
  title: 'Business terms and synonyms',
  intro:
    'The sample sales tables use codes: seg_cd, rgn_cd, ord_st, net_amt. A Genie space over the raw tables answered five business questions with codes and counted cancelled orders as revenue. The job then defined the business terms once, as comments, tags, and a Unity Catalog metric view with synonyms, and asked a second space the same five questions.',
  shortVersion: [
    {
      title: 'Same questions, two spaces.',
      body: 'One Genie space reads the raw tables. A second reads the metric view and carries the glossary. Both get the same five questions through the Conversation API.',
    },
    {
      title: 'Terms are defined once.',
      body: 'Revenue means completed orders. Segment, region, and channel codes map to names. These live in the metric view, not in each space.',
    },
    {
      title: 'Synonyms sit next to the term.',
      body: 'Revenue also answers to sales, bookings, and turnover. Customer segment answers to tier. Each synonym is a line in the metric view YAML.',
    },
    {
      title: 'Answers are checked against SQL.',
      body: 'Each question has an expected query in the use-case spec. The job runs it and compares rows with what the SQL Genie generated.',
    },
    {
      title: 'The reference run went from 0 to 5 of 5.',
      body: 'Without the semantics, no answer matched. With them, all five did. The comparison table keeps both queries side by side.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'What the job does',
      prose:
        'One job runs five tasks. It generates the tables, asks the baseline space, adds the semantics, asks the second space, and pivots the answers into one table.',
      diagram: {
        type: 'flow',
        title: 'Before and after in one job',
        description:
          'generate_data creates the cust and ord_fact tables from the use-case spec. ask_before creates a baseline Genie space over those tables and asks five questions. add_semantics writes comments and tags and creates the sales_metrics metric view. ask_after creates a second space over the metric view with instructions and asks the same questions. compare_answers writes ontology_comparison_summary.',
        lanes: [
          { label: 'Before', fromRow: 0, toRow: 0 },
          { label: 'Semantic layer', fromRow: 1, toRow: 1 },
          { label: 'After', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          { id: 'gen', label: 'generate_data', mono: true, sub: 'dbldatagen, fixed seed', col: 0, row: 0 },
          { id: 'before', label: 'ask_before', mono: true, sub: 'space over raw tables', col: 1, row: 0, kind: 'highlight' },
          { id: 'sem', label: 'add_semantics', mono: true, sub: 'comments, tags, metrics', col: 1, row: 1 },
          { id: 'mv', label: 'sales_metrics', mono: true, sub: 'metric view', col: 2, row: 1, kind: 'store' },
          { id: 'after', label: 'ask_after', mono: true, sub: 'space over metric view', col: 1, row: 2, kind: 'highlight' },
          { id: 'cmp', label: 'compare_answers', mono: true, sub: 'pivot before and after', col: 2, row: 2 },
          { id: 'tbl', label: 'ontology_comparison', mono: true, sub: 'SQL and match flag', col: 3, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'gen', to: 'before' },
          { from: 'before', to: 'sem' },
          { from: 'sem', to: 'mv' },
          { from: 'mv', to: 'after' },
          { from: 'after', to: 'cmp' },
          { from: 'cmp', to: 'tbl' },
        ],
        legend: [
          { kind: 'highlight', label: 'Asks Genie through the API' },
          { kind: 'store', label: 'Unity Catalog object' },
        ],
      },
    },
    {
      id: 'layers',
      heading: 'Where each term is defined',
      prose:
        'Each piece of meaning has one home. Genie reads all of them, and so do SQL users and dashboards that query the same objects.',
      diagram: {
        type: 'flow',
        title: 'Business term to Genie answer',
        description:
          'Table and column comments and tags describe the raw tables in Unity Catalog. The sales_metrics metric view defines measures, dimensions, and synonyms on top of them. The Genie space adds instructions, sample questions, and an example query. A user question is answered with MEASURE queries against the metric view.',
        nodes: [
          { id: 'raw', label: 'cust, ord_fact', mono: true, sub: 'comments and tags', col: 0, row: 0, kind: 'store' },
          { id: 'view', label: 'sales_metrics', mono: true, sub: 'measures, synonyms', col: 1, row: 0, kind: 'highlight' },
          { id: 'space', label: 'Genie space', sub: 'glossary, samples', col: 2, row: 0, kind: 'surface' },
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
          { kind: 'surface', label: 'Genie space' },
        ],
      },
      table: {
        caption: 'Terms the metric view defines',
        columns: ['Term', 'Definition and synonyms'],
        rows: [
          ['Revenue', 'SUM(net_amt) for completed orders. Synonyms: sales, net sales, bookings, turnover, income'],
          ['Active Customers', 'Distinct customers with a completed order. Synonyms: active accounts, buying customers'],
          ['Average Order Value', 'Revenue / completed orders. Synonyms: AOV, average order size, basket size'],
          ['Customer Segment', "E, M, S mapped to Enterprise, Mid-Market, SMB. Synonyms: tier, account type"],
          ['Region', 'NA, EM, AP mapped to North America, EMEA, APAC. Synonyms: territory, geo'],
        ],
      },
    },
    {
      id: 'answers',
      heading: 'Same questions, before and after',
      prose:
        'A row matches when the rows Genie returned equal the rows from the expected query, ignoring column names and order. A code where a name is expected does not match.',
      diagram: {
        type: 'matrix',
        title: 'What each space answered',
        description:
          'For all five questions the baseline space returned codes such as S, M, E, NA, or W, and for three of them it also counted cancelled and returned orders. The space over the metric view returned business names and matched the expected rows on all five.',
        corner: 'Question ↓ · Space →',
        columns: ['Raw tables', 'With semantics'],
        rows: [
          {
            label: 'Revenue by segment',
            cells: [
              { state: 'none', text: 'Codes S, M, E', sub: 'all orders: SMB 3.05M vs 2.44M' },
              { state: 'own', text: 'Matches', sub: 'completed orders, names' },
            ],
          },
          {
            label: 'Active customers by region',
            cells: [
              { state: 'none', text: 'Codes AP, EM, NA', sub: 'counts right, labels wrong' },
              { state: 'own', text: 'Matches', sub: '209 / 111 / 80' },
            ],
          },
          {
            label: 'Enterprise order value',
            cells: [
              { state: 'none', text: '990.48', sub: 'AVG over all orders' },
              { state: 'own', text: 'Matches: 995.26', sub: 'AOV measure' },
            ],
          },
          {
            label: 'Top region, September',
            cells: [
              { state: 'none', text: 'NA, 1,008,144', sub: 'includes cancelled orders' },
              { state: 'own', text: 'North America', sub: '805,370' },
            ],
          },
          {
            label: 'Cancellations by channel',
            cells: [
              { state: 'none', text: 'Codes W, S, P', sub: 'counts right, labels wrong' },
              { state: 'own', text: 'Matches', sub: 'Web 291, Sales rep 160' },
            ],
          },
        ],
        legend: [
          { state: 'none', label: 'Does not match expected rows' },
          { state: 'own', label: 'Matches expected rows' },
        ],
        caption: 'Baseline 0 of 5, with semantics 5 of 5. The generated SQL for both is in ontology_comparison.',
      },
    },
    {
      id: 'replay',
      heading: 'Replay it',
      steps: [
        {
          title: 'Open the comparison table',
          body: 'ontology_comparison holds one row per question and stage: the SQL Genie wrote, the expected SQL, both result sets, and a matches_expected flag.',
          code: 'SELECT question_id, baseline_match, enhanced_match\nFROM <catalog>.<schema>.ontology_comparison_summary;',
        },
        {
          title: 'Open both spaces',
          body: 'genie_spaces lists the baseline and enhanced space IDs and URLs for the run. Ask a question in each and open Show code.',
        },
        {
          title: 'Add your own term',
          body: 'Add a synonym to the metric view YAML in use_cases/general.yml, rerun add_semantics, and ask the question with the new word.',
        },
      ],
      points: [
        {
          strong: 'The baseline space shares the tables.',
          text: 'Its comments were added after its questions ran. Open it later and it sees the annotated tables, though not the metric view or the glossary.',
        },
      ],
    },
  ],
  related: [
    { slug: 'user-experience', title: 'Assistant user experience' },
    { slug: 'documentation-generation', title: 'Automated data documentation' },
  ],
};
