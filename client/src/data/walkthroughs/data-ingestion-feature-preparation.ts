import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'data-ingestion-feature-preparation',
  area: 'Ingestion',
  title: 'Feature preparation from source data',
  intro:
    'Model inputs need the same care as any production table: a governed home, a check before use, a join that does not leak the future, and a record of exactly what a model trained on. This page covers feature tables in Unity Catalog, point-in-time-correct training sets, logging the training set with the model, refreshing features, and how long you can reproduce an input.',
  businessValue: {
    summary:
      'Model inputs get the same governance as production tables, plus a record of what each model trained on. ML leads and risk teams can explain a model\'s data and know where reproducibility ends.',
    outcomes: [
      {
        title: 'Honest accuracy numbers',
        body: 'Point-in-time joins give each label only the feature values known at that time. Future data stays out of training, so offline accuracy better predicts production.',
      },
      {
        title: 'Know what a model used',
        body: 'The model is logged with its training set, so lineage names its feature tables and serving looks up the same features by key.',
      },
      {
        title: 'Bad features never reach training',
        body: 'Checks run in the job that writes the feature table and fail the task on a violation, so a bad table never reaches a training set.',
      },
      {
        title: 'Reproducibility has a limit',
        body: 'Time travel works only while data files exist, and VACUUM removes old versions. Snapshot or clone training data when audits need inputs beyond the retention window.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'A feature table is a governed Delta table.',
      body: 'Create it in Unity Catalog with a primary key. Access control, lineage, and discovery then work as they do for any table, and the Feature Engineering client reads it by name.',
    },
    {
      title: 'Join features as of each label’s time.',
      body: 'Declare a timestamp key on the feature table and a timestamp lookup key on the labels. The training set takes the latest feature value at or before each label time, which keeps future data out of training.',
    },
    {
      title: 'Log the training set with the model.',
      body: 'Log the model with the training set so serving and batch scoring look up the same features by key, and so the model’s lineage names its feature tables.',
    },
    {
      title: 'Refresh features with MERGE.',
      body: 'Recompute changed entities on a schedule and upsert them by primary key. A rerun then updates rows and leaves no duplicates.',
    },
    {
      title: 'Time travel is not permanent.',
      body: 'VERSION AS OF works only while the data files exist. VACUUM and the retention settings remove old versions. Snapshot or clone the training data when you need reproducibility beyond the retention window.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'From source rows to a training set',
      prose:
        'Keep the stages separate so each can fail on its own: land and clean the source, derive features and check them, build the training set, and record what it used.',
      diagram: {
        type: 'flow',
        title: 'Feature preparation stages',
        description:
          'Source records are cleaned into a source table. A feature job derives features and writes them to a Unity Catalog feature table with a primary key, after quality checks pass. A training set job joins labels to the feature table point-in-time and logs the training set with the model. Unity Catalog lineage links the model back to the feature table and the source.',
        lanes: [
          { label: 'Jobs', fromRow: 0, toRow: 0 },
          { label: 'Unity Catalog', fromRow: 1, toRow: 1 },
        ],
        nodes: [
          { id: 'src', label: 'Clean source data', sub: 'typed, deduplicated', col: 0, row: 0 },
          { id: 'feat', label: 'Compute features', sub: 'then check them', col: 1, row: 0, kind: 'highlight' },
          { id: 'train', label: 'Build training set', sub: 'point-in-time join', col: 2, row: 0 },
          { id: 'model', label: 'Log model', sub: 'with the training set', col: 3, row: 0 },
          { id: 'srct', label: 'Source table', col: 0, row: 1, kind: 'store' },
          { id: 'ft', label: 'Feature table', sub: 'primary key + timestamp', col: 1, row: 1, kind: 'store' },
          { id: 'ts', label: 'Training set', sub: 'snapshot if long-lived', col: 2, row: 1, kind: 'store' },
          { id: 'reg', label: 'Registered model', sub: 'lineage to features', col: 3, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'src', to: 'feat' },
          { from: 'feat', to: 'train' },
          { from: 'train', to: 'model' },
          { from: 'src', to: 'srct' },
          { from: 'feat', to: 'ft' },
          { from: 'train', to: 'ts' },
          { from: 'model', to: 'reg' },
        ],
        legend: [
          { kind: 'highlight', label: 'Gate: checks must pass' },
          { kind: 'store', label: 'Unity Catalog object' },
        ],
      },
      examples: [
        {
          label: 'Create a point-in-time feature table',
          language: 'python',
          code: `from databricks.feature_engineering import FeatureEngineeringClient

fe = FeatureEngineeringClient()
fe.create_table(
    name="main.ml.customer_features",
    primary_keys=["customer_id", "as_of_date"],
    timeseries_columns="as_of_date",
    df=features_df,
    description="Customer activity features, one row per customer per day",
)`,
          notes: ['A timeseries column makes the table eligible for point-in-time lookups.'],
        },
      ],
    },
    {
      id: 'quality',
      heading: 'Check features before anyone trains on them',
      prose:
        'Run the checks in the job that writes the feature table and fail the task on a violation, so a bad table never reaches a training set.',
      points: [
        {
          strong: 'Key checks.',
          text: 'The primary key is not null and unique. Duplicate keys make a lookup return the wrong row.',
        },
        {
          strong: 'Null and range checks.',
          text: 'Each feature has a null policy. Decide where null is meaningful and where you fill it, and add a flag column when you fill so the model can tell the difference.',
        },
        {
          strong: 'Distribution checks.',
          text: 'Compare new feature statistics to a baseline. Data quality monitoring on the feature table tracks drift and null rates over time.',
        },
        {
          strong: 'Use pipeline expectations when the features come from a pipeline.',
          text: 'Expectations enforce constraints inside the pipeline, with fail or drop actions per rule.',
        },
      ],
    },
    {
      id: 'version',
      heading: 'Point-in-time training sets and reproducibility',
      prose:
        'A plain join on the key lets a label from last March see a feature value computed this week. That leaks the future and inflates offline accuracy. Give the training set the label time and let it pick the right feature row.',
      examples: [
        {
          label: 'Point-in-time training set, logged with the model',
          language: 'python',
          code: `from databricks.feature_engineering import FeatureLookup

lookups = [
    FeatureLookup(
        table_name="main.ml.customer_features",
        lookup_key="customer_id",
        timestamp_lookup_key="label_date",
    )
]
training_set = fe.create_training_set(
    df=labels_df,  # customer_id, label_date, churned
    feature_lookups=lookups,
    label="churned",
)
train_df = training_set.load_df()

fe.log_model(
    model=model,
    artifact_path="model",
    flavor=mlflow.sklearn,
    training_set=training_set,
    registered_model_name="main.ml.churn_model",
)`,
          notes: [
            'Scoring with fe.score_batch or a serving endpoint looks up the same features by key.',
            'Unity Catalog lineage then links the model to its feature tables and the source behind them.',
          ],
        },
        {
          label: 'Refresh a feature table with MERGE',
          language: 'python',
          code: `fe.write_table(
    name="main.ml.customer_features",
    df=changed_features_df,
    mode="merge",
)`,
          notes: ['A merge on the primary key updates changed rows and adds new ones. Rerunning the same batch is safe.'],
        },
      ],
      points: [
        {
          strong: 'Record what a model trained on.',
          text: 'Log the training dataset to MLflow and store the feature table version. Delta table history gives you the version number.',
        },
        {
          strong: 'Time travel has a limit.',
          text: 'VERSION AS OF reads old files. VACUUM deletes files older than delta.deletedFileRetentionDuration (7 days by default), and the log is trimmed after delta.logRetentionDuration. Past that window the version is gone.',
        },
        {
          strong: 'Pin what must last.',
          text: 'For audits and long-lived models, write the training set to its own table, or DEEP CLONE the feature table at the version you used. A shallow clone still depends on the source’s files, so it is not durable.',
        },
        {
          strong: 'Or extend retention deliberately.',
          text: 'Raising deletedFileRetentionDuration keeps more history at the cost of storage. Choose it per table instead of globally.',
        },
      ],
      links: [
        { label: 'Feature tables in Unity Catalog', url: 'https://docs.databricks.com/aws/en/machine-learning/feature-store/uc/feature-tables-uc' },
        { label: 'Point-in-time feature joins', url: 'https://docs.databricks.com/aws/en/machine-learning/feature-store/time-series' },
        { label: 'Delta table history and time travel', url: 'https://docs.databricks.com/aws/en/delta/history' },
      ],
    },
  ],
  related: [
    { slug: 'model-training-compatibility', title: 'Training and bringing existing models' },
    { slug: 'experiment-tracking', title: 'Reproducible experiments' },
    { slug: 'medallion-architecture', title: 'Medallion architecture' },
  ],
};
