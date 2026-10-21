import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'sql-notebook-analysis',
  area: 'Analyst Guides',
  title: 'SQL and notebooks at scale',
  intro:
    'Analysts have four surfaces on the same governed data: the SQL editor on a serverless SQL warehouse, serverless notebooks in Python or SQL, Genie Code for writing and fixing code, and Genie for asking questions in plain language. This page covers where each fits, how to keep Python work distributed as data grows, how to keep queries fast, and what to use now that serverless has no R and hosted RStudio is end-of-life.',
  businessValue: {
    summary:
      'Analysts query governed data on serverless compute with no clusters to size, and ask questions in plain language through Genie. Analytics leaders get faster answers under the same Unity Catalog permissions.',
    outcomes: [
      {
        title: 'No wait for infrastructure',
        body:
          'The SQL editor on a serverless warehouse starts in seconds and scales with concurrency, so analysts do not queue for compute.',
      },
      {
        title: 'One permission model',
        body:
          'The SQL editor, serverless notebooks, and Genie all use the same Unity Catalog grants, so access rules are defined once.',
      },
      {
        title: 'Faster first drafts',
        body:
          'Genie Code writes, explains, and fixes SQL and Python. Genie answers business questions on curated data and shows the SQL it ran, so users can check it.',
      },
      {
        title: 'R needs its own setup',
        body:
          'Serverless does not run R, and hosted RStudio is end-of-life. R teams connect their own IDE or use a notebook on classic compute.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Start in the SQL editor on a serverless warehouse.',
      body: 'It starts in seconds, scales with concurrency, and fits exploration, joins, and aggregates. Save the query, parameterize it, and share it.',
    },
    {
      title: 'Move to a serverless notebook for Python.',
      body: 'Use it for multi-step analysis, plotting, and libraries. There is no cluster to size, and the same Unity Catalog permissions apply.',
    },
    {
      title: 'Aggregate in Spark, then collect.',
      body: 'Bring only the small result into pandas. When the data is too large for one machine, use the pandas API on Spark.',
    },
    {
      title: 'Let Genie Code and Genie do the first draft.',
      body: 'Genie Code writes, explains, and fixes SQL and Python in the editor and notebooks. Genie answers business questions on curated data, and shows the SQL it ran.',
    },
    {
      title: 'Use RStudio Desktop or Posit with Databricks for R.',
      body: 'Serverless does not run R and hosted RStudio is end-of-life. Connect your own R IDE through sparklyr and Databricks Connect or ODBC, or use an R notebook on classic compute.',
    },
  ],
  sections: [
    {
      id: 'surfaces',
      heading: 'Which surface for which job',
      table: {
        columns: ['Job', 'Use'],
        rows: [
          ['Explore a table, join, aggregate, share a query', 'SQL editor on a serverless SQL warehouse'],
          ['Multi-step analysis, plots, Python libraries', 'Serverless notebook (Python and SQL cells)'],
          ['Write, explain, or fix code', 'Genie Code in the editor or notebook'],
          ['Ask a business question without writing SQL', 'Genie Agents, or Genie One for business users'],
          ['Statistical work in R', 'Your own R IDE with sparklyr, or an R notebook on classic compute'],
          ['Chart and share results', 'AI/BI dashboard on the same tables'],
        ],
      },
      links: [
        {
          label: 'Serverless SQL warehouses',
          url: 'https://docs.databricks.com/aws/en/admin/sql/serverless',
        },
        {
          label: 'Genie Code',
          url: 'https://docs.databricks.com/aws/en/genie-code/',
        },
        {
          label: 'Genie Agents',
          url: 'https://docs.databricks.com/aws/en/genie-agents/',
        },
      ],
    },
    {
      id: 'flow',
      heading: 'Explore with SQL',
      prose:
        'Write queries against Unity Catalog tables and keep them readable. Window functions with QUALIFY give shares and top-N without a subquery. Parameter markers let one saved query serve many people without string editing, and the query history and query profile show where time goes.',
      points: [
        {
          strong: 'Use parameter markers.',
          text: ':status in a query adds a parameter widget in the editor and a bound parameter in a notebook or job. It avoids string formatting and SQL injection.',
        },
        {
          strong: 'Read the query profile.',
          text: 'It shows time per operator, files read, and spill. Fix the slowest operator before you resize the warehouse.',
        },
        {
          strong: 'Keep queries in Git.',
          text: 'Store notebooks and SQL files in a Git folder so changes are reviewed and versioned.',
        },
      ],
      examples: [
        {
          label: 'A parameterized query with a window share',
          language: 'sql',
          code: "SELECT c.region,\n       SUM(o.quantity * o.unit_price) AS revenue,\n       SUM(o.quantity * o.unit_price) / SUM(SUM(o.quantity * o.unit_price)) OVER () AS share\nFROM analyst_orders o JOIN analyst_customers c USING (customer_id)\nWHERE o.status = :status\nGROUP BY c.region;",
          notes: ['Named parameter markers bind the value without string formatting.'],
        },
      ],
      links: [
        {
          label: 'Query profile',
          url: 'https://docs.databricks.com/aws/en/sql/user/queries/query-profile',
        },
      ],
    },
    {
      id: 'roundtrip',
      heading: 'Python with pandas, kept small',
      prose:
        'pandas runs on one machine, so aggregate in Spark first and collect only the result. Reshape it, then write it back to Unity Catalog so others can query it. When the data is too large to collect, the pandas API on Spark keeps the pandas syntax and runs the work distributed.',
      diagram: {
        type: 'flow',
        title: 'SQL to pandas and back',
        description:
          'A Spark SQL query aggregates revenue by region and month. toPandas collects the small result. pandas pivots it and adds a rolling mean. createDataFrame writes the result to a governed table.',
        nodes: [
          { id: 'query', label: 'Spark SQL', sub: 'aggregate first', col: 0, row: 0 },
          { id: 'pandas', label: 'toPandas()', mono: true, sub: 'a small result', col: 1, row: 0 },
          { id: 'shape', label: 'pandas', sub: 'pivot, rolling, growth', col: 2, row: 0, kind: 'highlight' },
          { id: 'write', label: 'createDataFrame()', mono: true, sub: 'saveAsTable', col: 3, row: 0 },
          { id: 'table', label: 'Unity Catalog table', sub: 'shared and governed', col: 3, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'query', to: 'pandas' },
          { from: 'pandas', to: 'shape' },
          { from: 'shape', to: 'write' },
          { from: 'write', to: 'table' },
        ],
        legend: [{ kind: 'highlight', label: 'Runs on the driver' }],
      },
      steps: [
        {
          title: 'Collect',
          body: 'Aggregate in Spark first so only a few hundred rows reach pandas.',
        },
        {
          title: 'Reshape',
          body: 'Pivot by region, then add a rolling mean and growth columns.',
          code: 'wide = monthly.pivot(index="month", columns="region", values="revenue")\nrolling = wide.rolling(3).mean().add_suffix("_3mo_avg")',
        },
        {
          title: 'Write back',
          body: 'Spark takes the pandas frame and saves a governed table.',
        },
      ],
      examples: [
        {
          label: 'Stay distributed with the pandas API on Spark',
          language: 'py',
          code: 'import pyspark.pandas as ps\n\norders = ps.read_table("main.sales.orders")\nrevenue = (orders.quantity * orders.unit_price).groupby(orders.status).sum()',
          notes: ['The code looks like pandas, but Spark runs it across the cluster, so the data does not have to fit on one machine.'],
        },
      ],
      options: {
        caption: 'Doing Python work on query results',
        rows: [
          {
            option: 'Aggregate in Spark, then toPandas',
            when: 'The result is small enough for the driver, such as a few hundred or a few thousand rows.',
            tradeoffs: 'You get the full pandas and plotting ecosystem. The collected result has to fit in driver memory, so aggregate first. Databricks uses Arrow to speed the conversion.',
          },
          {
            option: 'pandas API on Spark',
            when: 'You want pandas syntax on data too large to collect.',
            tradeoffs: 'The work runs distributed, so the data does not have to fit on one machine. Not every pandas function is available, and some behavior differs, so test a port before you rely on it.',
          },
          {
            option: 'Spark SQL or DataFrames only',
            when: 'The whole analysis fits in SQL or DataFrame operations.',
            tradeoffs: 'Scales with no conversion and keeps the work on the warehouse or cluster. Reshaping and statistics take more code, and fewer plotting libraries apply.',
          },
        ],
        recommendation: 'Aggregate in Spark and use toPandas for small results. Use the pandas API on Spark when the data will not fit on the driver.',
      },
      links: [
        {
          label: 'Pandas API on Spark',
          url: 'https://docs.databricks.com/aws/en/pandas/pandas-on-spark',
        },
        {
          label: 'Convert between PySpark and pandas DataFrames',
          url: 'https://docs.databricks.com/aws/en/pandas/pyspark-pandas-conversion',
          note: 'Arrow and conversion settings.',
        },
      ],
    },
    {
      id: 'scale',
      heading: 'Keep large queries fast',
      prose:
        'Serverless SQL and Spark scale out on their own, so most of the speedup comes from how the data is laid out and how the query is written.',
      points: [
        {
          strong: 'Cluster the tables you filter and join on.',
          text: 'Liquid clustering replaces partitioning and Z-ordering. CLUSTER BY AUTO lets Databricks choose the keys.',
        },
        {
          strong: 'Turn on predictive optimization.',
          text: 'It compacts files and runs maintenance on managed tables.',
        },
        {
          strong: 'Select only the columns you need.',
          text: 'Columnar storage reads only the columns you name, and filters on clustered columns skip files.',
        },
        {
          strong: 'Size the warehouse for the slowest query, scale clusters for the crowd.',
          text: 'A larger size speeds one query. More clusters help many users at once.',
        },
        {
          strong: 'Cache results with materialized views.',
          text: 'For a heavy aggregate that many people read, build a materialized view and query that.',
        },
      ],
      links: [
        {
          label: 'Liquid clustering',
          url: 'https://docs.databricks.com/aws/en/delta/clustering',
        },
      ],
    },
    {
      id: 'r',
      heading: 'R on Databricks',
      points: [
        {
          strong: 'Serverless does not run R.',
          text: 'Serverless notebooks and jobs run Python and SQL. Hosted RStudio on Databricks is end-of-life.',
        },
        {
          strong: 'Bring your own R IDE.',
          text: 'Run RStudio Desktop or Posit Workbench on your side and use sparklyr through Databricks Connect, which Posit supports, to run Spark work on a Databricks cluster.',
        },
        {
          strong: 'Query a SQL warehouse with ODBC.',
          text: 'From any R session, odbc::databricks() reads Unity Catalog tables on a serverless SQL warehouse with OAuth. It suits data pulls and dplyr queries.',
        },
        {
          strong: 'Use sparklyr, not SparkR, in notebooks.',
          text: 'R notebooks run on classic compute. SparkR is deprecated on Databricks Runtime 16 and above, so write new code with sparklyr.',
        },
        {
          strong: 'Same governed tables.',
          text: 'Every path reads the same Unity Catalog tables, so permissions apply unchanged.',
        },
      ],
      options: {
        caption: 'How to work in R against Databricks',
        rows: [
          {
            option: 'RStudio or Posit Workbench with sparklyr over Databricks Connect',
            when: 'Spark-scale work from your own R IDE.',
            tradeoffs: 'Spark runs on a Databricks cluster while you stay in your IDE. The integration is provided by the sparklyr project and supported through the Posit community, not directly by Databricks. Connect supports the DataFrame API only, so MLlib has limited compatibility.',
          },
          {
            option: 'odbc::databricks() against a SQL warehouse',
            when: 'Data pulls and dplyr queries from any R session.',
            tradeoffs: 'Reads Unity Catalog tables on a serverless SQL warehouse with OAuth, with no cluster to manage. Results come into your local R session, so aggregate in SQL first, and you do not get the Spark DataFrame API.',
          },
          {
            option: 'An R notebook on classic compute with sparklyr',
            when: 'You want to work inside the workspace.',
            tradeoffs: 'No local setup. R runs on classic compute only, since serverless does not run R. SparkR is deprecated on Databricks Runtime 16 and above, so write new code with sparklyr.',
          },
        ],
        recommendation: 'Use odbc for pulling governed data into a local R session. Use sparklyr, through Databricks Connect or a classic compute notebook, when the work needs Spark.',
      },
      links: [
        {
          label: 'Databricks for R developers',
          url: 'https://docs.databricks.com/aws/en/sparkr/',
        },
        {
          label: 'Databricks Connect for R',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-connect/r/',
        },
        {
          label: 'Databricks ODBC driver',
          url: 'https://docs.databricks.com/aws/en/integrations/odbc/',
          note: 'Driver setup for odbc::databricks().',
        },
      ],
    },
  ],
  related: [
    { slug: 'bring-your-own-data', title: 'Bring your own data' },
    { slug: 'in-platform-visualization', title: 'Charts and dashboards in the platform' },
    { slug: 'local-tool-connectivity', title: 'Connecting local tools' },
  ],
};
