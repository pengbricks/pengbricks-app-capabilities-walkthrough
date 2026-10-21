import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Should I train in each environment or copy a model version up?',
    answer:
      'Train in each environment (deploy code) by default, with a catalog per environment. Databricks recommends it because production data stays in production and the training code is reviewed and tested. Choose deploy models, which trains once and uses copy_model_version, when training is too costly to repeat or production data is out of reach from dev.',
    links: [
      {
        label: 'MLOps deployment patterns',
        url: 'https://docs.databricks.com/aws/en/machine-learning/mlops/deployment-patterns',
      },
    ],
  },
  {
    question: 'How do I roll back a bad model release?',
    answer:
      'Set @champion back to the previous version and update the endpoint. Unity Catalog model versions are immutable, so the old model is exactly what it was. Document who can roll back and the single command or workflow that does it, so an incident does not wait for a full release run.',
  },
  {
    question: 'How do I require a human approval before a model reaches production?',
    answer:
      'Create a protected environment with required reviewers in your CI system, and use it on the job that promotes to staging or production. The job waits until a reviewer approves, and the approving actor is available to record. Only the CI service principal should own the production model or hold the privileges to set its alias.',
    links: [
      {
        label: 'GitHub Actions with Databricks',
        url: 'https://docs.databricks.com/aws/en/dev-tools/ci-cd/github',
      },
    ],
  },
  {
    question: 'Do I need to store a Databricks token in CI?',
    answer:
      'No. Create a service principal with a federation policy that trusts the repository and environment, and set DATABRICKS_AUTH_TYPE to github-oidc. The workflow gets a short-lived token, so there is no Databricks secret to rotate or leak.',
    links: [
      {
        label: 'Workload identity federation for GitHub Actions',
        url: 'https://docs.databricks.com/aws/en/dev-tools/auth/provider-github',
      },
    ],
  },
  {
    question: 'How do I gate a promotion for an LLM app?',
    answer:
      'Run mlflow.genai.evaluate with an evaluation dataset and scorers such as correctness and safety, and fail the gate on a score below your bar. Set the bar from a baseline run, not a guess. The same scorers can monitor production traffic afterward.',
    links: [
      {
        label: 'Evaluate and improve quality with MLflow 3',
        url: 'https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor',
      },
    ],
  },
  {
    question: 'Do I need a canary split, or is moving the alias enough?',
    answer:
      'Use a canary split for models that touch customers or money, and flip the alias for the rest. A canary serves the current and new versions as two served entities on one endpoint, so you pay for both while the split runs. An alias move sends all traffic to the new version at once, so a bad model reaches everyone before metrics show it.',
    links: [
      {
        label: 'Serve multiple models on one endpoint',
        url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/serve-multiple-models-to-serving-endpoint',
      },
    ],
  },
];
