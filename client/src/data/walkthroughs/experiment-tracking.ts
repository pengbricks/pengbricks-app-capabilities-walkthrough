import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'experiment-tracking',
  area: 'ML Guides',
  title: 'Reproducible experiments',
  intro:
    'An experiment is reproducible when its run records the data, code, and environment that produced the result, and when that record is enough to run it again. MLflow tracking holds those records. This page covers the pattern: log the dataset version with mlflow.data and mlflow.log_input, capture the Git commit and a pinned environment, fix the sources of randomness, and keep the old data version alive long enough to replay.',
  businessValue: {
    summary:
      'Any model result can be traced to the data, code, and environment that produced it. ML program owners and reviewers can rerun a result instead of relying on someone\'s memory.',
    outcomes: [
      {
        title: 'Defensible results',
        body:
          'Each run records the Delta table and version, the Git commit, and pinned requirements, so a team can show how a number was produced.',
      },
      {
        title: 'Easier handoffs',
        body:
          'A new team member or reviewer can replay a run from its record. Nothing depends on the original author remembering the setup.',
      },
      {
        title: 'Fair comparisons',
        body:
          'Fixed seeds and a tolerance on comparisons keep teams from chasing small metric shifts that threads or hardware cause.',
      },
      {
        title: 'A retention decision to make',
        body:
          'Replay works only while Delta keeps the old files. Sponsors should set retention longer than the replay window they need, or snapshot the table.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Log the dataset as an input.',
      body: 'mlflow.data.load_delta reads a Delta table at a version, and mlflow.log_input attaches that dataset to the run. The run then records the table, version, and schema as lineage, not as a loose tag.',
    },
    {
      title: 'Capture the code with the Git commit.',
      body: 'MLflow records the commit for runs launched from a Git-backed source. Add the commit to the run explicitly when a job or CI launches the run.',
    },
    {
      title: 'Pin the environment.',
      body: 'Log exact requirements with the model, and record Python and library versions. Autologging captures parameters, metrics, and models so nothing depends on memory.',
    },
    {
      title: 'Fix seeds, then compare within a tolerance.',
      body: 'Set the seed for every library that uses randomness. Even then, threads and hardware can shift a metric slightly, so compare with a tolerance, not equality.',
    },
    {
      title: 'Retention limits replay.',
      body: 'Time travel works only while Delta keeps the old files. Set retention longer than your replay window or snapshot the table.',
    },
  ],
  sections: [
    {
      id: 'data',
      heading: 'Version the data with mlflow.data',
      prose:
        'A tag with a version number is a note. A logged dataset is a typed input: MLflow stores its source, a digest, and its schema, and the run page and API list it under inputs. Make that the primary record, and add tags only for context.',
      examples: [
        {
          label: 'Read a Delta table at a version and log it as the training input',
          language: 'python',
          code: `import mlflow
import mlflow.data

dataset = mlflow.data.load_delta(table_name="main.ml.customers", version="12")
df = dataset.df.toPandas()

with mlflow.start_run():
    mlflow.log_input(dataset, context="training")
    # Optional context that is not in the dataset record
    mlflow.set_tag("data_snapshot", "month-end")`,
          notes: [
            'Read once through the dataset object, so the version you log is the version you trained on.',
            'Log the validation and test sets the same way, with their own context values.',
          ],
        },
      ],
      points: [
        {
          strong: 'Pin by version or timestamp.',
          text: 'Reading the latest table logs a moving target. Read a Delta version, then log it.',
        },
        {
          strong: 'Feature tables count.',
          text: 'If the training set joins feature tables, log the label table version and the feature definitions or table versions with the run.',
        },
        {
          strong: 'Query by dataset.',
          text: 'Search runs that used a given dataset digest to find every model trained on the same data.',
        },
      ],
      links: [
        {
          label: 'MLflow tracking on Databricks',
          url: 'https://docs.databricks.com/aws/en/mlflow/tracking',
        },
        {
          label: 'Experiments and runs',
          url: 'https://docs.databricks.com/aws/en/mlflow/experiments',
        },
      ],
    },
    {
      id: 'code-env',
      heading: 'Capture code, parameters, and environment',
      points: [
        {
          strong: 'Git commit.',
          text: 'Run from a Git folder or a job with a Git source and MLflow stores the commit on the run. When CI launches the run, pass the commit SHA as a parameter and set it as the mlflow.source.git.commit tag.',
        },
        {
          strong: 'Autologging.',
          text: 'Call mlflow.autolog() so supported libraries log parameters, metrics, and the model without extra code. Add manual log calls for anything specific to your problem.',
        },
        {
          strong: 'Pinned environment.',
          text: 'Log the model with exact pip requirements, and store the Python version. Better still, run the job in a bundle or serverless environment version that pins the base libraries.',
        },
        {
          strong: 'MLflow 3 LoggedModels.',
          text: 'In MLflow 3 a model is a first-class entity, a LoggedModel, with its own ID. It links to the runs that produced it and the evaluations that scored it, so you can trace a registered version to the code, data, and metrics behind it.',
        },
        {
          strong: 'Seeds.',
          text: 'Set the seed in numpy, the framework, the data split, and the estimator. Log it as a parameter.',
        },
      ],
      examples: [
        {
          label: 'A tracked run that records what it needs to replay',
          language: 'python',
          code: `import random, numpy as np, mlflow

SEED = 42
random.seed(SEED); np.random.seed(SEED)

mlflow.autolog()
with mlflow.start_run() as run:
    mlflow.log_param("seed", SEED)
    mlflow.set_tag("mlflow.source.git.commit", git_sha)   # passed in by CI
    mlflow.log_input(dataset, context="training")
    model = train(df, seed=SEED)
    mlflow.sklearn.log_model(
        sk_model=model, name="model",
        pip_requirements=["scikit-learn==1.5.2", "pandas==2.2.3"],
    )`,
          notes: ['One run now holds the data, code, seed, environment, and model needed to rerun it.'],
        },
      ],
      options: {
        caption: 'How to log a run',
        rows: [
          {
            option: 'mlflow.autolog()',
            when: 'Supported libraries, and exploration where you want records with no extra code.',
            tradeoffs: 'Logs parameters, metrics, and the model for supported libraries with no extra code. What it records varies by library, and it does not know your data version, seed, or commit.',
          },
          {
            option: 'Manual log calls',
            when: 'A custom training loop, a library autologging does not cover, or a fixed set of names across teams.',
            tradeoffs: 'You decide the names and exactly what is recorded. Every call is code to maintain, and a missed call is a missing record.',
          },
          {
            option: 'Autolog plus explicit calls for the rest',
            when: 'Most production runs.',
            tradeoffs: 'Default coverage plus the pieces autologging misses: the logged dataset, the seed, the Git commit, and pinned requirements. A short helper keeps the explicit part the same in every project.',
          },
        ],
        recommendation: 'Turn on autologging and add explicit calls for the data input, seed, commit, and pinned requirements.',
      },
      links: [
        {
          label: 'Databricks autologging',
          url: 'https://docs.databricks.com/aws/en/mlflow/databricks-autologging',
        },
      ],
    },
    {
      id: 'rerun',
      heading: 'Replay a run from its record',
      prose:
        'A reproduction reads only what the original run recorded. If it needs anything else, the record is incomplete.',
      diagram: {
        type: 'flow',
        title: 'Reproduce a tracked run',
        description:
          'A tracked run records its dataset input, Git commit, parameters, seed, and environment. The rerun reads those records, loads the Delta table at the recorded version, checks out the commit, builds the same environment, trains, and compares its metric to the original within a tolerance.',
        nodes: [
          { id: 'run', label: 'Tracked run', sub: 'inputs, tags, params', col: 0, row: 0 },
          { id: 'data', label: 'Dataset input', sub: 'Delta table and version', col: 1, row: 0, kind: 'store' },
          { id: 'code', label: 'Git commit', sub: 'code at that SHA', col: 1, row: 1, kind: 'surface' },
          { id: 'env', label: 'Pinned environment', sub: 'requirements, seed', col: 1, row: 2, kind: 'surface' },
          { id: 're', label: 'Rerun', sub: 'reads only the record', col: 2, row: 1, kind: 'highlight' },
          { id: 'cmp', label: 'Compare', sub: 'metric within tolerance', col: 3, row: 1, kind: 'gate' },
        ],
        edges: [
          { from: 'run', to: 'data' },
          { from: 'run', to: 'code' },
          { from: 'run', to: 'env' },
          { from: 'data', to: 're' },
          { from: 'code', to: 're' },
          { from: 'env', to: 're' },
          { from: 're', to: 'cmp' },
        ],
        legend: [
          { kind: 'store', label: 'Delta data version' },
          { kind: 'gate', label: 'Pass or fail check' },
        ],
      },
      points: [
        {
          strong: 'Pick a tolerance from evidence.',
          text: 'Run the same job a few times and measure the spread. Set the tolerance above that spread, and treat larger gaps as a change in data, code, or environment.',
        },
        {
          strong: 'Add a control run.',
          text: 'Train once on the latest data as well. A difference from the replay shows the version pin mattered.',
        },
        {
          strong: 'Record the comparison.',
          text: 'Write the original and rerun metrics, the difference, and the tolerance to a table or as tags on the rerun, and link the rerun to the original run ID.',
        },
      ],
    },
    {
      id: 'limits',
      heading: 'Where reproducibility stops',
      prose: 'Delta retention is the limit people hit first, followed by environment drift and hardware.',
      points: [
        {
          strong: 'Delta retention.',
          text: 'Time travel reads old versions only while their data files exist. VACUUM removes files older than delta.deletedFileRetentionDuration (7 days by default), and log retention defaults to 30 days. Raise both beyond your replay window for tables behind important models.',
        },
        {
          strong: 'Snapshots for the long term.',
          text: 'For a model you must reproduce years later, copy the training set with a deep clone or write it to a versioned volume, and log that location as the input.',
        },
        {
          strong: 'Environment drift.',
          text: 'A library upgrade can shift results. Pinned requirements limit this, and a recorded environment tells you what changed when results differ.',
        },
        {
          strong: 'Nondeterminism.',
          text: 'Multithreaded training, GPUs, and some algorithms vary run to run. Fix what you can and size the tolerance for the rest.',
        },
      ],
      options: {
        caption: 'How to keep the training data replayable',
        rows: [
          {
            option: 'Log the Delta table version and rely on time travel',
            when: 'Replays within weeks, on tables you control.',
            tradeoffs: 'No copy and no extra storage. It works only while the old files exist. VACUUM removes files older than 7 days by default, and raising retention keeps more files, which costs storage on that table.',
          },
          {
            option: 'Deep clone the training set',
            when: 'Models you must reproduce or audit months or years later.',
            tradeoffs: 'An independent copy of data and metadata that survives VACUUM and later changes to the source. It costs storage, and you log the clone name as the input. A shallow clone still references the source files, so it does not give you this.',
          },
          {
            option: 'Export to a versioned volume path',
            when: 'The source is not Delta, or an auditor needs plain files.',
            tradeoffs: 'Portable files with a path you can log. You maintain naming, versioning, and permissions yourself, and the link to table lineage is lost.',
          },
        ],
        recommendation: 'Pin a Delta version for routine runs and raise retention on tables behind important models. Deep clone the training set when a model has to be reproducible years later.',
      },
      links: [
        {
          label: 'Table history and retention',
          url: 'https://docs.databricks.com/aws/en/tables/history',
        },
        {
          label: 'Clone a table',
          url: 'https://docs.databricks.com/aws/en/tables/operations/clone',
          note: 'Deep and shallow clones.',
        },
      ],
    },
  ],
  related: [
    { slug: 'model-training-compatibility', title: 'Training and bringing existing models' },
    { slug: 'model-performance-drift', title: 'Model quality and drift' },
  ],
};
