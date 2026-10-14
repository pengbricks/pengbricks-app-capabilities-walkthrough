import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'model-performance-drift',
  area: 'ML Guides',
  title: 'Model quality and drift',
  intro:
    'A job scores five batches with a registered model and records operational and model metrics in tables. Batches 4 and 5 carry a shifted days_since_login. PSI flags both, a SQL alert emails the owner, and a challenger model is trained for review.',
  shortVersion: [
    {
      title: 'Two metric tables.',
      body: 'ops_metrics holds rows, scoring time, and null rate. model_metrics holds AUC, accuracy, and positive rates, per batch.',
    },
    {
      title: 'One planted shift.',
      body: 'days_since_login gains 30 in batches 4 and 5. Nothing else changes.',
    },
    {
      title: 'PSI and mean shift detect it.',
      body: 'days_since_login hit a PSI of 3.86 and a mean shift of 1.13 to 1.14 standard deviations in batches 4 and 5. No other feature breached.',
    },
    {
      title: 'The owner gets an email.',
      body: 'A SQL alert reads the newest batch hourly and emails notification_email when PSI passes 0.2.',
    },
    {
      title: 'Retraining is a reviewed step.',
      body: 'On a breach the job registers a challenger. A person promotes it by moving the prod alias.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'Score, measure, detect, route',
      prose:
        'The metric tables append on every run. The drift check compares each batch with the training data the model was fit on.',
      diagram: {
        type: 'flow',
        title: 'The drift job',
        description:
          'train_baseline registers the model with alias prod. score_batches scores five batches and writes ops_metrics, model_metrics, and batch_scores. detect_drift compares each batch with the training data and writes drift_metrics. breach_check runs retrain_candidate only on a breach, which registers a challenger and writes retraining_log. A SQL alert reads drift_metrics and emails the owner.',
        lanes: [
          { label: 'Lakeflow job', fromRow: 0, toRow: 1 },
          { label: 'Tables and routing', fromRow: 2, toRow: 3 },
        ],
        nodes: [
          { id: 'tb', label: 'train_baseline', mono: true, sub: 'register as prod', col: 0, row: 0 },
          { id: 'sb', label: 'score_batches', mono: true, sub: '5 batches of 4,000', col: 1, row: 0 },
          { id: 'dd', label: 'detect_drift', mono: true, sub: 'PSI and mean shift', col: 2, row: 0, kind: 'highlight' },
          { id: 'bc', label: 'breach_check', mono: true, col: 3, row: 0, kind: 'gate' },
          { id: 'rc', label: 'retrain_candidate', mono: true, sub: 'only on a breach', col: 3, row: 1 },
          { id: 'ops', label: 'ops_metrics', mono: true, col: 0, row: 2, kind: 'store' },
          { id: 'mm', label: 'model_metrics', mono: true, col: 1, row: 2, kind: 'store' },
          { id: 'dm', label: 'drift_metrics', mono: true, col: 2, row: 2, kind: 'store' },
          { id: 'ch', label: 'challenger alias', sub: 'awaiting review', col: 3, row: 2, kind: 'store' },
          { id: 'al', label: 'SQL alert', sub: 'max PSI > 0.2, hourly', col: 2, row: 3, kind: 'surface' },
          { id: 'own', label: 'Owner email', sub: 'notification_email', col: 3, row: 3 },
        ],
        edges: [
          { from: 'tb', to: 'sb' },
          { from: 'sb', to: 'dd' },
          { from: 'dd', to: 'bc' },
          { from: 'bc', to: 'rc', label: 'true' },
          { from: 'sb', to: 'ops' },
          { from: 'sb', to: 'mm' },
          { from: 'dd', to: 'dm' },
          { from: 'rc', to: 'ch' },
          { from: 'dm', to: 'al' },
          { from: 'al', to: 'own' },
        ],
        legend: [
          { kind: 'highlight', label: 'Drift detection' },
          { kind: 'gate', label: 'Condition task' },
          { kind: 'surface', label: 'SQL alert' },
          { kind: 'store', label: 'Unity Catalog object' },
        ],
        caption: 'The alert runs on its own hourly schedule, so the email can arrive up to an hour after the job.',
      },
    },
    {
      id: 'metrics',
      heading: 'Metrics per batch',
      prose:
        'Operational metrics describe the scoring job. Model metrics use labels that arrive with each batch. Labels are computed from the shifted values, so they reflect the changed population.',
      diagram: {
        type: 'matrix',
        title: 'Holdout quality and drift by batch',
        description:
          'Batches 1 to 3 have no drift and AUC between 0.9425 and 0.9437. Batches 4 and 5 have a days_since_login PSI of about 3.86 and AUC 0.9451 and 0.9452. The actual positive rate rises from about 0.49 to about 0.75.',
        corner: 'Batch ↓',
        columns: ['AUC', 'Positive rate', 'days_since_login PSI'],
        rows: [
          {
            label: 'Batch 1',
            cells: [
              { state: 'none', text: '0.9425' },
              { state: 'none', text: '0.495' },
              { state: 'none', text: 'below 0.2' },
            ],
          },
          {
            label: 'Batch 2',
            cells: [
              { state: 'none', text: '0.9437' },
              { state: 'none', text: '0.494' },
              { state: 'none', text: 'below 0.2' },
            ],
          },
          {
            label: 'Batch 3',
            cells: [
              { state: 'none', text: '0.9434' },
              { state: 'none', text: '0.491' },
              { state: 'none', text: 'below 0.2' },
            ],
          },
          {
            label: 'Batch 4',
            sub: 'shifted',
            cells: [
              { state: 'own', text: '0.9451' },
              { state: 'own', text: '0.756' },
              { state: 'own', text: '3.858', sub: 'breach' },
            ],
          },
          {
            label: 'Batch 5',
            sub: 'shifted',
            cells: [
              { state: 'own', text: '0.9452' },
              { state: 'own', text: '0.752' },
              { state: 'own', text: '3.857', sub: 'breach' },
            ],
          },
        ],
        legend: [
          { state: 'none', label: 'Normal batch' },
          { state: 'own', label: 'Shifted batch' },
        ],
        caption:
          'AUC did not fall. The input shift shows up in PSI and in the label rate, which is the case where drift metrics warn before quality metrics do.',
      },
    },
    {
      id: 'retrain',
      heading: 'Retraining workflow',
      prose:
        'The job never promotes a model. It prepares one and records the comparison. In the reference run the challenger scored 0.9554 on batch 5 against 0.9452 for prod.',
      steps: [
        {
          title: 'Alert',
          body: 'The SQL alert emails the owner. A failed run emails the same address.',
        },
        {
          title: 'Locate',
          body: 'drift_metrics shows the feature and the first breached batch.',
          code: 'SELECT batch_id, feature, psi, mean_shift_sd FROM drift_metrics WHERE breached;',
        },
        {
          title: 'Review the challenger',
          body: 'retraining_log lists prod AUC and challenger AUC on the newest batch. The challenger trained on the baseline data plus the earlier shifted batch.',
        },
        {
          title: 'Promote or reject',
          body: 'Move the prod alias to the challenger version with set_registered_model_alias. Scoring loads models:/<name>@prod, so the next run uses it.',
        },
      ],
    },
  ],
  related: [
    { slug: 'experiment-tracking', title: 'Reproducible experiments' },
    { slug: 'model-deployment-cicd', title: 'Model release pipeline' },
  ],
};
