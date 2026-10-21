import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'model-performance-drift',
  area: 'ML Guides',
  title: 'Model quality and drift',
  intro:
    'A deployed model degrades in two ways: its inputs change, and its predictions stop matching outcomes. Databricks data quality monitoring tracks both. You attach an inference profile to a table of model requests, and it computes profile and drift metrics over time windows, builds a dashboard, and feeds SQL alerts. This page covers the setup, how to join delayed labels, what should trigger retraining, and how to promote a retrained model with a human decision.',
  businessValue: {
    summary:
      'Teams learn that a model has degraded before the business sees bad decisions. ML owners get drift and quality metrics, a dashboard, and alerts on a table of model requests.',
    outcomes: [
      {
        title: 'Early warning',
        body:
          'Data quality monitoring computes profile and drift metrics over time windows. A SQL alert on those tables notifies the model owner when a metric moves.',
      },
      {
        title: 'Quality measured against outcomes',
        body:
          'Labels join by request ID when they arrive, which can take days or weeks. Quality metrics are read only for windows old enough to be labeled.',
      },
      {
        title: 'Retraining under review',
        body:
          'A breach starts a retraining job that registers a challenger. A person compares it with the champion before the alias moves, so no model replaces itself in production.',
      },
      {
        title: 'Little to build',
        body:
          'One inference profile writes the metrics tables and a dashboard. Teams add a custom metric, such as PSI, only when the built-in ones fall short.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Start with an inference profile.',
      body: 'Attach data quality monitoring to a table with one row per request: timestamp, model inputs, prediction, and an optional label. It writes a profile metrics table, a drift metrics table, and a dashboard.',
    },
    {
      title: 'Feed it from inference logging.',
      body: 'Inference tables on a serving endpoint capture requests and responses. Unpack them into a flat table, or write batch scores to one, and monitor that table.',
    },
    {
      title: 'Join labels when they arrive.',
      body: 'Ground truth often lands days or weeks after the prediction. Join it by request ID, leave the label null until then, and read quality metrics only for windows old enough to be labeled.',
    },
    {
      title: 'Alert on the metric tables.',
      body: 'A SQL alert on the drift or profile table notifies the model owner. A Lakeflow Jobs alert task can run the check on a schedule and branch on the result.',
    },
    {
      title: 'Retrain on a trigger, promote by review.',
      body: 'A breach starts a retraining job that registers a challenger. A person compares it with the champion and moves the alias.',
    },
  ],
  sections: [
    {
      id: 'monitor',
      heading: 'Monitor the model with an inference profile',
      prose:
        'The monitor is a managed pipeline. It reads the table you point it at on a schedule, computes metrics per time window and per model version, and writes the results to Unity Catalog tables you can query.',
      diagram: {
        type: 'flow',
        title: 'From requests to an alert',
        description:
          'The serving endpoint writes requests and responses to an inference table. A job unpacks them into a flat monitored table and joins labels when they arrive. Data quality monitoring computes profile metrics and drift metrics into two tables and generates a dashboard. A SQL alert on those tables notifies the owner, and a breach starts a retraining job.',
        nodes: [
          { id: 'ep', label: 'Serving endpoint', sub: 'inference logging on', col: 0, row: 0 },
          { id: 'flat', label: 'Monitored table', sub: 'inputs, prediction, label', col: 1, row: 0, kind: 'store' },
          { id: 'lbl', label: 'Ground truth', sub: 'arrives later', col: 1, row: 1, kind: 'surface' },
          { id: 'mon', label: 'Inference profile', sub: 'data quality monitoring', col: 2, row: 0, kind: 'highlight' },
          { id: 'met', label: 'Metric tables', sub: 'profile and drift', col: 3, row: 0, kind: 'store' },
          { id: 'dash', label: 'Dashboard', sub: 'generated for you', col: 3, row: 1 },
          { id: 'alert', label: 'SQL alert', sub: 'notifies the owner', col: 4, row: 0, kind: 'gate' },
          { id: 'retrain', label: 'Retraining job', sub: 'registers a challenger', col: 4, row: 1 },
        ],
        edges: [
          { from: 'ep', to: 'flat' },
          { from: 'lbl', to: 'flat', label: 'join by request ID' },
          { from: 'flat', to: 'mon' },
          { from: 'mon', to: 'met' },
          { from: 'met', to: 'dash', dashed: true },
          { from: 'met', to: 'alert' },
          { from: 'alert', to: 'retrain', label: 'on breach' },
        ],
        legend: [
          { kind: 'highlight', label: 'Managed by Databricks' },
          { kind: 'store', label: 'Unity Catalog table' },
          { kind: 'gate', label: 'Threshold check' },
        ],
      },
      points: [
        {
          strong: 'Inference profile.',
          text: 'Set the problem type, classification or regression, plus the timestamp, prediction, model ID, and label columns. Metrics come out per window and per model version, so you can compare a canary with the champion.',
        },
        {
          strong: 'Profile metrics.',
          text: 'Summary statistics per column and window, such as null rate, distinct counts, and mean. With labels, model accuracy metrics: accuracy and related measures for classification, error measures for regression.',
        },
        {
          strong: 'Drift metrics.',
          text: 'Changes in distribution, compared with the previous window or with a baseline table you supply. Built-in measures include population stability index and Wasserstein distance for numeric columns.',
        },
        {
          strong: 'Dashboard.',
          text: 'The profile generates a dashboard over both tables. Customize it or build your own on the same tables.',
        },
        {
          strong: 'Baseline.',
          text: 'Use the training data, or a window you trust, as the baseline. A baseline makes drift mean "different from what the model learned", not just "different from last week".',
        },
      ],
      examples: [
        {
          label: 'Create the profile with the SDK',
          language: 'python',
          code: `from databricks.sdk import WorkspaceClient
from databricks.sdk.service.catalog import MonitorInferenceLog, MonitorInferenceLogProblemType

w = WorkspaceClient()
w.quality_monitors.create(
    table_name="main.ml.churn_requests",
    assets_dir="/Workspace/Shared/monitors/churn",
    output_schema_name="main.ml_monitoring",
    inference_log=MonitorInferenceLog(
        problem_type=MonitorInferenceLogProblemType.PROBLEM_TYPE_CLASSIFICATION,
        timestamp_col="request_time",
        granularities=["1 day"],
        model_id_col="model_version",
        prediction_col="prediction",
        label_col="churned",
    ),
    baseline_table_name="main.ml.churn_training_baseline",
)`,
          notes: ['Check the SDK version you use for current class names. The UI creates the same profile.'],
        },
      ],
      links: [
        {
          label: 'Data quality monitoring: data profiling',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/data-profiling',
        },
        {
          label: 'Profile metrics and drift metrics tables',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/data-profiling/monitor-output',
        },
        {
          label: 'The generated dashboard',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/data-profiling/monitor-dashboard',
        },
      ],
    },
    {
      id: 'feed',
      heading: 'Feed the monitor from inference logs',
      prose:
        'The monitored table should have one flat row per request. Real-time and batch scoring get there differently.',
      points: [
        {
          strong: 'Real-time endpoints.',
          text: 'Turn on inference tables for the endpoint. The raw table stores JSON request and response payloads. A scheduled job parses them into columns, one per input and one for the prediction, and writes the monitored table.',
        },
        {
          strong: 'Batch scoring.',
          text: 'Write the inputs, prediction, model version, and scoring timestamp to a Delta table at scoring time. Monitor that table directly.',
        },
        {
          strong: 'Keep a request ID.',
          text: 'You need a stable key to join labels later. Generate one at the caller or in the scoring job and carry it through.',
        },
      ],
      links: [
        {
          label: 'Inference tables',
          url: 'https://docs.databricks.com/aws/en/ai-gateway/inference-tables',
        },
      ],
    },
    {
      id: 'labels',
      heading: 'Join ground truth that arrives late',
      prose:
        'A churn label is known months after the prediction. Quality metrics are only valid for windows whose labels are mostly in.',
      steps: [
        {
          title: 'Store predictions with a null label',
          body: 'Write the row at scoring time with the label column empty. Drift metrics work from the first day.',
        },
        {
          title: 'MERGE labels when they land',
          body: 'A scheduled job joins the outcome table to the monitored table by request ID and updates the label column. Because the join is a MERGE, it is safe to rerun.',
          code: `MERGE INTO main.ml.churn_requests AS r
USING main.ml.churn_outcomes AS o
  ON r.request_id = o.request_id
WHEN MATCHED AND r.churned IS NULL THEN UPDATE SET r.churned = o.churned;`,
        },
        {
          title: 'Read quality for mature windows only',
          body: 'Decide the label delay, for example 30 days. Treat quality metrics older than that as final, and show recent windows as incomplete. A drop in label coverage is a data problem to alert on too.',
        },
        {
          title: 'Use drift as the early signal',
          body: 'Input and prediction drift appear immediately. Quality metrics confirm later. Alert on drift to investigate early, and retrain on confirmed quality loss.',
        },
      ],
    },
    {
      id: 'alerts',
      heading: 'Alert the owner',
      prose:
        'The metric tables are ordinary Unity Catalog tables, so alerts are ordinary SQL alerts.',
      points: [
        {
          strong: 'SQL alert on a metric table.',
          text: 'Write a query over the drift table, such as the maximum drift statistic for the latest window of a key feature, and set the threshold. Choose the notification destination and schedule in the alert.',
        },
        {
          strong: 'Alert task in Lakeflow Jobs.',
          text: 'Add the alert as a task, so the check runs inside a job and downstream tasks depend on its result. That is how a breach starts retraining.',
        },
        {
          strong: 'Pick thresholds from history.',
          text: 'Start with common PSI guides of about 0.1 for a small shift and 0.25 for a large one, then tune from the metric history so the alert fires on real change rather than noise.',
        },
        {
          strong: 'Send each alert to someone who can act.',
          text: 'Quality drops go to the model owner. Pipeline or null-rate problems go to the data owner.',
        },
      ],
      examples: [
        {
          label: 'A query for a drift alert',
          language: 'sql',
          code: `SELECT max(population_stability_index) AS max_psi
FROM main.ml_monitoring.churn_requests_drift_metrics
WHERE drift_type = 'BASELINE'
  AND column_name IN ('tenure_months', 'days_since_purchase', 'prediction')
  AND window.start >= current_date() - INTERVAL 2 DAYS;`,
          notes: ['Alert when max_psi is above your threshold. Check the metric names in the drift table of your profile.'],
        },
      ],
      links: [
        {
          label: 'Profile alerts',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/data-profiling/monitor-alerts',
        },
        {
          label: 'Alert task in Lakeflow Jobs',
          url: 'https://docs.databricks.com/aws/en/jobs/tasks/alert',
        },
      ],
    },
    {
      id: 'retrain',
      heading: 'Retrain on a trigger, promote on review',
      prose:
        'Retraining should be a decision with a trail. Automate the candidate, and keep the promotion with a person.',
      points: [
        {
          strong: 'Triggers.',
          text: 'Common ones: drift above a threshold on key features, confirmed quality loss on mature windows, a fixed schedule, or enough new labeled data. Combine them, and avoid retraining on every blip.',
        },
        {
          strong: 'Challenger.',
          text: 'The retraining job trains on current data, registers a new Unity Catalog version, and sets the challenger alias. It never touches the champion alias.',
        },
        {
          strong: 'Compare on the same data.',
          text: 'Score the champion and the challenger on a recent labeled window and report the metrics side by side. A traffic split or shadow endpoint gives a live comparison.',
        },
        {
          strong: 'Human-reviewed promotion.',
          text: 'The owner reviews the comparison and, if it holds up, moves the champion alias through the release pipeline with its approval step. If the shift came from a data fault, they fix the source and leave the champion in place.',
        },
        {
          strong: 'Record the decision.',
          text: 'Keep the trigger, the comparison, the approver, and the outcome with the model version.',
        },
      ],
      options: {
        caption: 'How to compare a challenger with the champion',
        rows: [
          {
            option: 'Offline comparison on a recent labeled window',
            when: 'Labels arrive soon enough, and you want no exposure in production.',
            tradeoffs: 'Both models score the same data, so the comparison is fair. It reflects only the window you pick, labels may lag, and it cannot show how users react to the new model.',
          },
          {
            option: 'Canary with a traffic split',
            when: 'You need live evidence from real requests.',
            tradeoffs: 'Real behavior, with a small share of traffic on the new version. Both versions are served at once, and you need enough traffic and time to read the result.',
          },
          {
            option: 'Shadow endpoint',
            when: 'High-risk changes where no user may see the new score.',
            tradeoffs: 'No user impact. A traffic split does not mirror requests, so the caller or a proxy has to send the copy, and you pay for a second endpoint.',
          },
        ],
        recommendation: 'Start with an offline comparison on a recent labeled window. Add a canary split for customer-facing models once the offline result holds.',
      },
      links: [
        {
          label: 'Models in Unity Catalog',
          url: 'https://docs.databricks.com/aws/en/machine-learning/manage-model-lifecycle',
        },
        {
          label: 'Serve multiple models on one endpoint',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/serve-multiple-models-to-serving-endpoint',
          note: 'Traffic split for a canary.',
        },
      ],
    },
    {
      id: 'custom',
      heading: 'When you need your own metric: a PSI job',
      prose:
        'Built-in drift metrics cover most cases. Write your own when you need a different binning, a metric across several columns, or a result outside a monitored table. Custom metrics in the profile are one way. A small job is another.',
      examples: [
        {
          label: 'Population stability index with baseline quantile bins',
          language: 'python',
          code: `import numpy as np

def psi(baseline, current, bins=10, eps=1e-6):
    edges = np.unique(np.quantile(baseline, np.linspace(0, 1, bins + 1)))
    edges[0], edges[-1] = -np.inf, np.inf
    b = np.histogram(baseline, edges)[0] / len(baseline)
    c = np.histogram(current, edges)[0] / len(current)
    b, c = np.clip(b, eps, None), np.clip(c, eps, None)
    return float(np.sum((c - b) * np.log(c / b)))`,
          notes: [
            'Write the result to a table per window and feature, and alert on it like any other metric.',
            'Quantile bins from the baseline keep each bin populated, so the index does not blow up on empty bins.',
          ],
        },
      ],
      options: {
        caption: 'Where drift is computed',
        rows: [
          {
            option: 'Built-in drift metrics in the profile',
            when: 'Standard per-column statistics against a baseline or the previous window.',
            tradeoffs: 'A managed pipeline that runs on serverless compute for jobs, writes metric tables, and generates a dashboard. The profile refresh has a cost you can track, and you accept its metrics and binning.',
          },
          {
            option: 'Custom metrics in the profile',
            when: 'One more number from the same table, such as a weighted mean or a business quality score.',
            tradeoffs: 'The metric runs in the same refresh and lands in the same tables, so alerts and the dashboard reuse it. You define it through the MonitorMetric API and keep it with the profile.',
          },
          {
            option: 'A standalone job',
            when: 'Different binning, a metric across several columns, or a result outside the monitored table.',
            tradeoffs: 'Full control, as in the PSI function below. You own the schedule, backfills, result tables, tests, and alerting.',
          },
        ],
        recommendation: 'Start with the built-in metrics, add custom metrics for one more number, and write a job only when the profile cannot express the metric.',
      },
      links: [
        {
          label: 'Custom metrics in data profiling',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/data-profiling/custom-metrics',
        },
        {
          label: 'Data profiling',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/data-profiling/',
          note: 'Profile types, refresh, and cost.',
        },
      ],
    },
  ],
  related: [
    { slug: 'real-time-scoring', title: 'Online model scoring' },
    { slug: 'model-deployment-cicd', title: 'Model release pipeline' },
    { slug: 'experiment-tracking', title: 'Reproducible experiments' },
  ],
};
