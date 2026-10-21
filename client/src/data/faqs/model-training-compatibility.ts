import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Does Unity Catalog require a model signature?',
    answer:
      'Yes. Unity Catalog requires a signature, and it defines what a caller must send. Log it together with an input example and pinned pip requirements so serving can rebuild the environment you trained in.',
    links: [
      {
        label: 'Custom model serving requirements',
        url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/custom-models',
      },
    ],
  },
  {
    question: 'How do I catch a deployment failure before registering?',
    answer:
      'Run mlflow.models.predict on the logged model. It builds a fresh environment from the model requirements, loads the artifact, and scores an input, so missing packages, bad pins, and signature mismatches show up in seconds. Use input data with edge cases and more than one row, and make it a gate in CI.',
  },
  {
    question: 'Is it safe to bring in a pickled model?',
    answer:
      'Only from a source you control. Pickle runs arbitrary code on load and breaks across library versions. Wrap a trusted pickle as a pyfunc model so it carries a signature and requirements. Retraining in the target runtime beats carrying a binary across versions when the data and code exist.',
  },
  {
    question: 'Which model format should I choose?',
    answer:
      'Use the MLflow native flavor by default. Convert to ONNX when you need portability, and compare predictions with the original before you register. skops suits scikit-learn models when you want to load only types you list as trusted. Treat pickle as a last resort.',
  },
  {
    question: 'How do I move models from the workspace registry to Unity Catalog?',
    answer:
      'Inventory models and their consumers, register each version under a three-level name, and replace stages with aliases. A model in Production becomes a version with the champion alias. Then grant EXECUTE, repoint serving endpoints, and archive the workspace copy once nothing reads it.',
    links: [
      {
        label: 'Upgrade ML workflows to Unity Catalog',
        url: 'https://docs.databricks.com/aws/en/machine-learning/manage-model-lifecycle/upgrade-workflows',
      },
    ],
  },
  {
    question: 'Do I need Feature Views for every model?',
    answer:
      'No. Use them for features that are shared across models, use time windows, or are needed online. Package request-only transformations inside the model. Accept caller-computed values only with a parity test against training. Materializing features adds cost and a sync delay.',
    links: [
      {
        label: 'Feature Views',
        url: 'https://docs.databricks.com/aws/en/machine-learning/feature-store/feature-views',
      },
    ],
  },
];
