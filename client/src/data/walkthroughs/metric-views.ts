import type { Walkthrough } from './types.ts';

const DOCS = 'https://docs.databricks.com/aws/en/uc-semantics/metric-views';

export const walkthrough: Walkthrough = {
  slug: 'metric-views',
  area: 'Analyst Guides',
  title: 'Metric views',
  intro:
    'A metric view is a Unity Catalog object that stores a business metric as YAML: a source table, optional joins and a filter, the fields people group by, and the measures they aggregate. This page shows how to write one, why it keeps numbers consistent, and how to deploy it as code. Each pattern says when to use it, how it works, what to do, and where the docs cover it.',
  businessValue: {
    summary:
      'A metric view defines each KPI once in Unity Catalog. Dashboards, Genie, SQL, notebooks, and BI tools all query that one definition, so teams stop reconciling revenue and customer counts and spend the time on decisions.',
    outcomes: [
      {
        title: 'One definition everywhere',
        body: 'Revenue, active customers, and conversion rate are written once. AI/BI dashboards, Genie Agents, SQL, notebooks, and BI tools read the same definition, so they return the same number.',
      },
      {
        title: 'Fewer reconciliation meetings',
        body: 'When two reports disagree, there is one place to look. The definition is a file in Git with a reviewer and a history, not a formula buried in one dashboard.',
      },
      {
        title: 'Any grouping stays correct',
        body: 'Ratios and distinct counts are computed after grouping, not averaged afterward. A new breakdown by region or month is a new query, not a new report that someone has to rebuild.',
      },
      {
        title: 'Governed like any table',
        body: 'Grants, ownership, lineage, and certification work as they do for tables and views. Another Databricks account or metastore can use the metric through OpenSharing.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Define the metric once, in YAML.',
      body: 'Fields group and filter. Measures aggregate. A filter, a comment, and joins to dimension tables belong in the same file.',
    },
    {
      title: 'Write ratios as a numerator and a denominator.',
      body: 'The engine sums both for the grouping the user picks, then divides. Averaging rates afterward gives a different, wrong number.',
    },
    {
      title: 'Query every measure with MEASURE().',
      body: 'SELECT * does not work. Dashboards, Genie, and alerts apply MEASURE() for you. BI tools use custom SQL, a wrapper view, or a partner integration.',
    },
    {
      title: 'Add synonyms and display names before Genie.',
      body: 'Genie imports synonyms from the YAML. Give each measure the words your business uses, such as sales and turnover for revenue.',
    },
    {
      title: 'Deploy with a SQL task, not a bundle resource.',
      body: 'Bundles have no metric view resource yet. Keep the YAML in a .sql file in Git, run it from a Lakeflow Jobs SQL task, and switch the catalog per target.',
    },
    {
      title: 'Test each measure against plain SQL.',
      body: 'A verify task queries the measure with MEASURE(), recomputes it with a hand-written aggregate, and fails the job on any difference.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'One definition, many consumers',
      prose:
        'The metric view sits between the source tables and everything that reads them. The YAML lives in Git and a job deploys it to Unity Catalog. Consumers pick any fields and measures, and the engine writes the SQL for that grouping.',
      diagram: {
        type: 'flow',
        title: 'From source tables to consumers',
        description:
          'Source tables in Unity Catalog and a YAML file in Git feed a metric view. AI/BI dashboards, Genie Agents, SQL and notebooks, and BI tools all query the metric view.',
        nodes: [
          { id: 'git', label: 'YAML in Git', sub: 'reviewed, versioned', col: 0, row: 0, kind: 'box' },
          { id: 'tables', label: 'Source tables', sub: 'orders, customers', col: 0, row: 2, kind: 'store' },
          { id: 'mv', label: 'Metric view', sub: 'fields and measures', col: 1, row: 1, kind: 'highlight' },
          { id: 'dash', label: 'AI/BI dashboards', sub: 'published', col: 2, row: 0, kind: 'surface' },
          { id: 'genie', label: 'Genie Agents', sub: 'plain-language questions', col: 2, row: 1, kind: 'surface' },
          { id: 'sql', label: 'SQL and notebooks', sub: 'MEASURE()', col: 2, row: 2, kind: 'surface' },
          { id: 'bi', label: 'BI tools', sub: 'custom SQL, wrapper view', col: 2, row: 3, kind: 'surface' },
        ],
        edges: [
          { from: 'git', to: 'mv', label: 'deploy' },
          { from: 'tables', to: 'mv' },
          { from: 'mv', to: 'dash' },
          { from: 'mv', to: 'genie' },
          { from: 'mv', to: 'sql' },
          { from: 'mv', to: 'bi' },
        ],
        legend: [
          { kind: 'highlight', label: 'Metric defined once' },
          { kind: 'surface', label: 'Consumer' },
          { kind: 'store', label: 'Unity Catalog table' },
          { kind: 'box', label: 'Code in Git' },
        ],
        caption: 'The reference job builds this chain with two metric views, one over orders and one over sessions.',
      },
      links: [{ label: 'Unity Catalog metric views', url: `${DOCS}/`, note: 'Overview page that links to every metric view docs page.' }],
    },
    {
      id: 'choose',
      heading: 'Where should a metric live?',
      prose:
        'Four places can hold a calculation. They differ in who can reuse it and whether it survives a different grouping.',
      options: {
        caption: 'Where to define a business metric',
        rows: [
          {
            option: 'Unity Catalog metric view',
            when: 'Two or more dashboards, Genie Agents, notebooks, or tools quote the metric, or finance and operations must agree on it.',
            tradeoffs:
              'The docs describe it as governed, queryable from any SQL client, and correct under any grouping. Consumers need MEASURE() or a tool that applies it. A change reaches every consumer, so it needs review.',
          },
          {
            option: 'Regular view or pre-aggregated table',
            when: 'A fixed report with a fixed grouping, or a consumer that cannot use MEASURE() and a wrapper view is not acceptable.',
            tradeoffs:
              'The docs note that a standard view locks its grouping when you create it. A consumer that re-aggregates a ratio from it gets a wrong number. Each new breakdown needs a new view (practical guidance).',
          },
          {
            option: 'Dashboard custom calculation or local metric view',
            when: 'Prototyping, or logic that only one dashboard needs.',
            tradeoffs:
              'Scoped to one dashboard and not a Unity Catalog object, so SQL users and Genie cannot see it. The docs say a local metric view can be promoted to Unity Catalog when it is ready for wider use.',
          },
          {
            option: 'Semantic model in the BI tool',
            when: 'The tool has features the metric view cannot express, or the report must stay inside that tool.',
            tradeoffs:
              'The definition lives outside Unity Catalog, so other consumers cannot see it and the two copies drift. No grants, lineage, or certification apply to it (practical guidance).',
          },
        ],
        recommendation:
          'Put any metric that two teams will quote in a Unity Catalog metric view. Prototype in a local metric view in the dashboard and promote it when the logic settles. Use BI-tool calculations for presentation only, not for business rules.',
      },
      links: [
        {
          label: 'Data modeling in AI/BI dashboards',
          url: 'https://docs.databricks.com/aws/en/dashboards/manage/data-modeling/',
          note: 'Custom calculations, local metric views, and dashboard relationships compared.',
        },
      ],
    },
    {
      id: 'define',
      heading: 'Pattern 1: Define a metric view in YAML',
      prose:
        'When to use it: a number is quoted in more than one place, or two reports disagree about it. How it works: the YAML names a source table or query, an optional filter, fields to group by, and measures to aggregate. CREATE VIEW ... WITH METRICS LANGUAGE YAML stores it in Unity Catalog, and the Catalog Explorer editor and Genie Code write the same YAML.',
      points: [
        {
          strong: 'Scope the view with a filter.',
          text: 'A filter applies to every query. If the metric means completed orders, say so in the view so no consumer counts cancelled ones by accident.',
        },
        {
          strong: 'Define atomic measures first.',
          text: 'Start with SUM(revenue) and COUNT(DISTINCT customer_id), then build ratios from them with MEASURE(). The docs call this composability.',
        },
        {
          strong: 'Turn codes into business names.',
          text: 'Use a CASE expression in the field so status O reads Open in every tool.',
        },
        {
          strong: 'Put what matters in comment.',
          text: 'In YAML version 1.1, # comments are removed when the definition is saved. Text in a comment field survives and shows in Catalog Explorer.',
        },
        {
          strong: 'Quote on in a join.',
          text: "Write 'on': in YAML, because an unquoted on reads as a boolean in YAML 1.1. Use fields or dimensions for the grouping columns; the docs treat them as the same thing.",
        },
        {
          strong: 'Check the privileges.',
          text: 'The creator needs SELECT on the source, CREATE TABLE and USE SCHEMA on the schema, USE CATALOG on the catalog, and a warehouse on Databricks Runtime 17.3 or above for agent metadata.',
        },
      ],
      links: [
        { label: 'Model metric views', url: `${DOCS}/basic-modeling`, note: 'Sources, filters, fields, measures, best practices.' },
        { label: 'Create a metric view', url: `${DOCS}/create`, note: 'Prerequisites and the SQL and UI routes.' },
        { label: 'Metric view YAML syntax reference', url: `${DOCS}/yaml-reference` },
        { label: 'CREATE VIEW', url: 'https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-create-view', note: 'The WITH METRICS clause.' },
      ],
    },
    {
      id: 'joins',
      heading: 'Pattern 2: Model joins to dimension tables',
      prose:
        'When to use it: the grouping you need, such as customer segment or product category, lives in another table. How it works: the source is the fact table and each join is a left outer join to a dimension. The engine joins only the tables a query touches. A join must be many-to-one; with many-to-many the engine picks the first matching row.',
      points: [
        {
          strong: 'Declare rely when it is true.',
          text: 'rely: at_most_one_match: true lets the engine skip joins and scan less. The docs warn it is not checked at run time, and a fan-out gives wrong measures. It needs runtime 18.1 or above.',
        },
        {
          strong: 'Nest joins for a snowflake.',
          text: 'Put the sub-dimension under its parent and reference it by the full path, such as customer.nation.n_name. Snowflake joins need runtime 17.3 or above.',
        },
        {
          strong: 'Use one_to_many for a second fact.',
          text: 'cardinality: one_to_many treats the joined table as a fact the engine aggregates on its own, so customer rows are not duplicated. It needs runtime 18.1 or above and has rules about fields and nested joins.',
        },
        {
          strong: 'Join the result, not the view.',
          text: 'A metric view cannot be joined to another table at query time. Wrap the MEASURE() query in a CTE and join the CTE.',
        },
        {
          strong: 'Flatten arrays and maps first.',
          text: 'Fields, measures, and joins work on flat columns, so resolve ARRAY and MAP columns in the source query.',
        },
      ],
      examples: [
        {
          label: 'Snowflake join with a nested dimension',
          language: 'sql',
          code: `-- orders -> customer -> nation, from the docs' TPC-H example
joins:
  - name: customer
    source: samples.tpch.customer
    'on': o_custkey = c_custkey
    rely:
      at_most_one_match: true
    joins:
      - name: nation
        source: samples.tpch.nation
        'on': c_nationkey = n_nationkey
fields:
  - name: customer_nation
    expr: customer.nation.n_name`,
          notes: ['The reference views use the flat star form shown above; this is the nested form.'],
        },
      ],
      links: [
        { label: 'Joins in metric views', url: `${DOCS}/joins`, note: 'Cardinality, rely, star and snowflake schemas.' },
        { label: 'Metric view feature availability', url: `${DOCS}/feature-availability`, note: 'Minimum runtime for each feature.' },
        { label: 'Tutorial: build a metric view with joins', url: `${DOCS}/tpch-example` },
      ],
    },
    {
      id: 'ratios',
      heading: 'Pattern 3: Ratio and distinct-count measures',
      prose:
        'When to use it: any rate, average, or per-customer figure, and any count of distinct things. How it works: define the numerator and the denominator as measures, then divide them with MEASURE(). For each grouping the engine sums both, then divides. That is a ratio of sums, which stays correct at every level.',
      points: [
        {
          strong: 'Never average a ratio.',
          text: 'The average of daily conversion rates counts a quiet day the same as a busy one. The average of segment order values counts a small segment the same as a large one. Both differ from the true ratio.',
        },
        {
          strong: 'Never add up distinct counts.',
          text: 'A customer who orders in three months counts three times if you add the monthly counts. Define COUNT(DISTINCT customer_id) as a measure and let the engine count per grouping.',
        },
        {
          strong: 'Use FILTER for conditional counts.',
          text: 'COUNT(DISTINCT session_id) FILTER (WHERE converted) keeps the numerator beside the denominator in one definition.',
        },
        {
          strong: 'Guard the denominator.',
          text: 'Wrap it in NULLIF(..., 0) when a group can be empty, as in the growth measures below.',
        },
        {
          strong: 'Check one grouping by hand.',
          text: 'Recompute the ratio with a plain aggregate for one month and one segment before you publish it.',
        },
      ],
      links: [
        { label: 'Model metric views: measures', url: `${DOCS}/basic-modeling`, note: 'Ratio, distinct-count, and filtered measures.' },
        { label: 'Advanced techniques: composability', url: `${DOCS}/advanced-techniques`, note: 'Building a measure from other measures.' },
      ],
    },
    {
      id: 'windows',
      heading: 'Pattern 4: Window measures',
      prose:
        'When to use it: month-over-month growth, a rolling three months, a running total, or a balance that must not be summed over time. Window measures are generally available since October 6, 2026. How it works: add a window block with the field that orders the window, a range, and a semiadditive setting, then compose the results with MEASURE().',
      points: [
        {
          strong: 'Pick the range.',
          text: 'current, cumulative, trailing N unit, leading N unit, or all. A trailing range excludes the current row unless you add inclusive (runtime 18.1 or above).',
        },
        {
          strong: 'Shift with offset.',
          text: 'offset: -1 month on a month field gives the prior month, and -12 month gives the same month last year. Prefer months over -365 day, because month arithmetic follows the calendar (runtime 18.1 or above).',
        },
        {
          strong: 'Set semiadditive.',
          text: 'It says which value to return when the ordering field is not in GROUP BY, first or last. A closing balance should not be summed across days.',
        },
        {
          strong: 'Group by the ordering field to read it.',
          text: 'Group by order_month to read month-over-month growth. Other fields in the query partition the window, so each segment gets its own prior month.',
        },
        {
          strong: 'Use an index for fiscal calendars.',
          text: 'On a consecutive integer index column, a numeric offset or range works for fiscal weeks or 4-4-5 periods. It needs runtime 19, and a gap in the index returns wrong numbers without an error.',
        },
      ],
      links: [
        { label: 'Advanced techniques: window measures', url: `${DOCS}/advanced-techniques`, note: 'Ranges, offset, inclusive and exclusive, numeric index.' },
      ],
    },
    {
      id: 'scope',
      heading: 'One wide metric view or several focused ones',
      prose:
        'The source of a metric view has one grain and one filter. That limit decides how many views you need.',
      options: {
        caption: 'How many metric views per subject area',
        rows: [
          {
            option: 'One wide view per fact table',
            when: 'Orders with customer, product, and channel dimensions. All measures share the same grain and filter.',
            tradeoffs:
              'One object to govern, certify, and hand to Genie. The YAML grows with each measure, so a pull request touches a long file (practical guidance).',
          },
          {
            option: 'Several focused views',
            when: 'The grain or filter differs, such as orders versus site sessions, or different teams own different metrics.',
            tradeoffs:
              'Each file stays small and has its own owner. A query cannot mix measures from two views, so combine them in a CTE (the docs say metric views cannot be joined at query time). A Genie Agent counts each one toward its 50-source limit.',
          },
          {
            option: 'A metric view built on another',
            when: 'A derived view reuses the measures of a base view, such as a regional rollup.',
            tradeoffs:
              'The docs allow a metric view as the source and apply the same composability rules. Deploy the base view first, and treat a change to it as a change to every view above it (practical guidance).',
          },
        ],
        recommendation:
          'Use one view per fact table and split when the grain or the filter differs. The reference job uses two: orders, and sessions for conversion rate, because a session is not an order.',
      },
    },
    {
      id: 'semantics',
      heading: 'Pattern 5: Semantic metadata and synonyms for Genie',
      prose:
        'When to use it: before you add a metric view to a Genie Agent or a dashboard that business users read. How it works: YAML version 1.1 adds display_name, synonyms, format, and comment to every field and measure. Genie imports synonyms to find the right column from a question. Dashboards show display names and formats. It needs runtime 17.3 or above.',
      points: [
        {
          strong: 'List the words people really use.',
          text: 'Revenue answers to sales and turnover. Customer segment answers to tier. A field or measure takes up to 10 synonyms.',
        },
        {
          strong: 'Keep synonyms unique.',
          text: 'If sales is a synonym of two measures, Genie has to guess. Give each word one owner (practical guidance).',
        },
        {
          strong: 'Write the scope in the comment.',
          text: 'Say completed orders only, or after discount. Genie and people both read it.',
        },
        {
          strong: 'Set a format.',
          text: 'Currency, number, and percentage formats make a dashboard tile and a notebook table show the same value the same way.',
        },
        {
          strong: 'Test with real questions.',
          text: 'Ask the five questions your users ask most, and compare the answers with the numbers you expect. The business terms guide shows a before and after run.',
        },
      ],
      links: [
        { label: 'Agent metadata in metric views', url: 'https://docs.databricks.com/aws/en/uc-semantics/agent-metadata', note: 'Display names, synonyms, formats.' },
        { label: 'Genie Agents', url: 'https://docs.databricks.com/aws/en/genie/' },
      ],
    },
    {
      id: 'query',
      heading: 'Pattern 6: Query with MEASURE()',
      prose:
        'When to use it: every time. How it works: list the fields you group by, wrap each measure in MEASURE(), and add GROUP BY ALL. SELECT * is not supported. On Databricks Runtime 18.1 and above, AGG is an alias for MEASURE. Parameters (Public Preview) let a caller pass a value, such as a discount rate, into the view at query time.',
      table: {
        caption: 'How each consumer reads a metric view',
        columns: ['Consumer', 'How it reads the metric view'],
        rows: [
          ['SQL editor, notebooks, jobs', 'SELECT fields and MEASURE(measure) with GROUP BY ALL, on a SQL warehouse or compute on runtime 16.4 or above.'],
          ['AI/BI dashboards', 'Use the metric view as a dataset. MEASURE() is applied for you, and display names and formats show in the UI.'],
          ['Genie Agents', 'Add the metric view as a source. Synonyms and comments are imported, and the agent writes MEASURE() queries.'],
          ['Alerts', 'Alert on a measure, such as conversion rate dropping under a threshold.'],
          ['Tableau, Sigma, other SQL tools', 'Custom SQL with the MEASURE() pattern, or a wrapper view. Tableau can also enable BI compatibility mode from Initial SQL.'],
          ['Power BI', 'Native query in DirectQuery mode with MEASURE(), or a wrapper view. The BI compatibility mode option was removed from the Power BI connector.'],
        ],
      },
      points: [
        {
          strong: 'Create one wrapper view per report shape.',
          text: 'A standard view that selects MEASURE() for a fixed set of fields lets a tool query it like a table. Each field combination needs its own wrapper, so use it for a few stable reports.',
        },
        {
          strong: 'Filter on fields, not on measures.',
          text: 'Put the WHERE clause on fields. Filter on a measure in an outer query over the grouped result.',
        },
        {
          strong: 'Join results through a CTE.',
          text: 'Join a metric view result to another table inside a CTE, as the docs show, because the view itself cannot be a join input.',
        },
      ],
      examples: [
        {
          label: 'Query, join through a CTE, and wrap for a BI tool',
          language: 'sql',
          code: `-- Revenue and AOV by segment and month
SELECT customer_segment, order_month,
       MEASURE(net_revenue) AS net_revenue,
       MEASURE(avg_order_value) AS avg_order_value
FROM main.sales.mv_orders_metrics
GROUP BY ALL;

-- Join a metric view result to another table
WITH by_customer AS (
  SELECT customer_id, MEASURE(net_revenue) AS net_revenue
  FROM main.sales.mv_orders_metrics
  GROUP BY customer_id
)
SELECT c.account_owner, b.net_revenue
FROM by_customer b JOIN main.sales.accounts c USING (customer_id);

-- Wrapper view for a tool that cannot write MEASURE()
CREATE VIEW main.sales.orders_report AS
SELECT order_month, MEASURE(net_revenue) AS net_revenue
FROM main.sales.mv_orders_metrics
GROUP BY ALL;`,
          notes: ['customer_id is not a field in the reference view; add it to the YAML before you group by it.'],
        },
      ],
      links: [
        { label: 'Query metric views', url: `${DOCS}/query` },
        { label: 'Use metric views with external BI tools', url: `${DOCS}/bi-tools`, note: 'Custom SQL, wrapper view, compatibility mode, partner support.' },
        { label: 'MEASURE function', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/measure' },
        { label: 'Use parameters with metric views', url: `${DOCS}/use-parameters` },
      ],
    },
    {
      id: 'govern',
      heading: 'Pattern 7: Govern a metric view',
      prose:
        'When to use it: as soon as a second team depends on the metric. How it works: a metric view is a Unity Catalog securable object with the same privileges as a view. Only the owner can edit the definition. Lineage lists the source tables upstream and the dashboards and queries downstream.',
      points: [
        {
          strong: 'Grant SELECT to a group.',
          text: 'GRANT SELECT ON the metric view TO a group is the minimum for querying. Privileges on the catalog and schema cascade down.',
        },
        {
          strong: 'Own it with a group.',
          text: 'Transfer ownership to a group so several people can edit. Give that group SELECT on every source table. This is not available for materialized metric views.',
        },
        {
          strong: 'Certify the approved view.',
          text: 'Set the system.certification_status tag to certified so authors pick it first. It needs ASSIGN on the tag. The reference run set it on both views.',
        },
        {
          strong: 'Check lineage before you change or drop.',
          text: 'Dropping a metric view is permanent. The Lineage tab shows the dashboards and queries that read it.',
        },
        {
          strong: 'Know the limits.',
          text: 'Data profiling is not supported. A metric view cannot be materialized, or shared, when its source tables have row filters, column masks, or ABAC policies.',
        },
      ],
      links: [
        { label: 'Manage metric views', url: `${DOCS}/manage`, note: 'Privileges, ownership, editing, dropping.' },
        { label: 'Certify or deprecate data', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/certify-deprecate-data' },
        { label: 'View data lineage', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage' },
      ],
    },
    {
      id: 'deploy',
      heading: 'Pattern 8: Deploy as code',
      prose:
        'When to use it: always, once the metric matters. How it works: the YAML sits in a .sql file in Git. A pull request shows the change to a measure. A Declarative Automation Bundle deploys a job whose SQL task runs the file on a serverless SQL warehouse, then a verify task checks the measures. Bundles have no metric view resource: databricks bundle schema on CLI 1.17.0 lists none, and the bundle resources page names none.',
      diagram: {
        type: 'flow',
        title: 'Deploy and verify a metric view',
        description:
          'A reviewed pull request is deployed by a bundle. A SQL task creates the metric view in the target catalog. A verify task compares each measure with plain SQL and writes a results table.',
        nodes: [
          { id: 'pr', label: 'Pull request', sub: 'YAML reviewed', col: 0, row: 0, kind: 'box' },
          { id: 'deploy', label: 'bundle deploy', mono: true, sub: '--target test or prod', col: 1, row: 0 },
          { id: 'task', label: 'SQL task', sub: 'CREATE OR REPLACE VIEW', col: 2, row: 0 },
          { id: 'mv', label: 'Metric view', sub: 'in the target catalog', col: 3, row: 0, kind: 'highlight' },
          { id: 'verify', label: 'Verify task', sub: 'MEASURE() vs plain SQL', col: 3, row: 1, kind: 'gate' },
          { id: 'results', label: 'Results table', sub: 'pass or fail per measure', col: 3, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'pr', to: 'deploy' },
          { from: 'deploy', to: 'task' },
          { from: 'task', to: 'mv' },
          { from: 'mv', to: 'verify' },
          { from: 'verify', to: 'results' },
        ],
        legend: [
          { kind: 'highlight', label: 'Deployed object' },
          { kind: 'gate', label: 'Check that can fail the job' },
          { kind: 'store', label: 'Table' },
        ],
      },
      steps: [
        {
          title: 'Keep the definition in a .sql file.',
          body: 'One file per metric view, with a USE CATALOG and USE SCHEMA that read the job parameters, then CREATE OR REPLACE VIEW ... WITH METRICS LANGUAGE YAML AS $$ ... $$. Unqualified table names in the YAML resolve in that catalog and schema.',
        },
        {
          title: 'Run it from a Lakeflow Jobs SQL task.',
          body: 'A sql_task points at the file, names the warehouse, and passes catalog and schema as parameters. A SQL file may hold several statements separated by semicolons.',
        },
        {
          title: 'Promote with a catalog variable.',
          body: 'Declare catalog as a bundle variable and set it per target. The same file then builds the view in dev, test, and prod catalogs. Deploy to test, run the verify task, and only then deploy to prod.',
          code: `targets:
  dev:
    mode: development
    variables:
      catalog: dev_analytics
  test:
    variables:
      catalog: test_analytics
  prod:
    mode: production
    workspace:
      root_path: /Workspace/Shared/.bundle/\${bundle.name}
    variables:
      catalog: analytics`,
        },
        {
          title: 'Keep grants and tags across redeploys.',
          body: 'In the reference run, CREATE OR REPLACE VIEW dropped the certification tag, and the docs say a replace does not keep grants on most views. ALTER VIEW ... AS $$ ... $$ changed the definition and kept the tag. The docs also describe a COPY * clause (runtime 18.3 and above, default from 19); the warehouse in the reference run rejected it. Re-apply grants and tags in the deploy task, or use ALTER VIEW for updates.',
        },
        {
          title: 'Review in Git and test in CI.',
          body: 'A pytest check parses each YAML block: version, unique names, quoted on, and a display name and comment on every measure. The verify task then proves the numbers in a real workspace.',
        },
      ],
      links: [
        { label: 'SQL task for jobs', url: 'https://docs.databricks.com/aws/en/jobs/tasks/sql', note: 'File source, parameters, multiple statements.' },
        { label: 'Bundle resources', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/resources', note: 'No metric view resource is listed.' },
        { label: 'Bundle variables', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/variables' },
        { label: 'Edit a metric view with ALTER VIEW', url: `${DOCS}/manage`, note: 'ALTER VIEW replaces the full YAML.' },
      ],
    },
    {
      id: 'deploy-options',
      heading: 'Which deployment route',
      prose:
        'Three routes put a metric view in a catalog today, and a fourth is missing. Check databricks bundle schema after each CLI upgrade, because a native resource would change the answer.',
      options: {
        caption: 'How to deploy a metric view',
        rows: [
          {
            option: 'Bundle resource',
            when: 'You want the view declared in databricks.yml next to jobs and dashboards.',
            tradeoffs:
              'Not available. CLI 1.17.0 has no metric view resource and the bundle resources page lists none. Revisit when a release adds one.',
          },
          {
            option: 'SQL task running a .sql file',
            when: 'The definition belongs in Git and promotes across catalogs with the rest of the bundle.',
            tradeoffs:
              'Uses a plain SQL file, a warehouse, and bundle parameters. You write the grants and tags yourself, and names inside the YAML follow the session catalog and schema. The reference job uses this route.',
          },
          {
            option: 'Notebook or Python task that renders the YAML',
            when: 'One YAML must be filled with several catalogs or table lists, or an automated build generates views from a spec.',
            tradeoffs:
              'Flexible, but the YAML in Git is a template, so reviewers read less of the real definition. You need a string-building step and a test for it (practical guidance).',
          },
          {
            option: 'Catalog Explorer editor or Genie Code',
            when: 'Exploring, prototyping, or a single analyst owns a small metric view.',
            tradeoffs:
              'Fast, with live preview and YAML validation. Nothing is reviewed or promoted, so dev and prod can drift. Export the YAML to Git before others depend on it.',
          },
        ],
        recommendation:
          'Use a SQL task over a .sql file in a bundle. Build in the UI, then move the YAML into Git once a second team depends on the metric.',
      },
    },
    {
      id: 'share',
      heading: 'Pattern 9: Share with OpenSharing',
      prose:
        'When to use it: a partner, a subsidiary, or another Databricks account needs the same metric without a copy of your logic. Sharing metric views with OpenSharing is generally available since September 24, 2026. How it works: add the metric view to a share as a VIEW, and the recipient queries it with MEASURE() on serverless compute.',
      points: [
        {
          strong: 'Databricks recipients only.',
          text: 'The docs say you can only share a metric view with a Databricks recipient.',
        },
        {
          strong: 'Check the sources first.',
          text: 'A metric view cannot be shared if its tables have row filters, column masks, ABAC policies, or catalog commits. If shared anyway, recipients are blocked from querying it.',
        },
        {
          strong: 'Use an alias for a stable name.',
          text: 'AS lets the recipient see schema.name instead of your internal names. Once you set an alias, the recipient must use it.',
        },
        {
          strong: 'Deploy the share as code too.',
          text: 'Put ALTER SHARE in a SQL task after the metric view task, so the share follows each promotion.',
        },
      ],
      examples: [
        {
          label: 'Add a metric view to a share',
          language: 'sql',
          code: `ALTER SHARE partner_share
  ADD VIEW main.sales.mv_orders_metrics
  COMMENT "Orders KPIs"
  AS sales.orders_metrics;`,
          notes: ['A metric view uses the VIEW data type in SQL, the CLI, and Python.'],
        },
      ],
      links: [
        { label: 'Add metric views to a share', url: 'https://docs.databricks.com/aws/en/opensharing/create-share', note: 'Requirements, SQL, CLI, and Catalog Explorer.' },
      ],
    },
    {
      id: 'stages',
      heading: 'Release stages, as of October 21, 2026',
      prose:
        'Stages come from the docs pages and the release notes. Where neither states a stage, the table says so.',
      table: {
        columns: ['Feature', 'Stage and requirement'],
        rows: [
          ['Joins (star, snowflake), filters, fields, measures, MEASURE()', 'No preview label on the docs pages. Snowflake joins need runtime 17.3 or above.'],
          ['YAML specification version 1.1', 'Current version. Adds agent metadata and comment (runtime 17.3 or above), cardinality, offset, and inclusive modifiers (runtime 18.1 or above).'],
          ['Window measures', 'Generally available since October 6, 2026.'],
          ['Window measures on a numeric index', 'Added September 14, 2026. Needs runtime 19. The release note gives no stage.'],
          ['Sharing with OpenSharing', 'Generally available since September 24, 2026. The Manage metric views page still says Beta.'],
          ['Parameters', 'Public Preview. Needs runtime 18.2 or above.'],
          ['Materialization', 'Needs serverless compute and runtime 17.3 or above. The docs page and the release notes I searched give no stage, so confirm before you rely on it.'],
          ['BI compatibility mode', 'Launched as a Beta for Power BI. The Power BI connector no longer offers it. The docs still describe it for Tableau through Initial SQL, with no stage stated.'],
          ['Certification status tag', 'Listed as Public Preview in the release notes I found. Check the current certification page.'],
        ],
      },
      links: [
        { label: 'Metric view feature availability', url: `${DOCS}/feature-availability` },
        { label: 'Materialization for metric views', url: `${DOCS}/materialization`, note: 'Pre-computed aggregations and query rewrite.' },
        { label: 'Databricks release notes', url: 'https://docs.databricks.com/aws/en/release-notes/' },
      ],
    },
    {
      id: 'reference-run',
      heading: 'Reference run',
      prose:
        'The job generated 240 customers, 24 products, 4,000 orders, and about 3,700 sessions, then deployed two metric views with SQL tasks and checked them on a serverless SQL warehouse. Everything below comes from its mv_results table. The data is synthetic and small, so the run shows that the pattern works, not how fast it is.',
      table: {
        columns: ['Finding', 'Result'],
        rows: [
          ['Deploy', 'Two SQL tasks ran in parallel and created mv_orders_metrics (17 columns) and mv_funnel_metrics (10 columns). Both read back as type METRIC_VIEW.'],
          ['Measures against hand-written SQL', 'All 67 measure checks passed: 43 on orders and 24 on sessions, 884 groups in total. Groupings were total, segment, product category, month, region and channel, session channel, and session month.'],
          ['Window measures', 'Prior month, month-over-month growth, rolling three months, and running total matched LAG and framed SUM over monthly totals, by month (21 groups) and by month and segment (83 groups).'],
          ['Ratio pitfalls', 'Conversion rate over all sessions was 8.63%, and the average of daily rates was 14.23%. Average order value was 1,236.59 overall and 1,242.59 as an average of segments. Active customers were 240 overall and 2,274 when added up by month.'],
          ['Lineage', 'The lineage API listed all three source tables for the orders view and both for the sessions view. Lineage was readable within the same job run.'],
          ['Certification tag', 'system.certification_status = certified was set on both views and read back.'],
          ['Tags on redeploy', 'CREATE OR REPLACE VIEW dropped the certification tag. ALTER VIEW kept it. The SQL parser on this warehouse rejected COPY *.'],
          ['Rerun', 'A second run left 70 rows in the verify step, not 140, and every table kept its row count.'],
        ],
      },
    },
  ],
  related: [
    { slug: 'in-platform-visualization', title: 'Charts and dashboards in the platform' },
    { slug: 'ontology', title: 'Business terms and synonyms' },
    { slug: 'genie-agents', title: 'Genie Agents' },
  ],
};
