import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'model-deployment-cicd',
  area: 'ML Guides',
  title: 'Model release pipeline',
  intro:
    'A model release should be a repeatable path with checks, a human approval, and a record, not a manual alias change. On Databricks the pieces are Unity Catalog model versions and aliases, automated test gates, a protected CI environment for approval, a catalog per environment, Model Serving for rollout, and Unity Gateway for limits and logging. This page describes the pattern and why each part is there.',
  businessValue: {
    summary:
      'Model releases follow a repeatable path with tests, a recorded human approval, and a one-step rollback. ML program owners get controlled production changes instead of manual alias edits.',
    outcomes: [
      {
        title: 'Rollback in one step',
        body:
          'A release moves a Unity Catalog alias to a new model version, and a rollback moves it back. Versions are immutable, so the previous model is still there.',
      },
      {
        title: 'Weak models caught before release',
        body:
          'Signature checks, a prediction smoke test, and a comparison against the current champion run before promotion. LLM apps gate on an MLflow 3 GenAI evaluation.',
      },
      {
        title: 'Approval on record',
        body:
          'Required reviewers on a protected CI environment approve each release, and the job records who did. Auditors can see who signed off.',
      },
      {
        title: 'Gradual exposure',
        body:
          'Traffic splits, Unity Gateway rate limits, and inference tables let a team watch a new model on part of the traffic before full cutover.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Aliases are the release pointer.',
      body: 'Unity Catalog model versions are immutable. Serving and batch jobs load models:/name@champion, so a release is moving one alias and a rollback is moving it back. Stages are gone.',
    },
    {
      title: 'Gate before you promote.',
      body: 'Check the signature, run a prediction smoke test, and compare against the current champion. For LLM apps, run an MLflow 3 GenAI evaluation with scorers as the gate.',
    },
    {
      title: 'Approval is an environment rule.',
      body: 'Require reviewers on a protected CI environment. The job runs only after they approve, and it records who did.',
    },
    {
      title: 'Separate environments by catalog.',
      body: 'Dev, staging, and prod each get a catalog. Train once and promote the version with copy_model_version, or retrain from the same code in each environment.',
    },
    {
      title: 'Roll out gradually, then watch.',
      body: 'Split traffic between the current and new version, set Unity Gateway rate limits, and log requests to inference tables. Authenticate CI with GitHub OIDC, not a stored token.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'The release pattern',
      prose:
        'Each step produces an input for the next, and any failed gate leaves the champion alias where it was.',
      diagram: {
        type: 'flow',
        title: 'From a trained version to a live endpoint',
        description:
          'Training logs a model version to Unity Catalog and sets the challenger alias. Test gates check the signature, a smoke test, and the metric against the champion. A protected environment holds the approval. After approval the champion alias moves, or the version is copied to the production catalog. The endpoint deploys the champion, traffic shifts gradually, and a release record is written.',
        nodes: [
          { id: 'train', label: 'Train and log', sub: 'new UC model version', col: 0, row: 0 },
          { id: 'chal', label: '@challenger', sub: 'alias on the new version', mono: true, col: 1, row: 0, kind: 'store' },
          { id: 'gates', label: 'Test gates', sub: 'signature, smoke, metric', col: 2, row: 0, kind: 'gate' },
          { id: 'appr', label: 'Approval', sub: 'protected environment', col: 3, row: 0, kind: 'gate' },
          { id: 'champ', label: '@champion', sub: 'or copy to prod catalog', mono: true, col: 3, row: 1, kind: 'highlight' },
          { id: 'ep', label: 'Serving endpoint', sub: 'traffic split, canary', col: 2, row: 1 },
          { id: 'gw', label: 'Unity Gateway', sub: 'rate limits, inference log', col: 1, row: 1, kind: 'surface' },
          { id: 'rec', label: 'Release record', sub: 'who, what, when', col: 0, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'train', to: 'chal' },
          { from: 'chal', to: 'gates' },
          { from: 'gates', to: 'appr', label: 'pass' },
          { from: 'appr', to: 'champ', label: 'approved' },
          { from: 'champ', to: 'ep' },
          { from: 'ep', to: 'gw' },
          { from: 'gw', to: 'rec' },
        ],
        legend: [
          { kind: 'gate', label: 'Stops the release on failure' },
          { kind: 'highlight', label: 'Production pointer' },
          { kind: 'store', label: 'Unity Catalog record' },
        ],
        caption: 'Rollback is the same step in reverse: point @champion at the previous version and redeploy.',
      },
    },
    {
      id: 'aliases',
      heading: 'Aliases and one catalog per environment',
      prose:
        'Unity Catalog replaces workspace registry stages with aliases, which are mutable names on immutable versions. Pair them with a catalog per environment so access control follows the environment.',
      points: [
        {
          strong: 'Aliases carry the state.',
          text: 'Use challenger for a candidate under test and champion for the version in production. Consumers always load by alias, so they pick up a move on the next load.',
        },
        {
          strong: 'Catalogs carry the environment.',
          text: 'Keep dev, staging, and prod in separate catalogs with separate grants. Only the CI service principal can write to the production catalog.',
        },
        {
          strong: 'Pick a promotion pattern on purpose.',
          text: 'Deploy code trains the model in each environment from the same code and is the recommended default, since production data stays in production. Deploy models trains once in dev and copies the version up with copy_model_version. Use it when production data is not reachable from dev, or a validated artifact must move unchanged.',
        },
        {
          strong: 'Tag every version.',
          text: 'Record the Git commit, the CI run, the training run, and test results as version tags. They are your audit trail inside Unity Catalog.',
        },
      ],
      examples: [
        {
          label: 'Promote across catalogs, then move the alias',
          language: 'python',
          code: `import mlflow
from mlflow import MlflowClient

mlflow.set_registry_uri("databricks-uc")
client = MlflowClient()

# Copy the tested version into the production catalog
copied = client.copy_model_version(
    src_model_uri="models:/staging.churn.classifier/7",
    dst_name="prod.churn.classifier",
)

# Point production consumers at it
client.set_registered_model_alias("prod.churn.classifier", "champion", copied.version)`,
          notes: ['The copy keeps the artifacts and signature. Tag the new version with the source version and the approver.'],
        },
      ],
      links: [
        {
          label: 'Models in Unity Catalog',
          url: 'https://docs.databricks.com/aws/en/machine-learning/manage-model-lifecycle',
        },
        {
          label: 'Upgrade workflows from the workspace registry',
          url: 'https://docs.databricks.com/aws/en/machine-learning/manage-model-lifecycle/upgrade-workflows',
          note: 'Replace stages with aliases and promote across environments.',
        },
        {
          label: 'MLOps deployment patterns',
          url: 'https://docs.databricks.com/aws/en/machine-learning/mlops/deployment-patterns',
        },
      ],
    },
    {
      id: 'gates',
      heading: 'Gates that decide a promotion',
      prose:
        'Put the checks in code, run them on every candidate, and let a failure stop the job before an alias moves.',
      points: [
        {
          strong: 'Contract checks.',
          text: 'The model has a signature, accepts a sample input, and returns the expected output shape.',
        },
        {
          strong: 'Quality bar.',
          text: 'The candidate meets a minimum on a held-out set that production data cannot leak into. Keep the bar in bundle variables so each environment can set its own.',
        },
        {
          strong: 'Champion comparison.',
          text: 'The candidate beats, or stays within an allowed margin of, the current champion on the same data.',
        },
        {
          strong: 'LLM apps use MLflow 3 evaluation.',
          text: 'Run mlflow.genai.evaluate with an evaluation dataset and scorers, such as correctness, safety, and custom checks. Fail the gate on a score below your bar. The same scorers can monitor production traffic afterward.',
        },
      ],
      examples: [
        {
          label: 'A GenAI evaluation as a CI gate',
          language: 'python',
          code: `import mlflow
from mlflow.genai.scorers import Correctness, Safety

results = mlflow.genai.evaluate(
    data=eval_dataset,
    predict_fn=app.predict,
    scorers=[Correctness(), Safety()],
)

passed = results.metrics["correctness/mean"] >= 0.85 and results.metrics["safety/mean"] >= 0.99
if not passed:
    raise SystemExit("Evaluation gate failed; the champion alias is unchanged.")`,
          notes: ['Check the metric names your scorers emit and set the bar from a baseline run, not a guess.'],
        },
      ],
      links: [
        {
          label: 'Evaluate and improve quality with MLflow 3',
          url: 'https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor',
        },
      ],
    },
    {
      id: 'approval',
      heading: 'Approval in a protected environment, and OIDC for CI',
      prose:
        'Approval should be a rule the system enforces, not a parameter someone types. Use the environment protection of your CI system.',
      steps: [
        {
          title: 'Run gates on every pull request',
          body: 'Unit tests and bundle validation run before merge. A candidate model is trained and gated in dev after merge.',
        },
        {
          title: 'Hold the promotion at a protected environment',
          body: 'In GitHub, create an environment with required reviewers and use it on the job that promotes to staging or production. The job waits until a reviewer approves, and the approving actor is available to record.',
        },
        {
          title: 'Authenticate with GitHub OIDC',
          body: 'Create a service principal with a federation policy that trusts the repository and environment. The workflow gets a short-lived token, so there is no Databricks secret to rotate or leak.',
          code: `jobs:
  promote:
    runs-on: ubuntu-latest
    environment: production        # required reviewers approve here
    permissions:
      id-token: write              # lets the job request an OIDC token
      contents: read
    env:
      DATABRICKS_HOST: \${{ vars.DATABRICKS_HOST }}
      DATABRICKS_CLIENT_ID: \${{ vars.DATABRICKS_CLIENT_ID }}
      DATABRICKS_AUTH_TYPE: github-oidc
    steps:
      - uses: actions/checkout@v4
      - uses: databricks/setup-cli@main
      - run: databricks bundle run model_release --target prod --params approved_by=\${{ github.actor }}`,
        },
        {
          title: 'Limit who can change the alias',
          body: 'Only the CI service principal should own the production model or hold privileges to set its alias. Humans propose through pull requests.',
        },
      ],
      links: [
        {
          label: 'Workload identity federation for GitHub Actions',
          url: 'https://docs.databricks.com/aws/en/dev-tools/auth/provider-github',
        },
        {
          label: 'GitHub Actions with Databricks',
          url: 'https://docs.databricks.com/aws/en/dev-tools/ci-cd/github',
        },
      ],
    },
    {
      id: 'rollout',
      heading: 'Roll out, split traffic, and roll back',
      prose:
        'An alias move changes what a deployment loads. A serving endpoint can also hold two versions at once and divide traffic between them.',
      points: [
        {
          strong: 'Canary with a traffic split.',
          text: 'Serve the current and new versions as two served entities on one endpoint, send a small share to the new one, and widen it as metrics hold. The same mechanism supports A/B tests.',
        },
        {
          strong: 'Wait for READY.',
          text: 'Deployment is asynchronous. Poll the endpoint until the config update finishes, then send a test request before you shift traffic.',
        },
        {
          strong: 'Roll back by alias.',
          text: 'Set @champion back to the previous version and update the endpoint. Because versions are immutable, the old model is exactly what it was.',
        },
        {
          strong: 'Keep a fast path for incidents.',
          text: 'Document who can roll back and the single command or workflow that does it. Do not wait for a full release run.',
        },
      ],
      examples: [
        {
          label: 'A 90/10 canary on one endpoint',
          language: 'json',
          code: `{
  "served_entities": [
    {"name": "current", "entity_name": "prod.churn.classifier", "entity_version": "6",
     "workload_size": "Small", "scale_to_zero_enabled": false},
    {"name": "canary", "entity_name": "prod.churn.classifier", "entity_version": "7",
     "workload_size": "Small", "scale_to_zero_enabled": false}
  ],
  "traffic_config": {"routes": [
    {"served_model_name": "current", "traffic_percentage": 90},
    {"served_model_name": "canary", "traffic_percentage": 10}
  ]}
}`,
          notes: ['Apply with the endpoint config update API. Move to 100 and remove the old entity when the canary holds.'],
        },
      ],
      links: [
        {
          label: 'Serve multiple models on one endpoint',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/serve-multiple-models-to-serving-endpoint',
          note: 'Traffic split.',
        },
        {
          label: 'Create and manage serving endpoints',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/create-manage-serving-endpoints',
        },
      ],
    },
    {
      id: 'guardrails',
      heading: 'Limits and logging at the endpoint',
      prose:
        'Unity Gateway sits in front of serving endpoints. Turn it on for every production endpoint so a release comes with limits and a request log.',
      points: [
        {
          strong: 'Rate limits.',
          text: 'Cap queries per minute for the endpoint, per user, or per group, so one client cannot starve others. Token-based limits do not apply to custom model endpoints.',
        },
        {
          strong: 'Inference tables.',
          text: 'Log requests and responses to a Unity Catalog table. Use it to debug a bad release, to compare versions during a canary, and as the input to quality monitoring.',
        },
        {
          strong: 'Permissions.',
          text: 'Grant callers CAN QUERY on the endpoint and keep CAN MANAGE to the CI service principal and the owning team.',
        },
      ],
      links: [
        {
          label: 'Unity Gateway rate limits',
          url: 'https://docs.databricks.com/aws/en/ai-gateway/configure-ai-gateway-endpoints',
        },
        {
          label: 'Inference tables',
          url: 'https://docs.databricks.com/aws/en/ai-gateway/inference-tables',
        },
      ],
    },
    {
      id: 'record',
      heading: 'Keep a release record',
      prose:
        'A release record answers who shipped which version, when, with what evidence. Write it as the last step of the job, and make it queryable.',
      points: [
        {
          strong: 'What to store.',
          text: 'Model name and version, aliases moved, git commit, CI run, approver, target environment, endpoint, and the gate results.',
        },
        {
          strong: 'Where.',
          text: 'Version tags in Unity Catalog and an append-only Delta table for history across versions. Unity Catalog audit logs add who changed an alias.',
        },
        {
          strong: 'Why it matters.',
          text: 'The record makes a rollback decision fast and gives an auditor one table to read.',
        },
      ],
    },
  ],
  related: [
    { slug: 'github-cicd', title: 'GitHub-based CI/CD' },
    { slug: 'real-time-scoring', title: 'Online model scoring' },
    { slug: 'model-performance-drift', title: 'Model quality and drift' },
  ],
};
