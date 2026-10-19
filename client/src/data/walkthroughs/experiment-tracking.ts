import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'experiment-tracking',
  area: 'ML Guides',
  title: 'Reproducible experiments',
  intro:
    'A tracked run records its data version, code reference, and environment. A second run reads only those records and trains again. In the reference run both runs scored the same AUC, 0.947689, even though the data table had grown by then.',
  shortVersion: [
    {
      title: 'The run carries its inputs.',
      body: 'Tags hold the table name, Delta version, git SHA, code hash, and library versions.',
    },
    {
      title: 'The data moves on.',
      body: 'A task appends 2,000 rows after the tracked run, so the latest table no longer matches what the run used.',
    },
    {
      title: 'The rerun reads the record.',
      body: 'It queries VERSION AS OF the recorded version, not the latest one.',
    },
    {
      title: 'The assertion is explicit.',
      body: 'The task fails if the AUC differs by more than 0.001 or the code hash changed.',
    },
    {
      title: 'A control shows why it matters.',
      body: 'Training on the latest data scored 0.946307, so skipping the version would have given a different number.',
    },
  ],
  sections: [
    {
      id: 'job',
      heading: 'Track, change the data, rerun',
      prose:
        'Three tasks run in order. The middle one exists to make the table change, which is what a real team hits between an experiment and its replay.',
      diagram: {
        type: 'flow',
        title: 'The reproduction job',
        description:
          'tracked_run writes experiment_data at version 2 and logs an MLflow run with data_version, git_sha, code_hash, and environment tags. append_new_data adds 2,000 rows and moves the table to version 3. rerun_and_compare reads the tags, reads experiment_data VERSION AS OF 2, trains again, logs a rerun, and writes experiment_reproductions.',
        lanes: [
          { label: 'Lakeflow job', fromRow: 0, toRow: 0 },
          { label: 'Records', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'track', label: 'tracked_run', mono: true, sub: 'train and log', col: 0, row: 0, kind: 'highlight' },
          { id: 'app', label: 'append_new_data', mono: true, sub: '+2,000 rows', col: 1, row: 0 },
          { id: 'rerun', label: 'rerun_and_compare', mono: true, sub: 'assert within 0.001', col: 2, row: 0, kind: 'highlight' },
          { id: 'run1', label: 'MLflow run', sub: 'tags: data, code, env', col: 0, row: 1, kind: 'surface' },
          { id: 'tbl', label: 'experiment_data', mono: true, sub: 'two Delta versions', col: 1, row: 1, kind: 'store' },
          { id: 'run2', label: 'MLflow rerun', sub: 'reproduces_run_id', col: 2, row: 1, kind: 'surface' },
          { id: 'res', label: 'experiment_reproductions', mono: true, col: 2, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'track', to: 'app' },
          { from: 'app', to: 'rerun' },
          { from: 'track', to: 'run1' },
          { from: 'track', to: 'tbl' },
          { from: 'app', to: 'tbl' },
          { from: 'run1', to: 'rerun', label: 'read tags' },
          { from: 'tbl', to: 'rerun', dashed: true, label: 'VERSION AS OF' },
          { from: 'rerun', to: 'run2' },
          { from: 'rerun', to: 'res' },
        ],
        legend: [
          { kind: 'highlight', label: 'Trains the model' },
          { kind: 'surface', label: 'MLflow run' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
      },
    },
    {
      id: 'refs',
      heading: 'What the run records',
      examples: [
        {
          label: 'Log the table version as a run input',
          language: 'py',
          code: 'import mlflow\n\n# Pin the Delta version, then attach it to the run as a dataset input.\ndataset = mlflow.data.load_delta(\n    table_name="<catalog>.<schema>.experiment_data",\n    version="3",\n)\nwith mlflow.start_run():\n    mlflow.log_input(dataset, context="training")\n    train_df = dataset.df  # Spark DataFrame at that version',
          notes: ['The reference code stores the version as a tag instead. log_input shows the same version under the run\'s dataset inputs.'],
        },
      ],
      prose: 'Each reference answers one question about where the result came from.',
      diagram: {
        type: 'matrix',
        title: 'Recorded references and how the rerun uses them',
        description:
          'Data version is a Delta version and the rerun reads VERSION AS OF it. Code is a git SHA and a hash of the training functions, and the rerun fails if the hash differs. Environment is a JSON of library versions, and the rerun reports differences.',
        corner: 'Reference ↓',
        columns: ['Recorded as', 'Rerun action'],
        rows: [
          {
            label: 'Data',
            sub: 'what rows',
            cells: [
              { state: 'own', text: 'data_version', sub: 'Delta version' },
              { state: 'own', text: 'VERSION AS OF' },
            ],
          },
          {
            label: 'Code',
            sub: 'what logic',
            cells: [
              { state: 'own', text: 'git_sha, code_hash' },
              { state: 'own', text: 'fail on hash change' },
            ],
          },
          {
            label: 'Environment',
            sub: 'what libraries',
            cells: [
              { state: 'own', text: 'environment JSON' },
              { state: 'optional', text: 'report differences' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Enforced' },
          { state: 'optional', label: 'Reported only' },
        ],
        caption: 'The git SHA is the release job parameter; this run used the default, local. CI sets it to the commit SHA.',
      },
    },
    {
      id: 'result',
      heading: 'The comparison',
      prose:
        'experiment_reproductions holds one row per rerun. The latest-data AUC is a control, not a pass condition.',
      table: {
        caption: 'Reference run',
        columns: ['Field', 'Value'],
        rows: [
          ['Original AUC', '0.947689'],
          ['Rerun AUC', '0.947689'],
          ['Tolerance', '0.001'],
          ['Data version used', '2 (table was at 3)'],
          ['Code hash match, environment changes', 'true, none'],
          ['AUC on latest data (control)', '0.946307'],
        ],
      },
    },
    {
      id: 'check',
      heading: 'Check it yourself',
      steps: [
        {
          title: 'Read the tags',
          body: 'Open the tracked-run run in the experiment and read data_version, git_sha, code_hash, and environment.',
        },
        {
          title: 'Compare the table history',
          body: 'DESCRIBE HISTORY experiment_data shows the append after the tracked run.',
          code: 'SELECT * FROM experiment_reproductions ORDER BY checked_at DESC;',
        },
        {
          title: 'Change the code',
          body: 'Edit make_pipeline in src/ml_common.py, redeploy, and rerun rerun_and_compare alone with the earlier run ID. It fails on the code hash.',
        },
      ],
    },
  ],
  related: [
    { slug: 'model-training-compatibility', title: 'Training and bringing existing models' },
    { slug: 'model-performance-drift', title: 'Model quality and drift' },
  ],
};
