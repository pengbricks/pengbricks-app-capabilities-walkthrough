import type { Faq } from './types.ts';

const TYPES = {
  label: 'SQL warehouse types',
  url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/warehouse-types',
};
const SIZING = {
  label: 'SQL warehouse sizing, scaling, and queuing behavior',
  url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/warehouse-behavior',
};
const CREATE = {
  label: 'Create a SQL warehouse',
  url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/create',
};
const SETUP = {
  label: 'Set up serverless SQL warehouses',
  url: 'https://docs.databricks.com/aws/en/admin/sql/serverless',
};
const NETWORK = {
  label: 'Serverless compute plane networking',
  url: 'https://docs.databricks.com/aws/en/security/network/serverless-network-security/',
};

export const faqs: Faq[] = [
  {
    question: 'Which warehouse type do I get by default, and how do I set it?',
    answer:
      'In the UI, serverless is the default wherever the workspace meets the serverless requirements. The SQL warehouses API defaults to classic, so a warehouse created from a script or Terraform with default parameters is classic. To get serverless through the API, set enable_serverless_compute to true and warehouse_type to PRO. The docs recommend always setting both fields, which matters most for organizations with many workspaces. An account admin may need to accept the serverless terms first.',
    links: [
      TYPES,
      CREATE,
      SETUP,
      { label: 'Warehouses API: edit', url: 'https://docs.databricks.com/api/workspace/warehouses/edit' },
    ],
  },
  {
    question: 'What are Photon, Predictive IO and Intelligent Workload Management?',
    answer:
      "Photon is the built-in vectorized query engine, and all three warehouse types have it. Predictive IO is a set of features that speed up selective scans, and pro and serverless include it. Intelligent Workload Management (IWM) uses machine learning to predict each query's resource needs, admit queries as soon as capacity exists and scale clusters up and down quickly. IWM is serverless only.",
    links: [TYPES, SIZING],
  },
  {
    kind: 'decision',
    question: 'Which warehouse type should I use for BI dashboards?',
    answer:
      'Use a serverless warehouse. The docs list business intelligence among the workloads serverless handles well, and IWM suits dashboard traffic that spikes when many people open reports at once. Start with one larger warehouse and raise the maximum cluster count if queries queue. Use pro only when serverless is unavailable in your region or the warehouse must connect through your own network.',
    links: [TYPES, SIZING],
  },
  {
    kind: 'decision',
    question: 'Which warehouse type should I use for ETL written in SQL?',
    answer:
      'Use serverless, which the docs list for ETL alongside BI and exploration. If the SQL creates materialized views or streaming tables, the warehouse must be pro or serverless, because classic cannot create them. Refreshes then run on a serverless pipeline that is separate from the warehouse, and the warehouse only coordinates the operation. Keep individual statements well under 24 hours, since the docs recycle warehouse clusters after that.',
    links: [
      TYPES,
      {
        label: 'CREATE MATERIALIZED VIEW',
        url: 'https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-create-materialized-view',
      },
      { label: 'Materialized views', url: 'https://docs.databricks.com/aws/en/ldp/dbsql/materialized' },
    ],
  },
  {
    kind: 'decision',
    question: 'Which warehouse type do AI Functions and Genie Agents need?',
    answer:
      'Use a serverless warehouse for both. The AI Functions docs say these functions are not available on classic SQL warehouses. A Genie Agent requires a pro or serverless warehouse, and the Genie docs recommend serverless for best performance. Pro is the fallback when serverless is not an option, but check the AI Functions page for the function you plan to call.',
    links: [
      { label: 'AI Functions', url: 'https://docs.databricks.com/aws/en/large-language-models/ai-functions' },
      { label: 'Set up a Genie Agent', url: 'https://docs.databricks.com/aws/en/genie/set-up' },
    ],
  },
  {
    kind: 'decision',
    question: 'When does a classic warehouse or classic compute still make sense?',
    answer:
      'For SQL, classic fits interactive exploration where entry-level performance and a 4-minute cold start are acceptable, and the docs steer new warehouses to serverless first. For notebooks and jobs, use classic compute when a workload needs a specific runtime, instance type, or network setup that rules serverless out. Then you own sizing, autoscaling bounds, auto-termination, and policies, so run production work on job compute that exists only for the run.',
    links: [
      TYPES,
      {
        label: 'Serverless compute limitations',
        url: 'https://docs.databricks.com/aws/en/compute/serverless/limitations',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'Serverless or pro: which should I pick when network or compliance rules apply?',
    answer:
      'Pick pro when the warehouse must sit inside your own network, for example to reach databases in your VPC or on premises for federation or a hybrid design. The docs name custom-defined networking as a reason to choose pro. Serverless can still reach private resources through network connectivity configurations (NCCs) and private endpoints, so check that page before ruling it out.',
    links: [TYPES, NETWORK, SETUP],
  },
  {
    kind: 'decision',
    question: 'A warehouse is slow. Should I make it bigger or add clusters?',
    answer:
      'Match the change to the symptom. If queries spill to disk or one query is slow, scale up. If Peak Queued Queries stays above zero, raise max_num_clusters. If dashboards wait behind a batch job, give each workload its own warehouse. On pro and classic, plan for about one cluster per 10 concurrent queries. On serverless, start with one larger warehouse and size down.',
    links: [SIZING],
  },
  {
    kind: 'decision',
    question: 'If I pick a serverless warehouse, should notebooks, jobs and pipelines also use serverless compute?',
    answer:
      'Decide them separately. The serverless compute docs list serverless SQL warehouses as a feature that is set up independently of serverless notebooks, jobs and pipelines. Notebooks default to serverless compute in Unity Catalog workspaces, and a notebook can also attach to a SQL warehouse for SQL cells. Standalone materialized views and streaming tables refresh on serverless pipelines whichever warehouse created them.',
    links: [
      { label: 'Connect to serverless compute', url: 'https://docs.databricks.com/aws/en/compute/serverless/' },
      { label: 'Notebook compute resources', url: 'https://docs.databricks.com/aws/en/notebooks/notebook-compute' },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What does a pro warehouse lack compared with serverless?',
    answer:
      'Pro lacks Intelligent Workload Management, so it reacts more slowly to swings in query demand and cannot autoscale as fast. It takes about 4 minutes to start, against 2 to 6 seconds on serverless, and it autoscales after 2 to 6 minutes of estimated load. In return, the compute sits in your AWS account, which lets it use your own networking.',
    links: [TYPES, SIZING],
  },
  {
    kind: 'tradeoff',
    question: 'What control do I give up for managed infrastructure on serverless?',
    answer:
      'Databricks manages capacity, patching and upgrades, so you give up some infrastructure control. Cluster policies, including spot instance policies, are not supported on serverless warehouses. Serverless warehouses do not use customer-managed keys for EBS storage encryption, and they cannot run in a workspace that uses a legacy external Hive metastore or S3 access policies. The CPU architecture is not selectable and can change between restarts, which can break Unity Catalog Python UDFs that use platform-specific wheels.',
    links: [SETUP, TYPES],
  },
  {
    question: 'Do compute policies apply to serverless?',
    answer:
      'No. Compute policies govern classic compute only. On serverless, cluster policies, pools, and compute-scoped init scripts do not apply, and usage policies and budgets control spend instead.',
    links: [{ label: 'Compute policies', url: 'https://docs.databricks.com/aws/en/admin/clusters/policies' }],
  },
  {
    question: 'How do I charge costs back to teams on a shared warehouse?',
    answer:
      'Use query tags (generally available). Attach key-value pairs such as team, app, and cost_center to SQL workloads, and they appear in system.query.history. Never put personal or sensitive values in tags, because tag data is plain text and can be replicated.',
    links: [{ label: 'Query tags', url: 'https://docs.databricks.com/aws/en/sql/user/queries/query-tags' }],
  },
  {
    question: 'What does the Performance optimized setting do for serverless jobs?',
    answer:
      'Off, a job runs in standard mode, which uses fewer DBUs and tolerates a 4 to 6 minute startup. On, it starts and runs faster, which suits time-sensitive work.',
    links: [
      { label: 'Serverless compute for jobs', url: 'https://docs.databricks.com/aws/en/jobs/run-serverless-jobs' },
    ],
  },
];
