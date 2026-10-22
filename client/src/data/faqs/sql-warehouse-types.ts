import type { Faq } from './types.ts';

const TYPES = {
  label: 'SQL warehouse types',
  url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/warehouse-types',
};
const OVERVIEW = {
  label: 'Connect to a SQL warehouse',
  url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/',
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
    question: 'What are the three SQL warehouse types, and how do they differ?',
    answer:
      'Databricks SQL offers serverless, pro and classic warehouses. All three run the Photon engine. Pro adds Predictive IO, and serverless adds Intelligent Workload Management (IWM) on top of that. Classic and pro warehouses run in your own AWS account and take about 4 minutes to start, while serverless warehouses run in the Databricks account and typically start in 2 to 6 seconds.',
    links: [TYPES, OVERVIEW],
  },
  {
    question: 'Which warehouse type is the default?',
    answer:
      'In the UI, serverless is the default wherever the workspace meets the serverless requirements. The SQL warehouses API defaults to classic, so a warehouse created from a script or Terraform with default parameters is classic. To get serverless through the API, set enable_serverless_compute to true and warehouse_type to PRO. The docs recommend always setting both fields to avoid ambiguity, which matters most for organizations with many workspaces.',
    links: [TYPES, { label: 'Warehouses API: edit', url: 'https://docs.databricks.com/api/workspace/warehouses/edit' }],
  },
  {
    question: 'How do I pick or change the type of a SQL warehouse?',
    answer:
      'Pick the type in the Type setting when you create a warehouse in the UI. If serverless is enabled in your account, it is preselected. Through the API, the create and edit calls take the same two fields: warehouse_type (PRO or CLASSIC) and enable_serverless_compute. Before you can create a serverless warehouse, an account admin may need to accept the serverless terms in the account console.',
    links: [
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
      'Use a serverless warehouse. The docs list business intelligence among the workloads serverless handles well, and IWM suits dashboard traffic that spikes when many people open reports at once. Start with one larger warehouse and raise the maximum cluster count if queries queue. Use a pro warehouse only when serverless is unavailable in your region or the warehouse must connect through your own network.',
    links: [TYPES, SIZING],
  },
  {
    kind: 'decision',
    question: 'Which warehouse type should I use for ad hoc and exploratory SQL?',
    answer:
      'Use serverless. Exploratory use is bursty, with long gaps between queries, so quick startup and a short auto-stop matter more than steady throughput. The docs list exploratory analysis as a good fit and give 2 to 6 seconds as the typical serverless start time. A classic warehouse works for interactive exploration with entry-level performance, but each cold start takes about 4 minutes.',
    links: [TYPES, CREATE],
  },
  {
    kind: 'decision',
    question: 'Which warehouse type should I use for ETL written in SQL?',
    answer:
      'Use serverless, which the docs list for ETL alongside BI and exploration. If the SQL creates materialized views or streaming tables, the warehouse must be pro or serverless, because the CREATE MATERIALIZED VIEW reference says these objects cannot be created on classic. Refreshes then run on a serverless pipeline that is separate from the warehouse, and the warehouse only coordinates the operation. Keep individual statements well under 24 hours, since the docs recycle warehouse clusters after that.',
    links: [
      TYPES,
      {
        label: 'CREATE MATERIALIZED VIEW',
        url: 'https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-create-materialized-view',
      },
      { label: 'Materialized views', url: 'https://docs.databricks.com/aws/en/ldp/dbsql/materialized' },
      CREATE,
    ],
  },
  {
    kind: 'decision',
    question: 'Which warehouse type do AI Functions and Genie Agents need?',
    answer:
      'Use a serverless warehouse for both. The AI Functions docs say these functions are not available on classic SQL warehouses. A Genie Agent requires a pro or serverless warehouse, and the Genie docs recommend serverless for best performance. A pro warehouse is the fallback when serverless is not an option, but check the AI Functions page for the function you plan to call.',
    links: [
      { label: 'AI Functions', url: 'https://docs.databricks.com/aws/en/large-language-models/ai-functions' },
      { label: 'Set up a Genie Agent', url: 'https://docs.databricks.com/aws/en/genie/set-up' },
    ],
  },
  {
    kind: 'decision',
    question: 'When does a classic SQL warehouse still make sense?',
    answer:
      'Choose classic for interactive queries with entry-level performance, where a 4-minute cold start and no Predictive IO or IWM are acceptable. The docs position it for data exploration with core Databricks SQL features and call its performance lower than pro or serverless. For new warehouses, the docs steer you to serverless first. If you rely on features such as AI Functions or materialized views, classic cannot run them.',
    links: [TYPES],
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
    question: 'How should I size and scale a serverless warehouse?',
    answer:
      'Start with a single larger warehouse and let serverless manage concurrency, because it is usually more efficient to size down than to start small and scale up. Increase the cluster size if queries spill to disk in the query profile. Set the maximum number of clusters high enough for peak load, and watch the Peak Queued Queries metric on the monitoring tab. A value that stays above zero means the warehouse needs a larger size or more clusters.',
    links: [SIZING],
  },
  {
    kind: 'decision',
    question: 'How should I size and scale a pro or classic warehouse?',
    answer:
      'Plan for one cluster per 10 concurrent queries, which the docs give as a fixed limit for these types, and set the minimum and maximum cluster counts yourself. Autoscaling adds a cluster after 2 to 6 minutes of estimated query load and also scales up when a query waits in the queue for 5 minutes. It scales down after 15 consecutive minutes of low load. That reaction time is why a bursty workload tends to feel slower on pro or classic than on serverless.',
    links: [SIZING, CREATE],
  },
  {
    kind: 'decision',
    question: 'If I pick a serverless warehouse, should notebooks, jobs and pipelines also use serverless compute?',
    answer:
      'Decide them separately. The two are configured on different paths, and the serverless compute docs list serverless SQL warehouses as a feature that is set up independently of serverless notebooks, jobs and pipelines. Notebooks default to serverless compute in Unity Catalog workspaces, and a notebook can also attach to a SQL warehouse for SQL cells. Standalone materialized views and streaming tables refresh on serverless pipelines whichever warehouse created them.',
    links: [
      { label: 'Connect to serverless compute', url: 'https://docs.databricks.com/aws/en/compute/serverless/' },
      { label: 'Notebook compute resources', url: 'https://docs.databricks.com/aws/en/notebooks/notebook-compute' },
      { label: 'Materialized views', url: 'https://docs.databricks.com/aws/en/ldp/dbsql/materialized' },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What does a classic warehouse lack compared with pro?',
    answer:
      'Classic lacks Predictive IO, so selective scans get no speedup, and the docs call its performance entry-level. It also cannot run some newer features. AI Functions are unavailable on classic, materialized views and streaming tables need pro or serverless, and a view that contains a Unity Catalog Python UDF fails on classic warehouses. The 5X-Large size is in Public Preview for pro and serverless only.',
    links: [
      TYPES,
      { label: 'AI Functions', url: 'https://docs.databricks.com/aws/en/large-language-models/ai-functions' },
      { label: 'Unity Catalog Python UDFs', url: 'https://docs.databricks.com/aws/en/udf/unity-catalog' },
      SIZING,
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What does a pro warehouse lack compared with serverless?',
    answer:
      'Pro lacks Intelligent Workload Management, so it reacts more slowly to swings in query demand and cannot autoscale as fast. It takes about 4 minutes to start, against 2 to 6 seconds on serverless. In return, the compute sits in your AWS account, which lets it use your own networking. Pro and serverless both support Predictive IO, materialized views and Genie Agents.',
    links: [TYPES, SIZING],
  },
  {
    kind: 'tradeoff',
    question: 'What changes on serverless for network access and customer-managed VPCs?',
    answer:
      'Customer-managed VPCs do not apply to serverless warehouse compute, because the compute runs in the Databricks serverless plane and has no public IP addresses. You control outbound access to your resources through network connectivity configurations (NCCs), private endpoints and firewall rules on the resource side. Databricks charges for networking when serverless workloads connect to customer resources, and the private connectivity features are in private preview. Plan this work before you move a warehouse that reads from private databases.',
    links: [SETUP, NETWORK],
  },
  {
    kind: 'tradeoff',
    question: 'How do startup time and idle cost trade off across the types?',
    answer:
      'Serverless starts in 2 to 6 seconds, so you can set a short auto-stop and let it stop often. Classic and pro take about 4 minutes to start and default to a 45-minute auto-stop. Idle warehouses keep accruing DBU and cloud instance charges until they stop, which makes that idle window the main cost lever on classic and pro.',
    links: [TYPES, CREATE],
  },
  {
    kind: 'tradeoff',
    question: 'How do the cost model and auto-stop settings differ by type?',
    answer:
      'Pro and classic warehouses default to a 45-minute auto-stop with a 10-minute minimum, and idle time accrues DBU and cloud instance charges. Serverless defaults to 10 minutes, with a 5-minute minimum in the UI and 1 minute through the API. Serverless compute runs in the Databricks account, so you do not provision instances in yours, but private connectivity and cross-region transfer can add network charges. Compare current rates on the Databricks SQL pricing page, since this FAQ does not quote prices.',
    links: [
      CREATE,
      NETWORK,
      { label: 'Databricks SQL pricing', url: 'https://www.databricks.com/product/pricing/databricks-sql' },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What control do I give up for managed infrastructure on serverless?',
    answer:
      'Databricks manages capacity, patching and upgrades, so you give up some infrastructure control. Cluster policies, including spot instance policies, are not supported on serverless warehouses. Serverless warehouses do not use customer-managed keys for EBS storage encryption, and they cannot run in a workspace that uses a legacy external Hive metastore or S3 access policies. The CPU architecture is not selectable and can change between restarts, which can break Unity Catalog Python UDFs that use platform-specific wheels.',
    links: [SETUP, TYPES],
  },
  {
    question: 'What does Databricks say about the future of each warehouse type?',
    answer:
      'The docs recommend serverless wherever it is available, and the UI defaults to it (SQL warehouse types page, updated September 11, 2026; sizing page, updated October 8, 2026). They give no retirement or deprecation date for pro or classic, and the release notes searched through October 21, 2026 contain no such notice. Pro remains the documented choice when serverless is unavailable or custom networking is needed, and classic is described as entry-level. Lakehouse Real-Time, a serverless warehouse type for sub-second read queries, is in Beta.',
    links: [
      TYPES,
      SIZING,
      {
        label: 'September 2026 release notes',
        url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/september',
      },
    ],
  },
];
