import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'real-time-scoring',
  area: 'ML Guides',
  title: 'Online model scoring',
  intro:
    'Online scoring is a model behind an authenticated HTTPS endpoint with a latency target. Databricks Model Serving hosts the model, scales it, and logs its traffic. Around it you decide who may call it, how much they may call, where features come from at request time, and how you will know when it slows or fails. This page covers those decisions and a repeatable way to load-test the result.',
  businessValue: {
    summary:
      'Applications can call a model over a secured HTTPS endpoint and get answers within a latency target. ML owners control who calls it, how much, and how they find out when it slows.',
    outcomes: [
      {
        title: 'Controlled access',
        body: 'CAN QUERY grants and OAuth tokens decide who can call the endpoint. Callers use M2M or workload identity federation, so no personal access tokens sit in applications.',
      },
      {
        title: 'Cost matched to demand',
        body: 'Provisioned concurrency is sized from queries per second times latency. Scale-to-zero cuts cost on quiet endpoints, at the price of a cold start.',
      },
      {
        title: 'Protection from runaway callers',
        body: 'Unity Gateway rate limits per endpoint, user, or group keep one caller from using all the capacity.',
      },
      {
        title: 'Evidence before and after launch',
        body: 'Load tests report p50, p95, and p99 latency and error rate on staging. Inference tables and endpoint alerts give an operating record in production.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Secure callers with OAuth and CAN QUERY.',
      body: 'Grant CAN QUERY to the users or service principals that call the endpoint. Callers authenticate with OAuth tokens, using M2M or workload identity federation, not personal access tokens.',
    },
    {
      title: 'Size for concurrency, not just traffic.',
      body: 'Provisioned concurrency is roughly queries per second times latency in seconds. Scale-to-zero saves cost and adds a cold start.',
    },
    {
      title: 'Limit and log at the gateway.',
      body: 'Unity Gateway applies rate limits per endpoint, user, or group, and inference tables record requests and responses for debugging and monitoring.',
    },
    {
      title: 'Serve features by key.',
      body: 'Materialize Feature Views to an online store backed by Lakebase, and let the endpoint look features up so callers send only keys and request-time values.',
    },
    {
      title: 'Load-test before launch, monitor after.',
      body: 'Ramp realistic traffic against a staging endpoint, read p50, p95, and p99 and the error rate, and keep endpoint metrics and alerts on in production.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'The request path',
      prose: 'Every online request crosses the same layers. Each layer is a place to secure, limit, or measure it.',
      diagram: {
        type: 'flow',
        title: 'From caller to prediction',
        description:
          'A caller presents an OAuth token. Unity Gateway checks permission and rate limits and logs the request to an inference table. The serving endpoint runs the model. For feature-backed models, the endpoint first looks up features by key in the online store. The response returns to the caller.',
        nodes: [
          {
            id: 'cli',
            label: 'Caller',
            sub: 'OAuth token, CAN QUERY',
            col: 0,
            row: 0,
            domain: 'neutral',
            icon: 'users',
            detail:
              'The application calling the endpoint. It presents an OAuth token and needs CAN QUERY permission on the endpoint.',
          },
          {
            id: 'gw',
            label: 'Unity Gateway',
            sub: 'rate limits, logging',
            col: 1,
            row: 0,
            kind: 'gate',
            domain: 'governance',
            detail:
              'Unity Gateway checks permission and rate limits on each request and logs it to an inference table.',
          },
          {
            id: 'ep',
            label: 'Serving endpoint',
            sub: 'model, autoscaling',
            col: 2,
            row: 0,
            kind: 'highlight',
            domain: 'ai',
            icon: 'gear-maroon',
            detail:
              'The Model Serving endpoint that runs the model and scales it. The model signature rejects malformed bodies with a 400.',
          },
          {
            id: 'on',
            label: 'Online store',
            sub: 'Lakebase feature lookup',
            col: 2,
            row: 1,
            kind: 'store',
            domain: 'data',
            icon: 'cloud-database',
            detail:
              'For feature-backed models, the endpoint looks up features by key here before it scores the request.',
          },
          {
            id: 'inf',
            label: 'Inference table',
            sub: 'requests and responses',
            col: 1,
            row: 1,
            kind: 'store',
            domain: 'ai',
            icon: 'list',
            detail: 'Stores requests and responses from the gateway, which feeds monitoring.',
          },
          {
            id: 'mon',
            label: 'Monitoring',
            sub: 'metrics, quality, alerts',
            col: 0,
            row: 1,
            kind: 'surface',
            domain: 'apps',
            icon: 'dashboard',
            detail: 'Tracks metrics, quality, and alerts, so you know when the endpoint slows or fails.',
          },
        ],
        edges: [
          { from: 'cli', to: 'gw' },
          { from: 'gw', to: 'ep' },
          { from: 'ep', to: 'on', label: 'lookup by key' },
          { from: 'gw', to: 'inf', dashed: true },
          { from: 'inf', to: 'mon', dashed: true },
        ],
        legend: [
          { kind: 'gate', label: 'Auth and limits' },
          { kind: 'store', label: 'Stored state' },
          { kind: 'surface', label: 'Observability' },
        ],
        caption:
          'The model signature rejects malformed bodies and missing required inputs with a 400. Mark a feature optional only if the model can handle its absence.',
      },
      options: {
        caption: 'Real-time endpoint or another scoring mode',
        rows: [
          {
            option: 'Model Serving endpoint',
            when: 'An application needs an answer per request within a latency target.',
            tradeoffs:
              'An authenticated HTTPS endpoint with scaling, rate limits, and inference tables. You pay for provisioned capacity while it is up, size it for peak traffic, and own latency monitoring.',
          },
          {
            option: 'Batch scoring in a Lakeflow Job',
            when: 'Scores can be computed ahead of time, such as nightly churn or propensity, and consumers read a table.',
            tradeoffs:
              'No endpoint to size or secure beyond table grants, and job compute stops when the run ends. A score is as old as the last run, and the job cannot use values known only at request time.',
          },
          {
            option: 'Streaming job over events',
            when: 'Events arrive continuously and each one needs a score, but no caller waits for a reply.',
            tradeoffs:
              'Scores land in a table as events arrive, with no request and response. The job runs all the time, so compute is always on, and you manage the checkpoint.',
          },
        ],
        recommendation:
          'Use batch when a table of scores is enough. Add a serving endpoint when a person or application waits for the answer, or the input exists only at request time.',
      },
      links: [
        {
          label: 'Deploy models for batch inference and prediction',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-inference/',
          note: 'Batch scoring options.',
        },
        {
          label: 'Create and manage serving endpoints',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/create-manage-serving-endpoints',
          note: 'Endpoint settings and sizing.',
        },
      ],
    },
    {
      id: 'security',
      heading: 'Secure the endpoint',
      points: [
        {
          strong: 'CAN QUERY for callers.',
          text: 'Grant it to groups or service principals, not to everyone. Keep CAN MANAGE to the owning team and the deployment service principal.',
        },
        {
          strong: 'OAuth tokens.',
          text: 'Applications use OAuth M2M with a service principal, or workload identity federation when the caller runs in a cloud or CI that can present its own identity. Users call with their own OAuth login. Avoid personal access tokens.',
        },
        {
          strong: 'Route optimization.',
          text: 'It speeds up the request path and requires a JWT OAuth token scoped to the endpoint, which a caller gets by exchanging its OAuth token. Plan the token exchange before you turn it on.',
        },
        {
          strong: 'Private paths.',
          text: 'For regulated workloads, front the workspace with private connectivity and restrict ingress, so the endpoint is reachable only from your network.',
        },
      ],
      links: [
        {
          label: 'Manage serving endpoint permissions',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/manage-serving-endpoints',
        },
        {
          label: 'Route optimization',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/route-optimization',
        },
      ],
    },
    {
      id: 'scaling',
      heading: 'How it scales',
      prose:
        'These levers change cost and latency. Choose them from your latency target and traffic shape, then confirm with a load test.',
      table: {
        columns: ['Lever', 'What it does'],
        rows: [
          [
            'Scale-to-zero',
            'Releases compute after idle time. The next request waits for a replica to start. Turn it off when a latency target rules out a cold start.',
          ],
          [
            'Workload size',
            'Sets the range of provisioned concurrency: how many requests run at once. Requests above it queue, so raise the size when p95 climbs.',
          ],
          [
            'Route optimization',
            'A faster request path that needs a JWT OAuth token scoped to the endpoint. The caller does the token exchange.',
          ],
          [
            'Provisioned throughput',
            'Reserves tokens per second for foundation models. It applies to LLM endpoints, not to classic models.',
          ],
        ],
      },
      points: [
        {
          strong: 'Estimate concurrency.',
          text: 'Required concurrency is target QPS times average latency in seconds. A 100 QPS target at 200 ms needs about 20 concurrent requests.',
        },
        {
          strong: 'Leave headroom.',
          text: 'Size above the estimate for bursts, and watch queue depth and p95 when traffic changes.',
        },
      ],
      options: {
        caption: 'Idle behavior of the endpoint',
        rows: [
          {
            option: 'Scale to zero',
            when: 'Dev and test endpoints, or rarely used internal tools.',
            tradeoffs:
              'Releases compute after idle time, so a quiet endpoint costs little. The next request waits for a cold start, and the docs say capacity is not guaranteed when scaled to zero.',
          },
          {
            option: 'A nonzero minimum with provisioned concurrency',
            when: 'Production endpoints with a latency target.',
            tradeoffs:
              'No cold start. You pay for the minimum around the clock, so size it from queries per second times latency, and requests above the maximum queue.',
          },
        ],
        recommendation:
          'Scale to zero in dev and test. Keep a nonzero minimum in production, because the docs advise against scale to zero there.',
      },
      links: [
        {
          label: 'Optimize serving for production',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/production-optimization',
        },
        {
          label: 'Model Serving limits',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/model-serving-limits',
        },
        {
          label: 'Create and manage serving endpoints',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/create-manage-serving-endpoints',
          note: 'Workload size and scale to zero.',
        },
      ],
    },
    {
      id: 'features',
      heading: 'Online features',
      prose: 'A request should carry the key and anything only the caller knows. The endpoint can fetch the rest.',
      points: [
        {
          strong: 'Feature Views feed the online store.',
          text: 'Define features once as Feature Views, then materialize them to an online store. Feature Views are generally available.',
        },
        {
          strong: 'Lakebase online store.',
          text: 'The online store runs on Lakebase and serves features at low latency and high scale, with values kept in sync with the offline tables.',
        },
        {
          strong: 'Automatic lookup.',
          text: 'A model logged with its feature definitions looks features up by key at the endpoint. Callers do not rebuild the feature logic, which avoids training-serving skew.',
        },
        {
          strong: 'Request-time features.',
          text: 'Values that exist only at call time, such as the current cart, come in the request and join the looked-up features.',
        },
      ],
      options: {
        caption: 'Where request-time features come from',
        rows: [
          {
            option: 'Look up from the online store by key',
            when: 'Features are aggregates or history for an entity, such as spend over 30 days.',
            tradeoffs:
              'The caller sends only the key, and the definition matches training. It adds an online store to run and pay for, and values are only as fresh as the last sync with the offline table.',
          },
          {
            option: 'Send the values in the request',
            when: 'The values exist only at call time, such as the current cart.',
            tradeoffs:
              'No lookup hop and no store. The caller must supply and compute every value, which makes payloads larger and risks differences from the training logic.',
          },
          {
            option: 'Both: key plus request-time values',
            when: 'Most models that combine history with the current event.',
            tradeoffs:
              'Looked-up and request values join at the endpoint. You keep two sources of inputs to document and test.',
          },
        ],
        recommendation:
          'Look up entity features by key and send only the values that exist at call time in the payload.',
      },
      links: [
        {
          label: 'Online Feature Stores',
          url: 'https://docs.databricks.com/aws/en/machine-learning/feature-store/online-feature-store',
        },
        {
          label: 'Feature Views',
          url: 'https://docs.databricks.com/aws/en/machine-learning/feature-store/feature-views',
        },
      ],
    },
    {
      id: 'guardrails',
      heading: 'Rate limits, inference tables, and traffic splits',
      points: [
        {
          strong: 'Rate limits.',
          text: 'Unity Gateway limits queries per minute for the whole endpoint, per user, or per group. One noisy client then cannot use the full capacity. Token-based limits do not apply to custom model endpoints.',
        },
        {
          strong: 'Inference tables.',
          text: 'Request and response payloads land in a Unity Catalog table. Use them to debug an odd prediction, to build test sets from real traffic, and as the input to data quality monitoring.',
        },
        {
          strong: 'Traffic split.',
          text: 'Serve two versions on one endpoint and route a share of traffic to the new one for a canary or an A/B test.',
        },
      ],
      examples: [
        {
          label: 'Enable rate limits and inference tables on an endpoint',
          language: 'python',
          code: `from databricks.sdk import WorkspaceClient
from databricks.sdk.service.serving import (
    AiGatewayRateLimit, AiGatewayRateLimitKey, AiGatewayRateLimitRenewalPeriod,
    AiGatewayInferenceTableConfig,
)

w = WorkspaceClient()
w.serving_endpoints.put_ai_gateway(
    name="churn-scoring",
    rate_limits=[
        AiGatewayRateLimit(calls=600, key=AiGatewayRateLimitKey.USER,
                           renewal_period=AiGatewayRateLimitRenewalPeriod.MINUTE),
    ],
    inference_table_config=AiGatewayInferenceTableConfig(
        enabled=True, catalog_name="main", schema_name="serving_logs", table_name_prefix="churn"),
)`,
          notes: [
            'Check the SDK version you use for the exact class names, and apply the same settings from your bundle in production.',
          ],
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
        {
          label: 'Traffic split between served models',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/serve-multiple-models-to-serving-endpoint',
        },
      ],
    },
    {
      id: 'monitor',
      heading: 'Monitor the endpoint',
      points: [
        {
          strong: 'Health metrics.',
          text: 'The Serving page charts latency, request rate, error rate, CPU, and memory. Export the same metrics to Prometheus or Datadog if your team already alerts there.',
        },
        {
          strong: 'Logs.',
          text: 'Service and build logs show why a container failed to start or why a request errored.',
        },
        {
          strong: 'Model quality.',
          text: 'Point data quality monitoring at the inference table to track input drift and prediction quality over time.',
        },
        {
          strong: 'Alerts.',
          text: 'Alert on error rate, p95 latency, and queue depth. Page when the endpoint breaks your SLA, and send quality drift to the model owner.',
        },
      ],
      links: [
        {
          label: 'Monitor model quality and endpoint health',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/monitor-diagnose-endpoints',
        },
        {
          label: 'Export serving metrics',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/metrics-export-serving-endpoint',
        },
      ],
    },
    {
      id: 'loadtest',
      heading: 'How to load-test an endpoint',
      prose:
        'A load test answers one question: at the traffic you expect, does the endpoint meet its latency and error targets, and what breaks first?',
      steps: [
        {
          title: 'Test a staging endpoint with the production configuration',
          body: 'Use the same model version, workload size, and scale settings. Run the client in the same region as the endpoint so network time does not blur the result.',
        },
        {
          title: 'Use realistic payloads',
          body: 'Replay requests sampled from an inference table, including edge cases and a mix of batch sizes. Identical synthetic requests flatter the numbers.',
        },
        {
          title: 'Warm up, then ramp',
          body: 'Send a few requests to start replicas. Raise concurrency in steps and hold each level for a few minutes. Measure the cold start separately, after the endpoint has scaled to zero.',
        },
        {
          title: 'Record the right numbers',
          body: 'Capture p50, p95, and p99 latency, throughput, and error rate at each step. Find the level where p95 bends upward or errors start. That is the capacity at the current size.',
        },
        {
          title: 'Change one thing and repeat',
          body: 'Raise the size, turn on route optimization, or add replicas, then run the same test. Keep the results beside the configuration that produced them.',
        },
      ],
      links: [
        {
          label: 'Optimize serving for production',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/production-optimization',
          note: 'Concurrency sizing and load testing guidance.',
        },
      ],
    },
  ],
  related: [
    { slug: 'model-deployment-cicd', title: 'Model release pipeline' },
    { slug: 'model-performance-drift', title: 'Model quality and drift' },
  ],
};
