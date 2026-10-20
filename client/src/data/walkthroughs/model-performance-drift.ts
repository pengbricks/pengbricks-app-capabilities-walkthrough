import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'model-performance-drift',
  area: 'ML Guides',
  title: 'Model quality and drift',
  intro:
    'A job scores nine monthly batches of real retail customers (UCI Online Retail II, CC BY 4.0) with a registered model and records operational and model metrics in tables. The customer base ages, so PSI flags tenure_months from batch 1. AUC holds at 0.75 to 0.77 while the model under-predicts churn. A SQL alert emails the owner, and a challenger model is trained for review.',
  shortVersion: [
    {
      title: 'Two metric tables.',
      body: 'ops_metrics holds rows, scoring time, and null rate. model_metrics holds AUC, accuracy, and positive rates, per batch.',
    },
    {
      title: 'The drift is real.',
      body: 'Each batch is the whole customer base at a later monthly snapshot, from 2010-10-01 to 2011-06-01, with the churn label that followed. Nothing is shifted by hand.',
    },
    {
      title: 'PSI and mean shift detect it.',
      body: 'tenure_months breaches from batch 1, days_since_purchase from batch 4, and order_gap_days from batch 7 on mean shift alone. monthly_spend, products_per_order, and returns never breach.',
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
        'Each run rewrites the metric tables for its batches. The drift check compares each batch with the training data the model was fit on.',
      diagram: {
        type: 'flow',
        title: 'The drift job',
        description:
          'train_baseline registers the model with alias prod, trained on the 2010-09-01 snapshot. score_batches scores nine monthly batches and writes ops_metrics, model_metrics, and batch_scores. detect_drift compares each batch with the training data and writes drift_metrics. breach_check runs retrain_candidate only on a breach, which registers a challenger and writes retraining_log. A SQL alert reads drift_metrics and emails the owner.',
        lanes: [
          { label: 'Lakeflow job', fromRow: 0, toRow: 1 },
          { label: 'Tables and routing', fromRow: 2, toRow: 3 },
        ],
        nodes: [
          { id: 'tb', label: 'train_baseline', mono: true, sub: 'register as prod', col: 0, row: 0 },
          { id: 'sb', label: 'score_batches', mono: true, sub: '9 monthly batches', col: 1, row: 0 },
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
        'Operational metrics describe the scoring job. Model metrics use the labels that followed each snapshot. AUC stays flat while predicted churn sits well below actual churn, so the model under-predicts. tenure_months breaches first because the customer base ages: the data starts 2009-12-01, so nobody in the baseline has more than 9 months of tenure.',
      diagram: {
        type: 'matrix',
        title: 'Holdout quality and drift by batch',
        description:
          'AUC stays between 0.7538 and 0.7746 in all nine batches. The actual churn rate runs from 0.391 to 0.537 while the predicted rate stays between 0.254 and 0.304. tenure_months breaches from batch 1, days_since_purchase joins from batch 4, and order_gap_days joins from batch 7.',
        corner: 'Batch ↓',
        columns: ['AUC', 'Actual churn', 'Predicted churn', 'Breached features'],
        rows: [
          {
            label: 'Batch 1',
            sub: '2010-10-01',
            cells: [
              { state: 'none', text: '0.7586' },
              { state: 'none', text: '0.391' },
              { state: 'none', text: '0.304' },
              { state: 'none', text: '1 feature', sub: 'tenure_months' },
            ],
          },
          {
            label: 'Batch 2',
            sub: '2010-11-01',
            cells: [
              { state: 'none', text: '0.7538' },
              { state: 'none', text: '0.447' },
              { state: 'none', text: '0.288' },
              { state: 'none', text: '1 feature', sub: 'tenure_months' },
            ],
          },
          {
            label: 'Batch 3',
            sub: '2010-12-01',
            cells: [
              { state: 'none', text: '0.7631' },
              { state: 'none', text: '0.519' },
              { state: 'none', text: '0.265' },
              { state: 'none', text: '1 feature', sub: 'tenure_months' },
            ],
          },
          {
            label: 'Batch 4',
            sub: '2011-01-01',
            cells: [
              { state: 'none', text: '0.7663' },
              { state: 'none', text: '0.534' },
              { state: 'none', text: '0.254' },
              { state: 'optional', text: '2 features', sub: '+ days_since_purchase' },
            ],
          },
          {
            label: 'Batch 5',
            sub: '2011-02-01',
            cells: [
              { state: 'none', text: '0.7644' },
              { state: 'none', text: '0.535' },
              { state: 'none', text: '0.262' },
              { state: 'optional', text: '2 features', sub: '+ days_since_purchase' },
            ],
          },
          {
            label: 'Batch 6',
            sub: '2011-03-01',
            cells: [
              { state: 'none', text: '0.7677' },
              { state: 'none', text: '0.537' },
              { state: 'none', text: '0.273' },
              { state: 'optional', text: '2 features', sub: '+ days_since_purchase' },
            ],
          },
          {
            label: 'Batch 7',
            sub: '2011-04-01',
            cells: [
              { state: 'none', text: '0.7632' },
              { state: 'none', text: '0.529' },
              { state: 'none', text: '0.301' },
              { state: 'own', text: '3 features', sub: '+ order_gap_days' },
            ],
          },
          {
            label: 'Batch 8',
            sub: '2011-05-01',
            cells: [
              { state: 'none', text: '0.7746' },
              { state: 'none', text: '0.508' },
              { state: 'none', text: '0.298' },
              { state: 'own', text: '3 features', sub: '+ order_gap_days' },
            ],
          },
          {
            label: 'Batch 9',
            sub: '2011-06-01',
            cells: [
              { state: 'none', text: '0.7663' },
              { state: 'none', text: '0.482' },
              { state: 'none', text: '0.298' },
              { state: 'own', text: '3 features', sub: '+ order_gap_days' },
            ],
          },
        ],
        legend: [
          { state: 'none', label: 'tenure_months only' },
          { state: 'optional', label: 'Plus days_since_purchase' },
          { state: 'own', label: 'Plus order_gap_days' },
        ],
        caption:
          'AUC did not fall. Predicted churn (0.25 to 0.30) sits well below actual churn (0.39 to 0.54). Drift metrics and calibration catch this; AUC alone would not.',
      },
    },
    {
      id: 'retrain',
      heading: 'Retraining workflow',
      prose:
        'The job never promotes a model. It prepares one and records the comparison. In the reference run the challenger scored 0.8147 on batch 9 against 0.7663 for prod.',
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
          body: 'retraining_log lists prod AUC and challenger AUC on the newest batch. The challenger trained on the baseline data plus batches 1 to 8.',
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
