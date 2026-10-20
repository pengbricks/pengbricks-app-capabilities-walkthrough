import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'model-training-compatibility',
  area: 'ML Guides',
  title: 'Training and bringing existing models',
  intro:
    'One job trains a scikit-learn model with MLflow on a real retail churn snapshot and also brings in a model pickled outside MLflow. The imported model is logged as a pyfunc, registered in Unity Catalog, and scored against its recorded baseline. Library and runtime versions are written down for both.',
  shortVersion: [
    {
      title: 'Training logs everything MLflow needs.',
      body: 'train_native records params, holdout AUC, signature, and library versions, then registers churn_classifier.',
    },
    {
      title: 'The existing model is a plain pickle.',
      body: 'export_legacy_model writes a pickle and a JSON sidecar to a Unity Catalog volume. MLflow is not involved.',
    },
    {
      title: 'A pyfunc wrapper brings it in.',
      body: 'legacy_pyfunc.py loads the pickle as an artifact. The wrapper is logged from code, so the class is never pickled.',
    },
    {
      title: 'The baseline reproduces.',
      body: 'Recorded AUC 0.716529 and reproduced AUC 0.716529 on the same holdout, against a tolerance of 0.001. No published churn AUC exists for this dataset, so the recorded one is the baseline.',
    },
    {
      title: 'Versions are recorded.',
      body: 'model_compatibility_log lists each library as recorded versus current. This run showed no package changes across python, scikit-learn, numpy, pandas, mlflow, and scipy.',
    },
  ],
  sections: [
    {
      id: 'paths',
      heading: 'Two ways in, one registry',
      prose:
        'Both models end up as Unity Catalog model versions with aliases. They share one training table and one holdout split. The training table is the 2010-09-01 snapshot of UCI Online Retail II (CC BY 4.0): 3,321 customers, labeled churned when they place no order in the next 6 months. export_legacy_model downloads the file, checks its pinned SHA-256, and builds the table.',
      diagram: {
        type: 'flow',
        title: 'Native training and model import',
        description:
          'export_legacy_model downloads and verifies the public dataset, writes model_training_data, and writes a pickle plus sidecar to the legacy_models volume. train_native trains from the table and registers churn_classifier with alias trained. import_legacy_model reads the pickle and sidecar, logs a pyfunc, registers churn_classifier_imported with alias imported, and writes model_compatibility_log.',
        lanes: [
          { label: 'Inputs', fromRow: 0, toRow: 0 },
          { label: 'Lakeflow job tasks', fromRow: 1, toRow: 1 },
          { label: 'Unity Catalog outputs', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          { id: 'tbl', label: 'model_training_data', mono: true, col: 0, row: 0, kind: 'store' },
          {
            id: 'vol',
            label: 'legacy_model.pkl',
            mono: true,
            sub: 'volume + JSON sidecar',
            col: 2,
            row: 0,
            kind: 'store',
          },
          { id: 'exp', label: 'export_legacy_model', mono: true, sub: 'download, plain pickle', col: 1, row: 1 },
          { id: 'nat', label: 'train_native', mono: true, sub: 'mlflow.sklearn', col: 0, row: 1, kind: 'highlight' },
          {
            id: 'imp',
            label: 'import_legacy_model',
            mono: true,
            sub: 'mlflow.pyfunc',
            col: 2,
            row: 1,
            kind: 'highlight',
          },
          { id: 'm1', label: 'Trained model', sub: 'churn_classifier', col: 0, row: 2, kind: 'store' },
          { id: 'm2', label: 'Imported model', sub: 'churn_classifier_imported', col: 2, row: 2, kind: 'store' },
          { id: 'log', label: 'model_compatibility_log', mono: true, col: 3, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'exp', to: 'tbl' },
          { from: 'exp', to: 'vol' },
          { from: 'tbl', to: 'nat' },
          { from: 'vol', to: 'imp' },
          { from: 'exp', to: 'nat', label: 'then' },
          { from: 'nat', to: 'm1' },
          { from: 'imp', to: 'm2' },
          { from: 'imp', to: 'log' },
        ],
        legend: [
          { kind: 'highlight', label: 'MLflow logging and registration' },
          { kind: 'store', label: 'Unity Catalog object' },
        ],
      },
    },
    {
      id: 'setup',
      heading: 'Set it up',
      prose:
        'The ml-lifecycle bundle creates the Unity Catalog volume that holds the pickle, and the job takes its name as a parameter. The model, features, and tolerance come from the model block of use_cases/general.yml.',
      steps: [
        {
          title: 'Deploy the bundle',
          body: 'The bundle also declares the legacy_models volume and the MLflow experiment.',
          code: 'cd reference/ml-lifecycle\ndatabricks bundle deploy -t dev \\\n  --var catalog=<catalog> --var warehouse_id=<warehouse-id> \\\n  --var app_service_principal=<app-sp-application-id> \\\n  --var notification_email=<email>',
        },
        {
          title: 'Run the job',
          body: 'export_legacy_model runs first. train_native and import_legacy_model run after it, side by side.',
          code: 'databricks bundle run capability_guides_model_training -t dev',
        },
      ],
    },
    {
      id: 'baseline',
      heading: 'Reproducing the baseline',
      prose:
        'The sidecar records the holdout AUC and the Delta version of the training table. The import task reads that table version, rebuilds the same holdout, scores it through the registered pyfunc, and fails if the difference exceeds the tolerance in the spec.',
      diagram: {
        type: 'matrix',
        title: 'Baseline versus reproduced metric',
        description:
          'The recorded baseline holdout AUC was 0.716529. The registered pyfunc scored 0.716529 on the same holdout. The difference was 0 against a tolerance of 0.001.',
        corner: 'Measure ↓',
        columns: ['Value'],
        rows: [
          { label: 'Recorded baseline', sub: 'sidecar JSON', cells: [{ state: 'own', text: '0.716529' }] },
          { label: 'Reproduced', sub: 'registered pyfunc', cells: [{ state: 'own', text: '0.716529' }] },
          { label: 'Difference', sub: 'tolerance 0.001', cells: [{ state: 'none', text: '0' }] },
        ],
        legend: [
          { state: 'own', label: 'Holdout AUC' },
          { state: 'none', label: 'Within tolerance' },
        ],
        caption:
          'The baseline is the AUC this job recorded, because no published churn AUC exists for the dataset. The model trains on the same rows with the same library versions, so it reproduces exactly.',
      },
    },
    {
      id: 'versions',
      heading: 'What the change log records',
      prose:
        'The log compares the versions stored with the pickle against the runtime that loaded it. The import task also pins those versions in the pyfunc requirements. Every row has a changed flag.',
      table: {
        caption: 'model_compatibility_log columns',
        columns: ['Column', 'Content'],
        rows: [
          ['item', 'python, scikit-learn, numpy, pandas, mlflow, scipy, or holdout_auc'],
          ['recorded / current', 'the value in the sidecar and the value in the importing runtime'],
          ['changed', 'true when the two differ (for AUC, when the gap exceeds the tolerance)'],
          ['model, model_version', 'the registered imported model and version'],
          ['mlflow_run_id', 'the import run, which also carries env_* and legacy_env_* tags'],
        ],
      },
    },
    {
      id: 'check',
      heading: 'Check it yourself',
      steps: [
        {
          title: 'Open the volume',
          body: 'legacy_models holds legacy_model.pkl and legacy_model.json with the recorded AUC and versions.',
        },
        {
          title: 'Open the import run',
          body: 'import-legacy-pickle logs baseline_auc, reproduced_auc, and auc_difference.',
        },
        {
          title: 'Break the baseline',
          body: 'Edit baseline_holdout_auc in the sidecar and rerun import_legacy_model. The task fails on the tolerance check.',
        },
      ],
    },
  ],
  related: [
    { slug: 'experiment-tracking', title: 'Reproducible experiments' },
    { slug: 'model-deployment-cicd', title: 'Model release pipeline' },
  ],
};
