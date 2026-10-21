import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Do I need a serving endpoint, or is batch scoring enough?',
    answer:
      'Use batch when a table of scores is enough, such as nightly churn or propensity. Add a serving endpoint when a person or application waits for the answer, or the input exists only at request time. A batch score is as old as the last run.',
    links: [
      {
        label: 'Deploy models for batch inference and prediction',
        url: 'https://docs.databricks.com/aws/en/machine-learning/model-inference/',
      },
    ],
  },
  {
    question: 'How should applications authenticate to the endpoint?',
    answer:
      'Grant CAN QUERY to groups or service principals, and have applications use OAuth M2M with a service principal or workload identity federation. Avoid personal access tokens. Keep CAN MANAGE to the owning team and the deployment service principal.',
    links: [
      {
        label: 'Manage serving endpoint permissions',
        url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/manage-serving-endpoints',
      },
    ],
  },
  {
    question: 'How do I size the endpoint?',
    answer:
      'Estimate required concurrency as target QPS times average latency in seconds. A 100 QPS target at 200 ms needs about 20 concurrent requests. Size above that for bursts, then confirm with a load test.',
    links: [
      {
        label: 'Optimize serving for production',
        url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/production-optimization',
      },
    ],
  },
  {
    question: 'Should production endpoints scale to zero?',
    answer:
      'No. Scale to zero in dev and test, where a quiet endpoint then costs little. In production, keep a nonzero minimum, because the next request after idle waits for a cold start and the docs say capacity is not guaranteed when scaled to zero.',
  },
  {
    question: 'Do callers have to send every feature value?',
    answer:
      'No. A model logged with its feature definitions looks features up by key from the online store, which runs on Lakebase. Callers send the key plus values that exist only at call time, such as the current cart. This also avoids training-serving skew.',
    links: [
      {
        label: 'Online Feature Stores',
        url: 'https://docs.databricks.com/aws/en/machine-learning/feature-store/online-feature-store',
      },
    ],
  },
  {
    question: 'How do I stop one client from using all the capacity?',
    answer:
      'Set Unity Gateway rate limits per endpoint, per user, or per group. Token-based limits do not apply to custom model endpoints.',
    links: [
      {
        label: 'Unity Gateway rate limits',
        url: 'https://docs.databricks.com/aws/en/ai-gateway/configure-ai-gateway-endpoints',
      },
    ],
  },
];
