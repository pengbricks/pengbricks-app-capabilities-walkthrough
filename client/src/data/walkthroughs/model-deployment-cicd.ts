import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'model-deployment-cicd',
  area: 'ML Guides',
  title: 'Model release pipeline',
  intro:
    'One serverless job takes a churn model from training to a live endpoint. It trains on real invoice lines from UCI Online Retail II (CC BY 4.0). The job registers the model in Unity Catalog, tests it, promotes it only when someone has approved, serves it, and appends a row to a release history table. GitHub Actions runs the same job in dev and test, and the GitHub test environment approval supplies the approver.',
  shortVersion: [
    {
      title: 'Five tasks, one job.',
      body: 'train_and_register, run_tests, approval_gate, deploy_endpoint, and record_release run in order in a single job.',
    },
    {
      title: 'Tests set @challenger.',
      body: 'A version becomes @challenger only after the signature check, a prediction smoke test, an AUC threshold, and a comparison with the current @champion.',
    },
    {
      title: 'Approval sets @champion.',
      body: 'The gate moves @challenger to @champion only when approved_by is set. Without it the run ends green with the model unpromoted.',
    },
    {
      title: 'Config differs by target.',
      body: 'dev and test use different AUC thresholds, endpoint names, and approval sources. Alias names and serving size are bundle variables.',
    },
    {
      title: 'History is queryable.',
      body: 'model_release_history, version tags, and the MLflow run record who approved which version and when.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'From training to a live endpoint',
      prose:
        'Each task reads the model version from the one before it. The top row ends at the approval gate. The bottom row runs only on a promoted version, and the endpoint task leaves serving untouched when promoted is false.',
      diagram: {
        type: 'flow',
        title: 'The release job',
        description:
          'train_and_register trains a scikit-learn model and registers it in Unity Catalog. run_tests checks the signature, a prediction smoke test, the AUC threshold, and the current champion, then sets the challenger alias. approval_gate moves challenger to champion if an approver is given. deploy_endpoint serves the champion version on a Model Serving endpoint and waits for READY. record_release appends a row to model_release_history.',
        lanes: [
          { label: 'Train and test', fromRow: 0, toRow: 0 },
          { label: 'Promote and serve', fromRow: 1, toRow: 1 },
        ],
        nodes: [
          { id: 'train', label: 'train_and_register', sub: 'MLflow 3, Online Retail II', mono: true, col: 0, row: 0 },
          {
            id: 'uc',
            label: 'retail_churn_classifier',
            sub: 'UC model version',
            mono: true,
            col: 1,
            row: 0,
            kind: 'store',
          },
          {
            id: 'tests',
            label: 'run_tests',
            sub: 'AUC, signature, champion',
            mono: true,
            col: 2,
            row: 0,
            kind: 'highlight',
          },
          {
            id: 'chal',
            label: '@challenger',
            sub: 'alias on tested version',
            mono: true,
            col: 3,
            row: 0,
            kind: 'store',
          },
          { id: 'gate', label: 'approval_gate', sub: 'approved_by set?', mono: true, col: 4, row: 0, kind: 'gate' },
          { id: 'champ', label: '@champion', sub: 'approved version', mono: true, col: 4, row: 1, kind: 'store' },
          {
            id: 'ep',
            label: 'deploy_endpoint',
            sub: 'Model Serving, waits READY',
            mono: true,
            col: 3,
            row: 1,
            kind: 'surface',
          },
          { id: 'rec', label: 'record_release', sub: 'append one row', mono: true, col: 2, row: 1 },
          { id: 'hist', label: 'model_release_history', mono: true, col: 1, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'train', to: 'uc' },
          { from: 'uc', to: 'tests' },
          { from: 'tests', to: 'chal', label: 'pass' },
          { from: 'chal', to: 'gate' },
          { from: 'gate', to: 'champ', label: 'approved' },
          { from: 'champ', to: 'ep' },
          { from: 'ep', to: 'rec' },
          { from: 'rec', to: 'hist' },
        ],
        legend: [
          { kind: 'highlight', label: 'Automated quality gates' },
          { kind: 'gate', label: 'Approval' },
          { kind: 'surface', label: 'Serving endpoint' },
          { kind: 'store', label: 'Model alias or table' },
        ],
        caption:
          'Without approval, approval_gate reports promoted=false, deploy_endpoint changes nothing, and the run succeeds with no endpoint touched.',
      },
    },
    {
      id: 'ci',
      heading: 'How CI supplies the approval',
      prose:
        'model-deployment-cicd.yml tests the release logic on pull requests. On a merge to main it deploys dev and runs the job with no approver, so dev stops at the gate. After the test environment reviewers approve, it deploys test and runs the job with approved_by set to the approving GitHub actor. The deploy jobs run only when REFERENCE_CICD_ENABLED is true. See the GitHub-based CI/CD guide for the setup.',
      diagram: {
        type: 'flow',
        title: 'Dev stops at the gate, test passes it',
        description:
          'A merge to main deploys dev and runs the release job with no approver, so the model reaches the challenger alias and stops. A reviewer approves the test GitHub environment. The deploy-test job then runs the release job with approved_by set to the GitHub actor, so the model becomes champion and the endpoint is deployed.',
        nodes: [
          { id: 'main', label: 'Merge to main', col: 0, row: 0 },
          { id: 'dev', label: 'deploy-dev', sub: 'approved_by empty', mono: true, col: 1, row: 0, kind: 'highlight' },
          { id: 'rev', label: 'Reviewer approves', sub: 'test environment', col: 2, row: 0, kind: 'gate' },
          {
            id: 'tst',
            label: 'deploy-test',
            sub: 'approved_by = actor',
            mono: true,
            col: 3,
            row: 0,
            kind: 'highlight',
          },
          { id: 'devout', label: '@challenger only', sub: 'no endpoint change', col: 1, row: 1, kind: 'store' },
          { id: 'tstout', label: '@champion and endpoint', sub: 'history row written', col: 3, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'main', to: 'dev' },
          { from: 'dev', to: 'rev' },
          { from: 'rev', to: 'tst', label: 'approved' },
          { from: 'dev', to: 'devout' },
          { from: 'tst', to: 'tstout' },
        ],
        legend: [
          { kind: 'highlight', label: 'Runs the release job' },
          { kind: 'gate', label: 'Required reviewers' },
        ],
      },
    },
    {
      id: 'config',
      heading: 'Configuration that changes by environment',
      examples: [
        {
          label: 'Approve by hand, or change a threshold for one deploy',
          language: 'sh',
          code: '# Approve a release without CI: pass the approver as a job parameter.\ndatabricks bundle run capability_guides_model_release -t dev \\\n  --params approved_by=<your-name>\n\n# Raise the AUC floor for one deploy without editing databricks.yml.\ndatabricks bundle deploy -t dev --var min_auc=0.8',
          notes: ['The reference run takes the approver from GitHub Actions instead.'],
        },
      ],
      prose:
        'The bundle sets thresholds per target in databricks.yml. test is stricter than dev: a higher AUC floor and no allowed regression against the champion. Both floors sit low because real churn is hard to predict: the model scores about 0.72 on Online Retail II, where the earlier synthetic data scored about 0.98. Approval also comes from a different place.',
      diagram: {
        type: 'matrix',
        title: 'dev vs test',
        description:
          'dev requires a minimum AUC of 0.65 and allows an AUC regression of 0.02 against the champion. test requires 0.70 and allows 0.0. The dev endpoint is capability-guides-model-dev and the test endpoint is capability-guides-model-test. In dev, approval is the approved_by job parameter, empty in CI. In test, approval is the GitHub test environment reviewers.',
        corner: 'Setting ↓ · Target →',
        columns: ['dev', 'test'],
        rows: [
          {
            label: 'min_auc',
            sub: 'floor to become @challenger',
            cells: [
              { state: 'optional', text: '0.65' },
              { state: 'own', text: '0.70' },
            ],
          },
          {
            label: 'max_auc_regression',
            sub: 'allowed drop vs @champion',
            cells: [
              { state: 'optional', text: '0.02' },
              { state: 'own', text: '0.0' },
            ],
          },
          {
            label: 'Endpoint name',
            sub: 'capability-guides-model-<target>',
            cells: [
              { state: 'optional', text: 'capability-guides-model-dev' },
              { state: 'own', text: 'capability-guides-model-test' },
            ],
          },
          {
            label: 'Approval source',
            cells: [
              { state: 'optional', text: 'approved_by parameter', sub: 'Empty in CI, set by hand to promote' },
              { state: 'own', text: 'test environment reviewers', sub: 'Approving GitHub actor' },
            ],
          },
          {
            label: 'Names and tags',
            cells: [
              { state: 'optional', text: 'Development mode', sub: 'release tag' },
              { state: 'own', text: '[test] prefix', sub: 'environment and release tags' },
            ],
          },
        ],
        legend: [
          { state: 'optional', label: 'dev setting' },
          { state: 'own', label: 'test setting, stricter' },
        ],
        caption: 'Serving workload size is Small in both targets, and scale-to-zero is on.',
      },
    },
    {
      id: 'run',
      heading: 'The reference run',
      prose:
        'The recorded run is the second release of retail_churn_classifier. It trained version 2 on the 2010-09-01 snapshot (3,321 customers, 35.5% churned) and scored a holdout AUC of 0.7167. The champion, version 1, scores the same 0.7167 on that holdout, so the comparison passes with a regression of 0.0000 (dev allows 0.02). All four tests passed, approval moved @champion to version 2, and the job redeployed the endpoint. Scoring took 106.3 ms.',
      table: {
        caption: 'Reference run results',
        columns: ['Item', 'Value'],
        rows: [
          ['Model', 'retail_churn_classifier, version 2'],
          ['Holdout AUC', '0.7167 (champion version 1: 0.7167)'],
          ['Champion comparison', 'Regression 0.0000, allowed 0.02 in dev'],
          [
            'Tests',
            'schema_and_signature, prediction_smoke_test, quality_threshold (0.7167 >= 0.65), champion_comparison',
          ],
          ['Endpoint', 'capability-guides-model-dev'],
          ['Scoring latency', '106.3 ms'],
          ['Approval', 'approved_by recorded in model_release_history and on the version tags'],
        ],
      },
      points: [
        {
          strong: 'A tie passes.',
          text: 'The first release had no champion, so champion_comparison passed with no current champion. The second release retrained the same commit on the same pinned data, so it got the identical AUC and tied. Retraining on changed data would move the number.',
        },
        {
          strong: 'The bundle does not own the endpoint.',
          text: 'The job creates the endpoint, not the bundle, so deleting the bundle leaves it running. Delete it when you are done. A rerun with approved_by set recreates it.',
        },
        {
          strong: 'First request is slower.',
          text: 'The endpoint scales to zero, so the first request after idle includes a cold start. The task output records a first and a second request.',
        },
        {
          strong: 'Approval is a name.',
          text: 'approved_by is a string, not an identity check. Limit who can trigger the job and who reviews the test environment.',
        },
      ],
    },
    {
      id: 'audit',
      heading: 'Where the release history lives',
      steps: [
        {
          title: 'Version tags',
          body: 'Each model version carries release, git_sha, approved_by, job_run_id, training_run_url, and the test_* and tests_passed results.',
        },
        {
          title: 'Release history table',
          body: 'One row per run with the approver, status, endpoint, served version, and serving latency.',
          code: 'SELECT * FROM <catalog>.<schema>.model_release_history ORDER BY deployed_at DESC;',
        },
        {
          title: 'Rollback',
          body: 'Re-run with the previous version behind the alias. There is no automatic rollback on a failed smoke test.',
        },
      ],
    },
  ],
  related: [
    { slug: 'github-cicd', title: 'GitHub-based CI/CD' },
    { slug: 'real-time-scoring', title: 'Online model scoring' },
  ],
};
