import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'model-training-compatibility',
  area: 'ML Guides',
  title: 'Training and bringing existing models',
  intro:
    'A model is reproducible when someone else can load it, call it with the right inputs, and get the same answers in a different runtime. That takes a logged signature, pinned requirements, a serialization format you can trust, and a check that the registered model matches its baseline. This page covers how to log models into Unity Catalog that way, how to move models in from elsewhere, and how Feature Views keep training and serving features the same.',
  shortVersion: [
    {
      title: 'Log a signature and an input example.',
      body: 'The signature defines the schema a caller must send. The input example gives serving and tests a real request to try. Unity Catalog requires a signature.',
    },
    {
      title: 'Pin the environment.',
      body: 'Log pip requirements with exact versions so serving rebuilds the environment you trained in. Record Python and library versions with the run.',
    },
    {
      title: 'Validate before you register.',
      body: 'mlflow.models.predict loads the model in an isolated environment built from its requirements and runs the input example. A failure here would have been a failed deployment.',
    },
    {
      title: 'Prefer formats that do not run code.',
      body: 'Use the MLflow flavor for your framework, or ONNX or skops. Pickle executes code on load, so confine it to trusted files and wrap it as a pyfunc model.',
    },
    {
      title: 'Use Feature Views to keep features the same.',
      body: 'Define a feature once, train on it with point-in-time joins, and serve with a lookup of the same definition. That removes the most common source of training-serving skew.',
    },
  ],
  sections: [
    {
      id: 'log',
      heading: 'Log a model that others can run',
      prose:
        'Logging is the contract between training and everything downstream. A model logged without a signature or pinned versions works on your cluster and fails on the endpoint.',
      diagram: {
        type: 'flow',
        title: 'From training to a registered, validated model',
        description:
          'Training produces a fitted model. Logging stores it with a signature, input example, and pinned requirements. A validation step loads the logged model in an isolated environment and runs the input example. A passing model registers in Unity Catalog with an alias.',
        nodes: [
          { id: 'fit', label: 'Train', sub: 'fitted model, metrics', col: 0, row: 0 },
          { id: 'log', label: 'log_model', sub: 'signature and example', mono: true, col: 1, row: 0, kind: 'highlight' },
          { id: 'req', label: 'Pinned requirements', sub: 'exact versions', col: 1, row: 1, kind: 'surface' },
          { id: 'val', label: 'Validate', sub: 'mlflow.models.predict', mono: true, col: 2, row: 0, kind: 'gate' },
          { id: 'reg', label: 'Unity Catalog', sub: 'version plus alias', col: 3, row: 0, kind: 'store' },
          { id: 'srv', label: 'Serve or batch score', sub: 'load by alias', col: 4, row: 0 },
        ],
        edges: [
          { from: 'fit', to: 'log' },
          { from: 'req', to: 'log' },
          { from: 'log', to: 'val' },
          { from: 'val', to: 'reg', label: 'pass' },
          { from: 'reg', to: 'srv' },
        ],
        legend: [
          { kind: 'gate', label: 'Fails before registration' },
          { kind: 'store', label: 'Unity Catalog model version' },
        ],
      },
      examples: [
        {
          label: 'Log with a signature, input example, and pinned requirements',
          language: 'python',
          code: `import mlflow
from mlflow.models import infer_signature

mlflow.set_registry_uri("databricks-uc")

signature = infer_signature(X_train, model.predict_proba(X_train)[:, 1])

with mlflow.start_run():
    mlflow.log_params(params)
    mlflow.log_metric("holdout_auc", auc)
    mlflow.sklearn.log_model(
        sk_model=model,
        name="model",
        signature=signature,
        input_example=X_train.head(5),
        pip_requirements=["scikit-learn==1.5.2", "pandas==2.2.3", "numpy==1.26.4"],
        registered_model_name="main.ml.churn_classifier",
    )`,
          notes: [
            'Use the versions you trained with. Letting MLflow infer requirements is a fine start, but review them before you register.',
            'Set an alias on the new version in a later step, after the gates pass.',
          ],
        },
      ],
      links: [
        {
          label: 'MLflow models on Databricks',
          url: 'https://docs.databricks.com/aws/en/mlflow/models',
        },
        {
          label: 'Custom model serving requirements',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/custom-models',
          note: 'Signatures, input examples, and pre-deployment validation.',
        },
      ],
    },
    {
      id: 'validate',
      heading: 'Validate the logged model before registering it',
      prose:
        'The check that matters is the one that matches serving. mlflow.models.predict builds a fresh environment from the model requirements, loads the logged artifact, and scores an input. It catches missing packages, bad pins, and signature mismatches in seconds rather than after a deployment attempt.',
      examples: [
        {
          label: 'Run the logged model in its own environment',
          language: 'python',
          code: `import mlflow

mlflow.models.predict(
    model_uri=f"runs:/{run_id}/model",
    input_data=X_validation.head(20),
    env_manager="uv",
)`,
          notes: [
            'Use input data that includes edge cases: missing optional fields, the extremes of each feature, and a batch of more than one row.',
          ],
        },
      ],
      points: [
        {
          strong: 'Compare to a baseline.',
          text: 'When you move a model or change a runtime, score the same held-out data and compare with the recorded metric inside a tolerance. A small drift from a library upgrade is expected. A large one is a bug.',
        },
        {
          strong: 'Record the environment.',
          text: 'Store Python and package versions as run tags. When results differ later, you can see what changed.',
        },
        {
          strong: 'Run it in CI.',
          text: 'Make validation a gate in the release job, so no version gets an alias without passing it.',
        },
      ],
    },
    {
      id: 'formats',
      heading: 'Choose a format that is safe and portable',
      prose:
        'How a model is serialized decides what loading it can do. Pickle runs arbitrary code from the file, so loading an untrusted file is a security risk, and pickles also break across library versions.',
      table: {
        columns: ['Format', 'When to use it'],
        rows: [
          ['MLflow native flavor (sklearn, xgboost, lightgbm, pytorch, transformers)', 'The default. The flavor handles serialization, versions, and the signature'],
          ['ONNX', 'Portable across frameworks and runtimes, and fast for inference. Convert once, then serve anywhere ONNX Runtime runs'],
          ['skops', 'scikit-learn models when you want a format that loads only types you list as trusted, instead of arbitrary code'],
          ['Pickle or cloudpickle', 'Last resort for a model you cannot retrain. Load only files from a source you control, and pin the library versions'],
        ],
      },
      points: [
        {
          strong: 'Wrap what you cannot convert.',
          text: 'An existing pickled pipeline can be logged as a pyfunc model with the pickle as an artifact and the wrapper loaded from code. The model then carries a signature and requirements like any other.',
        },
        {
          strong: 'Retrain when you can.',
          text: 'If the data and code exist, retraining in the target runtime beats carrying a binary across versions.',
        },
        {
          strong: 'Keep the training data reference.',
          text: 'A model whose training data is gone cannot be retrained or audited. Log the data source or table version with the run.',
        },
      ],
    },
    {
      id: 'migrate',
      heading: 'Move models from the workspace registry to Unity Catalog',
      prose:
        'The workspace model registry is the legacy path. Unity Catalog models add cross-workspace access, lineage, and grants, and use aliases instead of stages.',
      steps: [
        {
          title: 'Inventory models and consumers',
          body: 'List registered models, their stage assignments, and the jobs and endpoints that load them by stage.',
        },
        {
          title: 'Copy or re-register versions',
          body: 'Register each version you need under a three-level name in a catalog and schema. Copy tested versions across with the MLflow client as the upgrade guide describes, and retrain where a copy is not possible.',
        },
        {
          title: 'Replace stages with aliases',
          body: 'A model in Production becomes a version with the champion alias. Update consumers from models:/name/Production to models:/catalog.schema.name@champion.',
        },
        {
          title: 'Set grants and retire the old model',
          body: 'Grant EXECUTE on the model to the groups that need it, repoint serving endpoints, and archive the workspace copy once nothing reads it.',
        },
      ],
      links: [
        {
          label: 'Upgrade ML workflows to Unity Catalog',
          url: 'https://docs.databricks.com/aws/en/machine-learning/manage-model-lifecycle/upgrade-workflows',
        },
      ],
    },
    {
      id: 'features',
      heading: 'Keep training and serving features the same',
      prose:
        'Training-serving skew happens when the feature code at serving differs from the code that built the training set. Feature Views, generally available since October 2026, make the definition the single source for both.',
      points: [
        {
          strong: 'Define the feature once.',
          text: 'A Feature View declares a feature from a Delta table, a stream, or request-time data, with the computation, such as an aggregation over a time window.',
        },
        {
          strong: 'Train with point-in-time joins.',
          text: 'Build the training set from the label table and the feature definitions. The join uses each row timestamp, so a feature never contains information from after the label time.',
        },
        {
          strong: 'Log the model with its features.',
          text: 'A model logged with its training set carries the feature references. A serving endpoint then looks the features up by key and applies the same definitions.',
        },
        {
          strong: 'Materialize for latency.',
          text: 'Materialize features to an offline table for batch scoring and to an online store for low-latency lookup.',
        },
      ],
      links: [
        {
          label: 'Feature Views',
          url: 'https://docs.databricks.com/aws/en/machine-learning/feature-store/feature-views',
        },
        {
          label: 'Train models with feature tables',
          url: 'https://docs.databricks.com/aws/en/machine-learning/feature-store/train-models-with-feature-store',
        },
      ],
    },
  ],
  related: [
    { slug: 'experiment-tracking', title: 'Reproducible experiments' },
    { slug: 'model-deployment-cicd', title: 'Model release pipeline' },
  ],
};
