import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'rest-api-ingestion',
  area: 'Ingestion',
  title: 'Authenticated REST API ingestion',
  intro:
    'Check for a managed connector before you write a client. When none exists, you can build a custom Lakeflow Connect connector, wrap the API in a Python data source, or land raw responses and ingest them with Auto Loader. This page ranks those options, shows where secrets belong, and covers the parts every API client needs: paging, token refresh, retries, incremental cursors, and idempotent writes.',
  shortVersion: [
    {
      title: 'Use a managed connector first.',
      body: 'Lakeflow Connect has managed connectors for common SaaS sources. They handle authentication, incremental sync, and retries, and you write no client.',
    },
    {
      title: 'Otherwise pick one of three custom paths.',
      body: 'A custom Lakeflow Connect connector, a Python data source that makes the API look like spark.read.format("name"), or a job that lands raw JSON in a volume for Auto Loader.',
    },
    {
      title: 'Keep credentials in Unity Catalog or secrets.',
      body: 'Store API credentials in a Unity Catalog connection or service credential where one fits, and in a secret scope otherwise. Never put them in code, job parameters, or logs.',
    },
    {
      title: 'Pull incrementally and write with MERGE.',
      body: 'Keep a cursor, such as an updated-since timestamp or a page token, in a state table. Merge on the record key so a retry or overlap window does not create duplicates.',
    },
    {
      title: 'Retry only what a retry can fix.',
      body: 'Refresh the token on a 401, back off on 429 and 5xx while honoring Retry-After, and stop on other 4xx errors. Log every attempt.',
    },
  ],
  sections: [
    {
      id: 'options',
      heading: 'Choose how to ingest',
      table: {
        caption: 'Options in order of preference',
        columns: ['Option', 'Use it when'],
        rows: [
          [
            'Managed Lakeflow Connect connector',
            'The source is a supported SaaS application. Configure a connection and a pipeline; Databricks runs incremental sync on serverless compute.',
          ],
          [
            'Custom Lakeflow Connect connector (Beta)',
            'No managed connector exists and you want the managed pipeline model. Build from the Lakeflow Community Connectors repository, or use an existing community connector.',
          ],
          [
            'Python data source API',
            'You want the API to read like any Spark source, with partitioned reads and, if you implement it, streaming offsets. Works in notebooks, jobs, and pipelines.',
          ],
          [
            'Land raw, then Auto Loader',
            'You want the simplest design to debug and replay. A job writes each response as JSON to a volume, and a streaming table ingests the files with a checkpoint.',
          ],
          [
            'http_request in SQL',
            'You need a small lookup or enrichment call through a Unity Catalog HTTP connection. Do not use it for bulk extraction.',
          ],
        ],
      },
      links: [
        { label: 'Lakeflow Connect', url: 'https://docs.databricks.com/aws/en/ingestion/overview' },
        { label: 'Custom connectors', url: 'https://docs.databricks.com/aws/en/ingestion/custom-connectors' },
        { label: 'PySpark custom data sources', url: 'https://docs.databricks.com/aws/en/pyspark/datasources' },
      ],
    },
    {
      id: 'secrets',
      heading: 'Where credentials live',
      points: [
        {
          strong: 'Unity Catalog connection.',
          text: 'For HTTP APIs, a Unity Catalog HTTP connection stores the host and the bearer token or OAuth credentials, and access is governed with USE CONNECTION. Callers use the connection by name and never see the secret.',
        },
        {
          strong: 'Service credential.',
          text: 'For cloud-provider APIs, a Unity Catalog service credential gives code a short-lived cloud identity, so no key is stored at all.',
        },
        {
          strong: 'Secret scope.',
          text: 'For everything else, read the client ID and secret with dbutils.secrets.get from a scope. Secret values are redacted in notebook output. Give the job’s service principal read access to that scope only.',
        },
        {
          strong: 'Run as a service principal.',
          text: 'Run the pull job as a service principal so credentials and schedules do not depend on one person.',
        },
        {
          strong: 'Never in parameters or logs.',
          text: 'Do not pass tokens as job parameters, widget values, or log lines. Log the request path and status, not the headers.',
        },
      ],
      links: [
        { label: 'Secrets', url: 'https://docs.databricks.com/aws/en/security/secrets/' },
        { label: 'Service credentials', url: 'https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-services/service-credentials' },
      ],
    },
    {
      id: 'request',
      heading: 'How one page is fetched',
      prose:
        'A token manager sits in front of every request. It logs in on first use, refreshes when the token is older than its window, and refreshes again if the server answers 401. Each response, good or bad, writes a row to a request log.',
      diagram: {
        type: 'flow',
        title: 'From login to a landed page',
        description:
          'The job logs in. Before each request the client checks the token age and refreshes it if it is too old. It then requests a page with a cursor or page parameters. A 200 response adds the records to the landing table. A 401 refreshes the token and retries the same page. A 429, 5xx, or network error waits with exponential backoff and retries. Every attempt writes a row to the request log.',
        nodes: [
          { id: 'job', label: 'Pull task', sub: 'serverless Python', col: 0, row: 0 },
          { id: 'login', label: 'Authenticate', sub: 'OAuth or API key', col: 1, row: 0 },
          { id: 'age', label: 'Token too old?', col: 2, row: 0, kind: 'gate' },
          { id: 'refresh', label: 'Refresh token', sub: 'before expiry or on 401', col: 3, row: 0, kind: 'highlight' },
          { id: 'get', label: 'Request a page', sub: 'cursor or limit/offset', col: 2, row: 1, kind: 'highlight' },
          { id: 'status', label: 'Response status?', col: 3, row: 1, kind: 'gate' },
          { id: 'users', label: 'Landing table', sub: 'records', col: 4, row: 1, kind: 'store' },
          { id: 'log', label: 'Request log', sub: 'one row per attempt', col: 2, row: 2, kind: 'store' },
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
      prose: 'Treat each status class differently. Retry only errors that a retry can fix.',
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
        caption: 'Make the retry count, backoff, and page size settings, and unit-test the rules with an injected HTTP session.',
      },
    },
    {
      id: 'incremental',
      heading: 'Incremental pulls and idempotent writes',
      points: [
        {
          strong: 'Pick the cursor the API offers.',
          text: 'Prefer an updated-since timestamp or an opaque cursor over page numbers, which shift when records change during a pull. Page by cursor until the API says there is no next page.',
        },
        {
          strong: 'Store the high-water mark.',
          text: 'Write the last successful cursor to a state table after the data is committed, not before. A failed run then resumes from the previous mark.',
        },
        {
          strong: 'Overlap, then deduplicate.',
          text: 'Start each pull slightly before the stored mark to catch late updates, and let MERGE absorb the repeats.',
        },
        {
          strong: 'MERGE on the record key.',
          text: 'Upsert into the target on the source’s primary key so a retry or rerun is safe. If the API reports deletes, handle them as a flag or a separate endpoint.',
        },
        {
          strong: 'Keep a raw copy.',
          text: 'Land the raw response before you flatten it. You can replay a parsing fix without calling the API again, which matters when the API rate-limits or keeps only recent data.',
        },
      ],
      examples: [
        {
          label: 'Upsert a pulled batch and advance the cursor',
          language: 'sql',
          code: `MERGE INTO main.crm.contacts AS t
USING pulled_batch AS s
ON t.id = s.id
WHEN MATCHED AND s.updated_at > t.updated_at THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *;

-- Advance the cursor only after the merge commits
MERGE INTO main.crm.pull_state AS t
USING (SELECT 'contacts' AS source, max(updated_at) AS high_water_mark FROM pulled_batch) AS s
ON t.source = s.source
WHEN MATCHED THEN UPDATE SET t.high_water_mark = s.high_water_mark
WHEN NOT MATCHED THEN INSERT *;`,
        },
      ],
    },
  ],
  related: [
    { slug: 'sftp-ingestion', title: 'SFTP file retrieval' },
    { slug: 'multi-source-pipeline', title: 'Multi-source pipeline' },
    { slug: 'batch-real-time-ingestion', title: 'Batch and streaming ingestion' },
  ],
};
