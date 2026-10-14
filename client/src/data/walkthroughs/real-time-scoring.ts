import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'real-time-scoring',
  area: 'ML Guides',
  title: 'Online model scoring',
  intro:
    'A job trains a small model, deploys it to a Model Serving endpoint that scales to zero, and scores it with an OAuth token from the SDK. It times 71 requests and sends four bad ones. A second job deletes the endpoint.',
  shortVersion: [
    {
      title: 'The model comes from a spec.',
      body: 'dbldatagen builds 5,000 training rows from the use-case file, and the trained model is registered in Unity Catalog.',
    },
    {
      title: 'The endpoint is small and idle-free.',
      body: 'Workload size Small with scale-to-zero on, so it costs nothing while nobody calls it.',
    },
    {
      title: 'Requests carry an OAuth token.',
      body: 'The SDK supplies the bearer header. There is no PAT and no secret in the code.',
    },
    {
      title: 'Latency is recorded per request.',
      body: 'In the reference run, 50 sequential requests had p50 43.6 ms and p95 99.7 ms.',
    },
    {
      title: 'Bad requests fail cleanly.',
      body: 'Malformed JSON and a missing required feature return 400. A missing optional feature is scored.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'From spec to measured endpoint',
      prose:
        'Three tasks run in order. The last one writes two tables. A separate teardown job deletes the endpoint, so a run leaves nothing serving.',
      diagram: {
        type: 'flow',
        title: 'Scoring job and teardown',
        description:
          'The use-case spec feeds train_register, which registers a Unity Catalog model. deploy_endpoint creates or updates a Small scale-to-zero serving endpoint from that model. score_and_measure sends OAuth-authenticated requests to the endpoint and writes scoring_latency and scoring_errors. A separate teardown job deletes the endpoint.',
        lanes: [
          { label: 'Lakeflow job', fromRow: 0, toRow: 0 },
          { label: 'Serving and tables', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'train', label: 'train_register', mono: true, sub: 'dbldatagen + sklearn', col: 0, row: 0 },
          { id: 'deploy', label: 'deploy_endpoint', mono: true, sub: 'Small, scale to zero', col: 1, row: 0 },
          { id: 'score', label: 'score_and_measure', mono: true, sub: 'OAuth bearer header', col: 2, row: 0, kind: 'highlight' },
          { id: 'model', label: 'account_risk_model', mono: true, sub: 'Unity Catalog model', col: 0, row: 1, kind: 'store' },
          { id: 'endpoint', label: 'Serving endpoint', sub: 'capability-guides-...', col: 1, row: 1, kind: 'surface' },
          { id: 'latency', label: 'scoring_latency', mono: true, sub: '71 rows', col: 2, row: 1, kind: 'store' },
          { id: 'teardown', label: 'Teardown job', sub: 'deletes the endpoint', col: 1, row: 2 },
          { id: 'errors', label: 'scoring_errors', mono: true, sub: '4 rows', col: 2, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'train', to: 'model' },
          { from: 'model', to: 'deploy', label: 'alias + version' },
          { from: 'deploy', to: 'endpoint' },
          { from: 'score', to: 'endpoint', label: 'HTTPS' },
          { from: 'score', to: 'latency' },
          { from: 'score', to: 'errors' },
          { from: 'teardown', to: 'endpoint', dashed: true, label: 'delete' },
        ],
        legend: [
          { kind: 'highlight', label: 'Measures and records' },
          { kind: 'surface', label: 'Model Serving endpoint' },
          { kind: 'store', label: 'Unity Catalog model or table' },
          { kind: 'dashed', label: 'Cleanup' },
        ],
      },
    },
    {
      id: 'latency',
      heading: 'What the requests measured',
      prose:
        'The job sends one request, then 50 one at a time, then 20 through five workers. The first request in this run found a running replica, because the job updated an endpoint that was already serving. It is not a cold start. A cold start appears when a request reaches an endpoint that scaled to zero after sitting idle.',
      diagram: {
        type: 'matrix',
        title: 'Latency by phase, reference run',
        description:
          'First request: 1 request, 120.7 ms. Warm sequential: 50 requests, p50 43.6 ms, p95 99.7 ms, max 117.5 ms. Concurrent with five workers: 20 requests, p50 40.6 ms, p95 74.6 ms, max 83.7 ms.',
        corner: 'Phase ↓ · Measure →',
        columns: ['Requests', 'p50', 'p95'],
        rows: [
          {
            label: 'first_request',
            sub: 'after deploy',
            cells: [
              { state: 'optional', text: '1' },
              { state: 'optional', text: '120.7 ms' },
              { state: 'none', text: 'n/a' },
            ],
          },
          {
            label: 'warm',
            sub: 'sequential',
            cells: [
              { state: 'own', text: '50' },
              { state: 'own', text: '43.6 ms' },
              { state: 'own', text: '99.7 ms' },
            ],
          },
          {
            label: 'concurrent',
            sub: '5 workers',
            cells: [
              { state: 'own', text: '20' },
              { state: 'own', text: '40.6 ms' },
              { state: 'own', text: '74.6 ms' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Percentile from many requests' },
          { state: 'optional', label: 'Single request' },
          { state: 'none', label: 'Not defined for one request' },
        ],
        caption: 'All 71 requests returned 200. Rows are in scoring_latency, one per request.',
      },
    },
    {
      id: 'failures',
      heading: 'What happens on a bad request',
      prose:
        'Each scenario is sent on purpose. The job records the status and message in scoring_errors and marks whether the status matched what the guide expects. The run fails if any scenario behaves differently.',
      diagram: {
        type: 'flow',
        title: 'Four failure scenarios',
        description:
          'A malformed JSON body and a body with an unknown top-level key both return 400. A request that omits a required feature returns 400 with a message naming the missing input. A request that omits the optional feature is scored, because the model fills the training median. All four outcomes are written to scoring_errors.',
        nodes: [
          { id: 'bad', label: 'Malformed JSON', sub: 'truncated body', col: 0, row: 0 },
          { id: 'shape', label: 'Unknown top-level key', sub: 'rows instead of records', col: 0, row: 1 },
          { id: 'req', label: 'Required feature gone', sub: 'tenure_months omitted', col: 0, row: 2 },
          { id: 'opt', label: 'Optional feature gone', sub: 'usage_score omitted', col: 0, row: 3 },
          { id: 'gate', label: 'Schema check', sub: 'MLflow signature', col: 1, row: 1, kind: 'gate' },
          { id: 'reject', label: '400 and error text', sub: 'request rejected', col: 2, row: 1 },
          { id: 'impute', label: 'Median imputed', sub: 'model still scores', col: 2, row: 3, kind: 'highlight' },
          { id: 'ok', label: '200 and prediction', col: 3, row: 3 },
          { id: 'table', label: 'scoring_errors', mono: true, sub: 'status, message, outcome', col: 3, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'bad', to: 'gate' },
          { from: 'shape', to: 'gate' },
          { from: 'req', to: 'gate' },
          { from: 'gate', to: 'reject', label: 'fails' },
          { from: 'opt', to: 'impute', label: 'allowed' },
          { from: 'impute', to: 'ok' },
          { from: 'reject', to: 'table' },
          { from: 'ok', to: 'table', dashed: true },
        ],
        legend: [
          { kind: 'gate', label: 'Request validation' },
          { kind: 'highlight', label: 'Handled in the model' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
        caption: 'The signature marks usage_score optional, and the first pipeline step adds it as NaN for the imputer.',
      },
    },
    {
      id: 'scaling',
      heading: 'How it scales',
      prose:
        'The endpoint is Small with scale-to-zero on. These are the levers that change its cost and latency.',
      table: {
        columns: ['Lever', 'What it does'],
        rows: [
          ['Scale-to-zero', 'Releases compute after idle time. The next request waits for a replica to start. Turn it off when a latency target rules out a cold start.'],
          ['Workload size', 'Sets the range of provisioned concurrency: how many requests run at once. Requests above it queue, so raise the size when p95 climbs.'],
          ['Route optimization', 'A faster request path that needs a JWT OAuth token scoped to the endpoint. The job code does the token exchange; the serverless job token is not a JWT, so the reference run leaves it off.'],
          ['Provisioned throughput', 'Reserves tokens per second for foundation models. It does not apply to this scikit-learn model.'],
        ],
      },
    },
    {
      id: 'cleanup',
      heading: 'Clean up',
      steps: [
        {
          title: 'Run the teardown job',
          body: 'capability_guides_realtime_scoring_teardown deletes the endpoint and polls the endpoint list until the name is gone. A missing endpoint is not an error, so it is safe to rerun.',
        },
        {
          title: 'Keep the measurements',
          body: 'The model, scoring_latency, and scoring_errors stay in Unity Catalog, so the numbers survive the endpoint.',
        },
      ],
    },
  ],
  related: [
    { slug: 'model-deployment-cicd', title: 'Model release pipeline' },
    { slug: 'model-performance-drift', title: 'Model quality and drift' },
  ],
};
