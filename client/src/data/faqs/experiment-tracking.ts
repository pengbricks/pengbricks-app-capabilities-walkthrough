import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Why log the dataset with mlflow.log_input instead of tagging a version number?',
    answer:
      'A tag is a note. A logged dataset is a typed input, so MLflow stores its source, a digest, and its schema, and you can search runs by dataset digest to find every model trained on the same data. Use tags only for extra context.',
    links: [{ label: 'MLflow tracking on Databricks', url: 'https://docs.databricks.com/aws/en/mlflow/tracking' }],
  },
  {
    question: 'Is mlflow.autolog() enough to make a run reproducible?',
    answer:
      'No. Autologging captures parameters, metrics, and the model for supported libraries, but it does not know your data version, seed, or Git commit. Turn it on and add explicit calls for the dataset input, seed, commit, and pinned requirements.',
    links: [
      { label: 'Databricks autologging', url: 'https://docs.databricks.com/aws/en/mlflow/databricks-autologging' },
    ],
  },
  {
    question: 'How do I record the Git commit when CI launches the run?',
    answer:
      'MLflow stores the commit automatically for runs from a Git folder or a job with a Git source. When CI launches the run, pass the commit SHA as a parameter and set it as the mlflow.source.git.commit tag.',
  },
  {
    question: 'Should a rerun match the original metric exactly?',
    answer:
      'No. Even with fixed seeds, threads, GPUs, and some algorithms vary run to run. Run the same job a few times, measure the spread, and set the comparison tolerance above it. Treat a larger gap as a change in data, code, or environment.',
  },
  {
    question: 'How long can I replay a run?',
    answer:
      'Only while Delta keeps the old files. VACUUM removes files older than delta.deletedFileRetentionDuration (7 days by default), and log retention defaults to 30 days. Raise both beyond your replay window for tables behind important models.',
    links: [{ label: 'Table history and retention', url: 'https://docs.databricks.com/aws/en/tables/history' }],
  },
  {
    question: 'When do I need a deep clone of the training set?',
    answer:
      'When you must reproduce or audit a model months or years later. A deep clone is an independent copy that survives VACUUM and later changes to the source, at the cost of storage. A shallow clone still references the source files, so it does not give you this.',
    links: [{ label: 'Clone a table', url: 'https://docs.databricks.com/aws/en/tables/operations/clone' }],
  },
];
