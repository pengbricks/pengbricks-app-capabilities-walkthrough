import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'compute-capacity-management',
  area: 'Governance/Monitoring',
  title: 'Compute and capacity management',
  intro:
    'Start with serverless. Serverless SQL warehouses, jobs, and notebooks start in seconds, scale themselves, and leave you few settings to get wrong. You still choose a warehouse type (serverless, pro, or classic), a size, a maximum cluster count, a performance mode, and how to split workloads across warehouses. Pro and classic warehouses and classic compute remain for workloads that need them, and they need more tuning. This page covers the serverless defaults, what each SQL warehouse type offers and lacks, how to size and isolate warehouses, how to tag queries, the classic controls, and how to read capacity from system tables.',
  businessValue: {
    summary:
      'Platform owners want fast queries and predictable spend without tuning clusters. Start on serverless, pick the SQL warehouse type per workload, then size and separate warehouses so dashboards stay quick and each workload has its own cost line.',
    outcomes: [
      {
        title: 'Less compute to administer',
        body: 'Serverless SQL warehouses, jobs, and notebooks start in seconds and scale themselves. Platform teams have fewer cluster settings to tune and fewer idle clusters to chase.',
      },
      {
        title: 'The right warehouse type, once',
        body: 'Knowing what serverless, pro, and classic each run avoids a rebuild later. AI Functions, materialized views, and Genie Agents need serverless or pro, and a script that creates a warehouse through the API gets classic unless it says otherwise.',
      },
      {
        title: 'Dashboards protected from heavy jobs',
        body: 'One warehouse per workload keeps an ETL run from queuing a BI dashboard. Business users see consistent response times at the busy hours.',
      },
      {
        title: 'Spend traced to teams',
        body: 'Query tags on shared warehouses and one warehouse per workload give finance a cost line for each team or application. system.query.history also shows how long queries waited, so admins raise the cluster count where users queue instead of guessing.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Serverless SQL warehouses by default.',
      body: "Intelligent Workload Management predicts each query's needs, admits it when capacity exists, and adds clusters when the queue grows.",
    },
    {
      title: 'Pro for custom networking, classic for little.',
      body: 'Pro keeps compute in your AWS account and drops Intelligent Workload Management. Classic also drops Predictive IO and cannot run AI Functions or materialized views. Through the API, set warehouse_type and enable_serverless_compute yourself, because the API default is classic.',
    },
    {
      title: 'Serverless jobs and notebooks for the rest.',
      body: 'No cluster to configure. Pick a performance mode per job: optimized for time-sensitive work, standard for lower cost.',
    },
    {
      title: 'Scale up for heavy queries, out for many users.',
      body: 'A bigger size helps a single query that spills. A higher maximum cluster count helps concurrency.',
    },
    {
      title: 'One warehouse per workload.',
      body: 'Separate BI, ETL, and ad hoc work so a heavy job cannot queue a dashboard, and so each has its own cost line and settings.',
    },
    {
      title: 'Tag queries and watch the queue.',
      body: 'Query tags attribute cost to teams. system.query.history shows how long queries waited for capacity.',
    },
  ],
  sections: [
    {
      id: 'serverless',
      heading: 'Serverless first',
      points: [
        {
          strong: 'Serverless SQL warehouses.',
          text: "Intelligent Workload Management (IWM) uses machine learning to predict a query's resources, start it at once when capacity exists, queue it when it does not, and provision more clusters quickly when waits grow. It scales back down to save cost. Databricks recommends serverless for most workloads.",
        },
        {
          strong: 'Serverless jobs.',
          text: 'Lakeflow Jobs tasks run on managed compute with autoscaling and Photon on. The Performance optimized setting trades cost for startup time. Off, a job uses standard mode, which uses fewer DBUs and tolerates a 4 to 6 minute startup. On, it starts and runs faster for time-sensitive work.',
        },
        {
          strong: 'Serverless notebooks.',
          text: 'Interactive compute that connects in seconds. Admins can set a default environment and a default execution timeout so a forgotten query does not run all night.',
        },
        {
          strong: 'A serverless warehouse is a separate choice from serverless notebooks, jobs, and pipelines.',
          text: 'Warehouse type is set on the warehouse. Notebooks, jobs, and pipelines pick their own compute, and the serverless docs list serverless SQL warehouses as set up independently of them. Notebooks default to serverless compute in Unity Catalog workspaces and can attach to a SQL warehouse for SQL cells. Standalone materialized views and streaming tables refresh on serverless pipelines whichever warehouse created them.',
        },
      ],
      links: [
        {
          label: 'Set up serverless SQL warehouses',
          url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/serverless',
        },
        {
          label: 'Sizing, scaling, and queuing behavior',
          url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/warehouse-behavior',
        },
        { label: 'Serverless compute for jobs', url: 'https://docs.databricks.com/aws/en/jobs/run-serverless-jobs' },
        {
          label: 'Best practices for serverless compute',
          url: 'https://docs.databricks.com/aws/en/compute/serverless/best-practices',
        },
      ],
    },
    {
      id: 'warehouse-types',
      heading: 'SQL warehouse types: Classic, Pro and Serverless',
      prose:
        'Databricks SQL offers three warehouse types. All three run Photon. Pro adds Predictive IO, and serverless adds Intelligent Workload Management (IWM) on top. The type also decides where the compute runs, so it decides what networking you can use.',
      diagram: {
        type: 'matrix',
        title: 'What each SQL warehouse type includes',
        description:
          'A matrix of ten features across classic, pro, and serverless SQL warehouses. Serverless includes all of them, pro lacks Intelligent Workload Management, and classic also lacks Predictive IO, AI Functions, materialized views, streaming tables, Genie Agents, Unity Catalog Python UDFs in views, and 5X-Large.',
        corner: 'Feature',
        columns: ['Classic', 'Pro', 'Serverless'],
        rows: [
          {
            label: 'Where compute runs',
            cells: [
              {
                state: 'optional',
                text: 'Your AWS account',
                detail: 'The compute layer sits in your AWS account, so you can use your own networking.',
              },
              {
                state: 'optional',
                text: 'Your AWS account',
                detail: 'The compute layer sits in your AWS account, so you can use your own networking.',
              },
              {
                state: 'own',
                text: 'Databricks account',
                detail:
                  'Compute runs in the Databricks serverless plane. Network access to your resources goes through NCCs and private endpoints.',
              },
            ],
          },
          {
            label: 'Start time',
            cells: [
              {
                state: 'none',
                text: 'About 4 min',
                detail: 'Docs: several minutes, typically approximately 4 minutes.',
              },
              {
                state: 'none',
                text: 'About 4 min',
                detail: 'Docs: several minutes, typically approximately 4 minutes.',
              },
              { state: 'own', text: '2 to 6 s', detail: 'Docs: typically between 2 and 6 seconds.' },
            ],
          },
          {
            label: 'Photon',
            cells: [
              { state: 'own', text: 'Yes' },
              { state: 'own', text: 'Yes' },
              { state: 'own', text: 'Yes' },
            ],
          },
          {
            label: 'Predictive IO',
            cells: [
              {
                state: 'none',
                text: 'No',
                detail: 'Docs: classic gives entry-level performance, with no Predictive IO to speed selective scans.',
              },
              { state: 'own', text: 'Yes' },
              { state: 'own', text: 'Yes' },
            ],
          },
          {
            label: 'Intelligent Workload Management',
            cells: [
              { state: 'none', text: 'No' },
              {
                state: 'none',
                text: 'No',
                detail:
                  'Docs: without IWM, a pro warehouse is less responsive to swings in demand and cannot autoscale as rapidly.',
              },
              { state: 'own', text: 'Yes' },
            ],
          },
          {
            label: 'AI Functions',
            cells: [
              {
                state: 'none',
                text: 'No',
                detail: 'The AI Functions docs say these functions are not available on classic SQL warehouses.',
              },
              {
                state: 'optional',
                text: 'Check the function',
                detail: 'Confirm the specific function on the AI Functions page before you rely on pro.',
              },
              { state: 'own', text: 'Yes' },
            ],
          },
          {
            label: 'Materialized views and streaming tables',
            cells: [
              {
                state: 'none',
                text: 'No',
                detail: 'The CREATE MATERIALIZED VIEW reference says these cannot be created on classic.',
              },
              { state: 'own', text: 'Yes' },
              { state: 'own', text: 'Yes' },
            ],
          },
          {
            label: 'Genie Agents',
            cells: [
              { state: 'none', text: 'No' },
              { state: 'own', text: 'Yes' },
              {
                state: 'own',
                text: 'Recommended',
                detail:
                  'A Genie Agent needs pro or serverless, and the Genie docs recommend serverless for best performance.',
              },
            ],
          },
          {
            label: 'UC Python UDFs in views',
            cells: [
              {
                state: 'none',
                text: 'Fails',
                detail: 'A view that contains a Unity Catalog Python UDF fails on classic warehouses.',
              },
              { state: 'own', text: 'Yes' },
              { state: 'own', text: 'Yes' },
            ],
          },
          {
            label: '5X-Large size',
            cells: [
              { state: 'none', text: 'No' },
              {
                state: 'optional',
                text: 'Public Preview',
                detail: 'The 5X-Large size is in Public Preview for pro and serverless warehouses.',
              },
              {
                state: 'optional',
                text: 'Public Preview',
                detail: 'The 5X-Large size is in Public Preview for pro and serverless warehouses.',
              },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Included' },
          { state: 'optional', label: 'Depends or in preview' },
          { state: 'none', label: 'Not available' },
        ],
        caption:
          'Source: SQL warehouse types, last updated September 11, 2026, plus the AI Functions, materialized view, Genie, and Unity Catalog UDF docs.',
      },
      options: {
        caption: 'Which warehouse type to use',
        rows: [
          {
            option: 'Serverless: BI and dashboards',
            when: 'Report traffic spikes when many people open dashboards at once.',
            tradeoffs:
              'IWM admits queries as capacity allows and adds clusters quickly. Compute runs in the Databricks account, so private data sources need NCC and private endpoint setup.',
          },
          {
            option: 'Serverless: ad hoc SQL',
            when: 'Use is bursty with long gaps between queries.',
            tradeoffs:
              'A 2 to 6 second start lets you keep auto-stop short. Classic would work with a roughly 4 minute cold start and entry-level performance.',
          },
          {
            option: 'Serverless: SQL ETL, AI Functions, Genie',
            when: 'SQL creates materialized views or streaming tables, calls AI Functions, or backs a Genie Agent.',
            tradeoffs:
              'Classic cannot run the first two, and Genie needs pro or serverless. Keep single statements well under 24 hours, because warehouse clusters recycle after that.',
          },
          {
            option: 'Pro',
            when: 'Serverless is unavailable in your region, or the warehouse must sit in your own network to reach databases for federation or a hybrid design.',
            tradeoffs:
              'Keeps Predictive IO and materialized views, but starts in about 4 minutes and has no IWM, so it reacts slowly to demand swings. You also own the cluster count.',
          },
          {
            option: 'Classic',
            when: 'Interactive exploration where entry-level performance and a 4 minute cold start are acceptable.',
            tradeoffs:
              'The lowest cost of entry and the fewest features. No Predictive IO, IWM, AI Functions, materialized views, or Genie Agents.',
          },
        ],
        recommendation:
          'Default to serverless. Choose pro when serverless is unavailable or you need custom networking into your own network, and classic only for light exploration. Check NCC and private endpoint needs before you move a warehouse that reads private databases.',
      },
      points: [
        {
          strong: 'Classic lacks.',
          text: 'Predictive IO and IWM, so selective scans get no speedup and the docs call performance entry-level. It also cannot run AI Functions, materialized views, streaming tables, or Genie Agents, and a view containing a Unity Catalog Python UDF fails on it.',
        },
        {
          strong: 'Pro lacks.',
          text: 'IWM. It reacts more slowly to swings in demand, cannot autoscale as fast, and takes about 4 minutes to start. In return the compute sits in your AWS account.',
        },
        {
          strong: 'Serverless networking.',
          text: 'Customer-managed VPCs do not apply to serverless warehouse compute. It runs in the Databricks serverless plane with no public IP addresses. You reach your resources through network connectivity configurations (NCCs), private endpoints, and firewall rules on the resource side. The private connectivity features are in private preview, and Databricks charges for networking when serverless workloads connect to customer resources.',
        },
        {
          strong: 'Serverless limits.',
          text: 'Cluster policies, including spot policies, are not supported. Serverless warehouses do not use customer-managed keys for EBS encryption and cannot run in a workspace that uses a legacy external Hive metastore. The CPU architecture can change between restarts, which can break Unity Catalog Python UDFs that use platform-specific wheels.',
        },
        {
          strong: 'UI and API defaults differ.',
          text: 'In the UI, serverless is the default where the workspace meets the requirements. The SQL warehouses API defaults to classic, so a script or Terraform with default parameters creates a classic warehouse. Databricks recommends always setting warehouse_type and enable_serverless_compute.',
        },
        {
          strong: 'What Databricks has said about the future.',
          text: 'The SQL warehouse types page (updated September 11, 2026) and the sizing page (updated October 8, 2026) recommend serverless where it is available. Neither gives a retirement or deprecation date for pro or classic, and the release notes through October 21, 2026 carry no such notice. Lakehouse Real-Time, a serverless warehouse type for sub-second read queries, is in Beta.',
        },
      ],
      examples: [
        {
          label: 'Create a serverless warehouse through the API',
          language: 'json',
          code: `POST /api/2.0/sql/warehouses
{
  "name": "bi-serverless",
  "cluster_size": "Medium",
  "min_num_clusters": 1,
  "max_num_clusters": 4,
  "auto_stop_mins": 10,
  "warehouse_type": "PRO",
  "enable_serverless_compute": true
}`,
          notes: [
            'Serverless needs both fields, warehouse_type PRO and enable_serverless_compute true. Set them even when you want pro or classic, so the type does not depend on defaults.',
            'In Terraform, databricks_sql_endpoint takes the same two arguments, warehouse_type and enable_serverless_compute.',
          ],
        },
      ],
      links: [
        {
          label: 'SQL warehouse types',
          url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/warehouse-types',
        },
        {
          label: 'Serverless compute plane networking',
          url: 'https://docs.databricks.com/aws/en/security/network/serverless-network-security/',
        },
        { label: 'AI Functions', url: 'https://docs.databricks.com/aws/en/large-language-models/ai-functions' },
        { label: 'Set up a Genie Agent', url: 'https://docs.databricks.com/aws/en/genie/set-up' },
        {
          label: 'Warehouses API: edit',
          url: 'https://docs.databricks.com/api/workspace/warehouses/edit',
        },
        {
          label: 'September 2026 release notes',
          url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/september',
        },
      ],
    },
    {
      id: 'sizing',
      heading: 'Size, scale, and isolate warehouses',
      prose:
        'Cluster size sets the resources for one cluster. The maximum number of clusters sets how far the warehouse scales out. Choose them for different problems.',
      points: [
        {
          strong: 'Start larger, then trim.',
          text: 'For serverless, Databricks suggests starting with one larger warehouse and sizing down. It is usually cheaper than starting small and scaling up.',
        },
        {
          strong: 'Set max_num_clusters for peak load.',
          text: 'On pro and classic warehouses, plan for one cluster per 10 concurrent queries.',
        },
        {
          strong: 'One warehouse per workload.',
          text: 'Separate warehouses give you separate queues, auto-stop, permissions, tags, and billing lines. Common splits are BI, ETL, ad hoc analysis, and each production app.',
        },
        {
          strong: 'Auto-stop defaults differ by type.',
          text: 'Pro and classic default to 45 minutes with a 10-minute minimum. Serverless defaults to 10 minutes, with a 5-minute minimum in the UI and 1 minute through the API. Idle warehouses keep accruing DBU and cloud instance charges until they stop, so shorten it.',
        },
        {
          strong: 'Cost model by type.',
          text: 'On pro and classic you pay DBUs plus the instances in your AWS account, and autoscaling adds a cluster after 2 to 6 minutes of estimated load. Scale-down comes after 15 consecutive minutes of low load. Serverless bills in the Databricks account with no instances in yours, though private connectivity and cross-region transfer can add network charges. Compare current rates on the Databricks SQL pricing page.',
        },
        {
          strong: 'Test with realistic load.',
          text: 'Run a representative burst of concurrent queries against a throwaway warehouse and read the wait columns before you set production sizes.',
        },
      ],
      options: {
        caption: 'What to change when a warehouse is slow or queued',
        rows: [
          {
            option: 'Scale up (larger cluster size)',
            when: 'Queries spill to disk, or one query is slow. Check bytes spilled in the query profile.',
            tradeoffs:
              'Each cluster has more resources, so a single heavy query finishes sooner. Each hour costs more DBUs while it runs, and it does not help queueing from many concurrent queries.',
          },
          {
            option: 'Scale out (raise max_num_clusters)',
            when: 'Peak Queued Queries stays above zero.',
            tradeoffs:
              'Adds clusters under concurrent load and removes them as load falls, so it targets waiting without making each query faster. Spend rises at peak. Plan for about one cluster per 10 concurrent queries on pro and classic warehouses.',
          },
          {
            option: 'Isolate (a warehouse per workload)',
            when: 'Dashboard queries wait behind a batch job.',
            tradeoffs:
              'Separate queues, auto-stop, permissions, tags, and billing lines. You run more warehouses, and each lightly used one can idle-bill, so merge the ones with low utilization.',
          },
        ],
        recommendation:
          'Match the change to the symptom. Spill or one slow query means scale up, queued queries mean scale out, and mixed workloads mean separate warehouses. When cost is high and utilization low, scale down, shorten auto-stop, and merge lightly used warehouses.',
      },
      links: [
        {
          label: 'Sizing, scaling, and queuing behavior',
          url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/warehouse-behavior',
        },
        { label: 'Create a SQL warehouse', url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/create' },
        { label: 'Databricks SQL pricing', url: 'https://www.databricks.com/product/pricing/databricks-sql' },
      ],
    },
    {
      id: 'tags',
      heading: 'Query tags for attribution',
      prose:
        'Query tags (generally available) are key-value pairs you attach to SQL workloads on SQL warehouses. They appear in system.query.history and the Query History page, so you can group, filter, and attribute cost without separate warehouses.',
      points: [
        {
          strong: 'Session or statement scope.',
          text: 'Set tags when you open a session with the query_tags parameter, or with SET QUERY_TAGS. Statement-level tags apply to one statement in the Python, Node.js, and Go connectors and the Statement Execution API.',
        },
        {
          strong: 'Pick keys once.',
          text: 'Agree on a few keys, such as team, app, and cost_center, and have each connector or BI tool set them. Tools such as dbt add their own tags.',
        },
        {
          strong: 'Keep secrets out.',
          text: 'Tag data is plain text and can be replicated, so never put personal or sensitive values in tags.',
        },
      ],
      links: [{ label: 'Query tags', url: 'https://docs.databricks.com/aws/en/sql/user/queries/query-tags' }],
    },
    {
      id: 'classic',
      heading: 'When you still use classic compute',
      prose:
        'Keep classic compute for workloads that need a specific runtime, instance type, or network setup. These controls apply only to it.',
      table: {
        columns: ['Control', 'Use'],
        rows: [
          [
            'Compute policies',
            'Limit node types, size, and runtime, set defaults, and require tags. They do not govern serverless.',
          ],
          ['Autoscaling', 'Set a minimum and maximum worker count so the cluster grows and shrinks with load.'],
          ['Auto-termination', 'Stop idle all-purpose clusters. Always set it.'],
          ['Pools', 'Keep warm instances to cut start time for jobs that start often.'],
          [
            'Photon',
            'Enable the vectorized engine for SQL and DataFrame work that fits it; it is on by default for serverless.',
          ],
          [
            'Job clusters',
            'Run production jobs on job compute that exists only for the run, not on all-purpose clusters.',
          ],
        ],
      },
      options: {
        caption: 'Serverless or classic for a workload',
        rows: [
          {
            option: 'Serverless',
            when: 'The workload runs on a supported environment and has no special runtime needs.',
            tradeoffs:
              'No capacity to tune. Idle time is short on SQL warehouses and notebooks. Usage policies and budgets control spend, and cluster policies, pools, and compute-scoped init scripts do not apply.',
          },
          {
            option: 'Classic',
            when: 'You need a specific runtime, instance type, or network setup.',
            tradeoffs:
              'You choose the hardware and runtime. You also own sizing, autoscaling bounds, auto-termination, and policies, and idle all-purpose clusters keep billing until they stop.',
          },
        ],
        recommendation:
          'Default to serverless. Use classic where a runtime, instance, or network requirement rules serverless out, and run production work on job compute so it exists only for the run.',
      },
      links: [
        { label: 'Compute policies', url: 'https://docs.databricks.com/aws/en/admin/clusters/policies' },
        { label: 'Compute configuration reference', url: 'https://docs.databricks.com/aws/en/compute/configure' },
        { label: 'Pool configuration reference', url: 'https://docs.databricks.com/aws/en/compute/pools' },
        { label: 'What is Photon?', url: 'https://docs.databricks.com/aws/en/compute/photon' },
        {
          label: 'Serverless compute limitations',
          url: 'https://docs.databricks.com/aws/en/compute/serverless/limitations',
        },
      ],
    },
    {
      id: 'monitor',
      heading: 'Measure capacity from system tables',
      prose:
        'Three signals tell you whether a warehouse fits its workload: queries waiting for capacity, how often it scales, and how much it sits idle.',
      examples: [
        {
          label: 'Queueing by warehouse and hour',
          language: 'sql',
          code: `SELECT compute.warehouse_id,
       date_trunc('hour', start_time) AS hour,
       count(*) AS statements,
       percentile(waiting_at_capacity_duration_ms, 0.95) / 1000 AS p95_wait_at_capacity_s,
       percentile(waiting_for_compute_duration_ms, 0.95) / 1000 AS p95_wait_for_compute_s
FROM system.query.history
WHERE start_time >= current_timestamp() - INTERVAL 7 DAYS
  AND compute.type = 'WAREHOUSE'
GROUP BY ALL
ORDER BY hour DESC;`,
          notes: [
            'A high wait at capacity points to scale-out or isolation. A high wait for compute points to startup, so check auto-stop and warm-up.',
            'system.compute.warehouse_events shows start, stop, and scale events. system.compute.warehouses records configuration changes over time.',
          ],
        },
      ],
      links: [
        {
          label: 'Query history system table',
          url: 'https://docs.databricks.com/aws/en/admin/system-tables/query-history',
        },
        {
          label: 'Warehouse events system table',
          url: 'https://docs.databricks.com/aws/en/admin/system-tables/warehouse-events',
        },
      ],
    },
  ],
  related: [
    { slug: 'cost-chargeback', title: 'Cost tracking and chargeback' },
    { slug: 'monitoring', title: 'Platform observability' },
    { slug: 'platform-administration', title: 'Workspace and account administration' },
  ],
};
