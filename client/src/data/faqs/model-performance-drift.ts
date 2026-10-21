import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'What does the monitored table need to look like?',
    answer:
      'One flat row per request, with a timestamp, the model inputs, the prediction, and an optional label. Keep a stable request ID so you can join labels later. For a real-time endpoint, turn on inference tables and unpack the JSON payloads with a scheduled job. For batch scoring, write the scores to a Delta table at scoring time.',
    links: [{ label: 'Inference tables', url: 'https://docs.databricks.com/aws/en/ai-gateway/inference-tables' }],
  },
  {
    question: 'How do I measure quality when labels arrive weeks later?',
    answer:
      'Store each prediction with a null label, then MERGE labels in by request ID when they land. Decide the label delay, for example 30 days, treat quality metrics older than that as final, and show recent windows as incomplete. Use drift as the early signal until labels catch up.',
  },
  {
    question: 'What should I use as the drift baseline?',
    answer:
      'The training data, or a window you trust. A baseline makes drift mean different from what the model learned instead of different from last week. Without one, drift is measured against the previous window.',
  },
  {
    question: 'What PSI threshold should trigger an alert?',
    answer:
      'Start with the common guides of about 0.1 for a small shift and 0.25 for a large one, then tune from the metric history so the alert fires on real change rather than noise. Use a SQL alert on the drift table, or an alert task in Lakeflow Jobs so downstream tasks can depend on the result.',
    links: [{ label: 'Alert task in Lakeflow Jobs', url: 'https://docs.databricks.com/aws/en/jobs/tasks/alert' }],
  },
  {
    question: 'Should a drift breach retrain and replace the model automatically?',
    answer:
      'No. Automate the candidate and keep the promotion with a person. The retraining job registers a new version with the challenger alias and never touches the champion alias. The owner compares both on the same recent labeled window and moves the champion alias through the release pipeline.',
    links: [
      {
        label: 'Models in Unity Catalog',
        url: 'https://docs.databricks.com/aws/en/machine-learning/manage-model-lifecycle',
      },
    ],
  },
  {
    question: 'When do I need a custom drift metric?',
    answer:
      'When the built-in metrics fall short. Start with the built-in ones, add a custom metric in the profile for one more number, and write a standalone job only for different binning, a metric across several columns, or a result outside the monitored table. A standalone job means you own the schedule, backfills, and alerting.',
    links: [
      {
        label: 'Custom metrics in data profiling',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/data-profiling/custom-metrics',
      },
    ],
  },
];
