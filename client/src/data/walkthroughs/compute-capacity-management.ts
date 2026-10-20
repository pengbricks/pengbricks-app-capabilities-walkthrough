import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'compute-capacity-management',
  area: 'Governance/Monitoring',
  title: 'Compute and capacity management',
  intro:
    'Start with serverless. Serverless SQL warehouses, jobs, and notebooks start in seconds, scale themselves, and leave you few settings to get wrong. You still choose a size, a maximum cluster count, a performance mode, and how to split workloads across warehouses. Classic compute remains for workloads that need it, and it needs more tuning. This page covers the serverless defaults, how to size and isolate warehouses, how to tag queries, the classic controls, and how to read capacity from system tables.',
  shortVersion: [
    {
      title: 'Serverless SQL warehouses by default.',
      body: "Intelligent Workload Management predicts each query's needs, admits it when capacity exists, and adds clusters when the queue grows.",
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
          strong: 'Auto-stop.',
          text: 'Serverless warehouses default to a 10-minute auto-stop in the UI and can go as low as 1 minute through the API. Idle time bills, so keep it short.',
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
      id: 'sizing',
      heading: 'Size, scale, and isolate warehouses',
      prose:
        'Cluster size sets the resources for one cluster. The maximum number of clusters sets how far the warehouse scales out. Choose them for different problems.',
      table: {
        columns: ['Symptom', 'Change'],
        rows: [
          [
            'Queries spill to disk, or one query is slow',
            'Scale up: a larger cluster size. Check bytes spilled in the query profile.',
          ],
          [
            'Peak Queued Queries stays above zero',
            'Scale out: raise max_num_clusters, or give the heavy workload its own warehouse.',
          ],
          ['Dashboard queries wait behind a batch job', 'Isolate: a separate warehouse for each workload.'],
          ['Cost is high and utilization is low', 'Scale down, shorten auto-stop, and merge lightly used warehouses.'],
        ],
      },
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
          strong: 'Test with realistic load.',
          text: 'Run a representative burst of concurrent queries against a throwaway warehouse and read the wait columns before you set production sizes.',
        },
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
      links: [
        { label: 'Compute policies', url: 'https://docs.databricks.com/aws/en/admin/clusters/policies' },
        { label: 'Compute configuration reference', url: 'https://docs.databricks.com/aws/en/compute/configure' },
        { label: 'Pool configuration reference', url: 'https://docs.databricks.com/aws/en/compute/pools' },
        { label: 'What is Photon?', url: 'https://docs.databricks.com/aws/en/compute/photon' },
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
