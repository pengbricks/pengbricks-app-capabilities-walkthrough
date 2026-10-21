import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'When should I still use classic compute?',
    answer:
      'Use classic when a workload needs a specific runtime, instance type, or network setup that rules serverless out. Then you own sizing, autoscaling bounds, auto-termination, and policies. Run production work on job compute so it exists only for the run.',
    links: [
      {
        label: 'Serverless compute limitations',
        url: 'https://docs.databricks.com/aws/en/compute/serverless/limitations',
      },
    ],
  },
  {
    question: 'Do compute policies apply to serverless?',
    answer:
      'No. Compute policies govern classic compute only. On serverless, cluster policies, pools, and compute-scoped init scripts do not apply, and usage policies and budgets control spend instead.',
    links: [{ label: 'Compute policies', url: 'https://docs.databricks.com/aws/en/admin/clusters/policies' }],
  },
  {
    question: 'A warehouse is slow. Should I make it bigger or add clusters?',
    answer:
      'Match the change to the symptom. If queries spill to disk or one query is slow, scale up. If Peak Queued Queries stays above zero, raise max_num_clusters. If dashboards wait behind a batch job, give each workload its own warehouse.',
    links: [
      {
        label: 'Sizing, scaling, and queuing behavior',
        url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/warehouse-behavior',
      },
    ],
  },
  {
    question: 'How many clusters should I allow?',
    answer:
      'On pro and classic warehouses, plan for about one cluster per 10 concurrent queries. For serverless, Databricks suggests starting with one larger warehouse and sizing down, which is usually cheaper than starting small and scaling up.',
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
