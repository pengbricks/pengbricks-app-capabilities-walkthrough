import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'rest-api-ingestion',
  area: 'Ingestion',
  title: 'Authenticated REST API ingestion',
  intro:
    'One job logs in to a public test API, pulls every page of 208 users, refreshes the token while it works, and writes the records and a log of each request. The client is a small Python module with an injected session, so the paging, refresh, and retry rules are unit-tested without a network.',
  shortVersion: [
    {
      title: 'Log in once, send the token every time.',
      body: 'POST /auth/login returns an access token and a refresh token. Each page request carries the access token as a bearer header.',
    },
    {
      title: 'The API decides when to stop.',
      body: 'The loop adds the page size to skip until skip reaches the total the API reports: 7 pages, the last with 28 records.',
    },
    {
      title: 'Tokens refresh before and after they fail.',
      body: 'A token past its refresh window is renewed before the request. A 401 renews it and retries the same page once.',
    },
    {
      title: 'Failures back off.',
      body: '429, 5xx, and network errors wait 0.5, 1, 2 seconds and so on, honor Retry-After, and stop after 5 retries.',
    },
    {
      title: 'Every attempt is logged.',
      body: 'api_request_log keeps page, status, latency, and the token refresh count, one row per HTTP attempt.',
    },
  ],
  sections: [
    {
      id: 'request',
      heading: 'How one page is fetched',
      prose:
        'The token manager sits in front of every request. It logs in on first use, refreshes when the token is older than the configured window, and refreshes again if the server answers 401. Each response, good or bad, writes a row to the request log.',
      diagram: {
        type: 'flow',
        title: 'From login to a landed page',
        description:
          'The job logs in. Before each request the client checks the token age and refreshes it if it is too old. It then requests a page with limit and skip. A 200 response adds the records to api_users. A 401 refreshes the token and retries the same page. A 429, 5xx, or network error waits with exponential backoff and retries. Every attempt writes a row to api_request_log.',
        nodes: [
          { id: 'job', label: 'pull_api', mono: true, sub: 'serverless Python task', col: 0, row: 0 },
          { id: 'login', label: 'Login', sub: 'POST /auth/login', col: 1, row: 0 },
          { id: 'age', label: 'Token too old?', col: 2, row: 0, kind: 'gate' },
          { id: 'refresh', label: 'Refresh token', sub: 'POST /auth/refresh', col: 3, row: 0, kind: 'highlight' },
          { id: 'get', label: 'Request a page', sub: 'limit and skip', col: 2, row: 1, kind: 'highlight' },
          { id: 'status', label: 'Response status?', col: 3, row: 1, kind: 'gate' },
          { id: 'users', label: 'api_users', mono: true, sub: 'records', col: 4, row: 1, kind: 'store' },
          { id: 'log', label: 'api_request_log', mono: true, sub: 'one row per attempt', col: 2, row: 2, kind: 'store' },
          { id: 'backoff', label: 'Back off and retry', sub: '0.5 s, 1 s, 2 s, ...', col: 3, row: 2 },
        ],
        edges: [
          { from: 'job', to: 'login' },
          { from: 'login', to: 'age' },
          { from: 'age', to: 'refresh', label: 'yes' },
          { from: 'refresh', to: 'get' },
          { from: 'age', to: 'get', label: 'no' },
          { from: 'get', to: 'status' },
          { from: 'status', to: 'users', label: '200' },
          { from: 'status', to: 'refresh', label: '401', dashed: true },
          { from: 'status', to: 'backoff', label: '429, 5xx' },
          { from: 'backoff', to: 'get', dashed: true },
          { from: 'get', to: 'log' },
        ],
        legend: [
          { kind: 'highlight', label: 'API call' },
          { kind: 'gate', label: 'Decision' },
          { kind: 'store', label: 'Delta table' },
          { kind: 'dashed', label: 'Retry path' },
        ],
      },
    },
    {
      id: 'responses',
      heading: 'What each response does',
      prose: 'The client treats each status class differently. Only errors that a retry can fix are retried.',
      diagram: {
        type: 'matrix',
        title: 'Handling by response',
        description:
          'A 200 keeps the records and moves to the next page. A 401 refreshes the token and retries once without waiting. A 429 waits for Retry-After or the backoff delay, then retries up to 5 times. A 5xx or network error waits with exponential backoff and retries up to 5 times. Any other 4xx stops the run.',
        corner: 'Response ↓ · Action →',
        columns: ['Refresh token', 'Wait', 'Retry'],
        rows: [
          {
            label: '200',
            sub: 'success',
            cells: [
              { state: 'none', text: 'no' },
              { state: 'none', text: 'no' },
              { state: 'none', text: 'next page' },
            ],
          },
          {
            label: '401',
            sub: 'token rejected',
            cells: [
              { state: 'own', text: 'yes' },
              { state: 'none', text: 'no' },
              { state: 'own', text: 'once' },
            ],
          },
          {
            label: '429',
            sub: 'rate limited',
            cells: [
              { state: 'none', text: 'no' },
              { state: 'own', text: 'Retry-After' },
              { state: 'own', text: 'up to 5' },
            ],
          },
          {
            label: '500, 502, 503, 504',
            sub: 'or a network error',
            cells: [
              { state: 'none', text: 'no' },
              { state: 'own', text: 'backoff' },
              { state: 'own', text: 'up to 5' },
            ],
          },
          {
            label: 'Other 4xx',
            sub: 'for example 404',
            cells: [
              { state: 'none', text: 'no' },
              { state: 'none', text: 'no' },
              { state: 'optional', text: 'stop the run' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Applies' },
          { state: 'none', label: 'Does not apply' },
          { state: 'optional', label: 'Run fails' },
        ],
        caption: 'The backoff and 429 rules are covered by unit tests. DummyJSON never throttles, so the reference run did not hit them.',
      },
    },
    {
      id: 'run',
      heading: 'What the reference run did',
      prose:
        'The run shortens the refresh window to 3 seconds and sends an invalid token on page 4, so the refresh paths run against the real API. Page 4 shows both: the first attempt returns 401, the second returns 200.',
      table: {
        caption: 'api_pull_runs for the successful run',
        columns: ['Measure', 'Value'],
        rows: [
          ['Pages', '7 (6 of 30 records, 1 of 28)'],
          ['HTTP attempts', '8 (one 401 on page 4)'],
          ['Logins', '1'],
          ['Token refreshes', '3 (one after the 401, two before the window passed)'],
          ['Backoff retries', '0'],
          ['Records, distinct ids, API total', '208, 208, 208'],
        ],
      },
    },
    {
      id: 'options',
      heading: 'Where this code stops and other options start',
      points: [
        {
          strong: 'PySpark custom data source.',
          text: 'Wrap a client like this one in a Python data source and call spark.read.format("name"). You get partitioned reads and streaming support, and the pull looks like any other Spark read.',
        },
        {
          strong: 'Lakeflow Connect.',
          text: 'If the source has a managed connector, use it. You write no client, and the connector handles authentication and incremental sync.',
        },
        {
          strong: 'Secrets.',
          text: 'The test API publishes its demo login. For a real API, read the client secret with dbutils.secrets.get from a secret scope.',
        },
      ],
    },
  ],
  related: [
    { slug: 'sftp-ingestion', title: 'SFTP file retrieval' },
    { slug: 'multi-source-pipeline', title: 'Multi-source pipeline' },
  ],
};
