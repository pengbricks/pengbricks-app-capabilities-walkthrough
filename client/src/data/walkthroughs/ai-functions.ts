import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'ai-functions',
  area: 'AI Guides',
  title: 'AI Functions in SQL',
  intro:
    'AI Functions call a language model from a SQL query or a DataFrame, one row at a time, with no endpoint to set up. Task functions such as ai_classify and ai_extract run on Databricks-hosted models. ai_query calls any serving endpoint you name. This page covers what each is for, when to reach for something else, and what to check before the data is regulated.',
  shortVersion: [
    {
      title: 'Start with a task function.',
      body: 'ai_classify, ai_extract, ai_mask, ai_parse_document, and the rest need no prompt and no model choice. Use ai_query only when no task function fits.',
    },
    {
      title: 'Run once, keep the result.',
      body: 'Every call is a billed model inference. Write the output to a Delta table and query that, instead of calling the function in every dashboard query.',
    },
    {
      title: 'Run it in a pipeline, with structured output and a labeled test set.',
      body: 'Score new rows in a Lakeflow Spark Declarative Pipeline or job, return JSON with a fixed schema, and measure every prompt or model change against rows you labeled by hand.',
    },
    {
      title: 'Hand-build for latency, tools, or rules.',
      body: 'A per-request API, a multi-step agent, a fine-tuned model, or a job a regex can do are reasons to use Model Serving, an agent, or plain SQL instead.',
    },
    {
      title: 'ai_query is where data can leave.',
      body: 'Task functions run on Databricks-hosted models inside your Geo. ai_query sends rows to whatever endpoint you name, including an external provider under its own terms.',
    },
    {
      title: 'Check permissions and the compliance profile.',
      body: 'Everyone can run the system.ai functions by default. Admins can revoke and allowlist them, and ai_query is governed by endpoint permissions instead.',
    },
  ],
  sections: [
    {
      id: 'catalog',
      heading: 'Which function for which job',
      prose:
        'Functions marked Beta can change. ai_forecast, ai_detect_anomalies, ai_predict_class, ai_predict_value, and ai_top_drivers run on the compute you submit them from, with no separate inference charge.',
      table: {
        columns: ['Job', 'Function'],
        rows: [
          ['Route text to one of a fixed set of labels', 'ai_classify'],
          ['Answer yes/no, pick-one, or rating questions, with probabilities', 'ai_decide (Beta, needs a preview)'],
          ['Pull named fields out of text or a parsed document', 'ai_extract (up to 256 fields, 12 levels deep)'],
          ['Generate new columns for a row, optionally grounded in an index or the web', 'ai_enrich (Beta)'],
          ['Read PDFs, Office files, and images into text and layout', 'ai_parse_document'],
          ['Chunk parsed documents for retrieval', 'ai_prep_search (Beta)'],
          ['Search indexes and get a grounded answer with citations', 'ai_search (Beta)'],
          ['Query one AI Search index directly', 'vector_search'],
          ['Hide names, emails, phone numbers, and similar', 'ai_mask'],
          ['Score sentiment, or how alike two strings are', 'ai_analyze_sentiment, ai_similarity'],
          ['Summarize, fix grammar, translate', 'ai_summarize, ai_fix_grammar, ai_translate (8 languages)'],
          ['Answer a free-form prompt', 'ai_gen'],
          ['Turn audio into text with speakers', 'ai_transcribe (Beta)'],
          [
            'Train and score a classifier or a regression in one query',
            'ai_predict_class, ai_predict_value (Beta, needs a preview)',
          ],
          ['Forecast a series or flag anomalies', 'ai_forecast, ai_detect_anomalies (Beta)'],
          ['Explain why a metric moved', 'ai_top_drivers (Beta)'],
          ['Any prompt, any served model, images or files', 'ai_query'],
        ],
      },
      links: [
        {
          label: 'AI Functions overview',
          url: 'https://docs.databricks.com/aws/en/large-language-models/ai-functions',
          note: 'Full function list and requirements.',
        },
      ],
    },
    {
      id: 'use-cases',
      heading: 'Example use cases',
      prose:
        'Each example writes its result to a table once. Filter out null inputs first, because a null input returns null and still costs a call. Try a few hundred rows before the full table.',
      examples: [
        {
          label: 'Triage support tickets',
          language: 'sql',
          code: `CREATE OR REPLACE TABLE support.tickets_triaged AS
SELECT
  ticket_id,
  ai_classify(body, '["billing", "outage", "how-to", "feature request", "other"]',
              map('version', '2.0')):response[0]::STRING AS category,
  ai_analyze_sentiment(body) AS sentiment,
  ai_summarize(body, 40) AS summary
FROM support.tickets
WHERE body IS NOT NULL AND created_at >= current_date() - INTERVAL 7 DAYS;`,
          notes: [
            'Keep labels few and mutually exclusive; two to five gives the most reliable routing.',
            'Route negative outage tickets to on-call from the triaged table, not from the raw one.',
          ],
        },
        {
          label: 'Ask yes/no and rating questions about each ticket',
          language: 'sql',
          code: `SELECT ticket_id,
       r:response:answers:service_down:probability::DOUBLE AS service_down_probability,
       r:response:answers:urgency:score::DOUBLE AS urgency_score
FROM (
  SELECT ticket_id, ai_decide(body, '{
    "service_down": {"type": "noul",
                     "instructions": "Is the customer reporting that the service is down or failing right now?"},
    "urgency": {"type": "score", "instructions": "How urgent is a reply to this ticket?",
                "criteria": ["Can wait a week", "Needs a reply this week", "Needs a reply today"]}
  }', map('version', '1.0')) AS r
  FROM support.tickets
);`,
          notes: [
            'noul returns a probability, choice returns a label with probabilities, and score returns a weighted score. Pick the cutoff yourself.',
            'Beta. A workspace admin must turn on the AI Decide preview in the workspace preview settings first.',
          ],
        },
        {
          label: 'Extract invoice fields from PDFs',
          language: 'sql',
          code: `CREATE OR REPLACE TABLE finance.invoices_extracted AS
WITH parsed AS (
  SELECT path,
         concat_ws('\\n', transform(doc:document:elements, e -> e:content::STRING)) AS text
  FROM (SELECT path, ai_parse_document(content, map('version', '2.0')) AS doc
        FROM read_files('/Volumes/finance/ap/inbox/', format => 'binaryFile'))
  WHERE coalesce(array_size(try_variant_get(doc, '$.error_status', 'ARRAY<VARIANT>')), 0) = 0  -- not doc:error_status IS NULL: a VARIANT null is a value
)
SELECT path,
       r:response:invoice_number::STRING AS invoice_number,
       r:response:vendor::STRING AS vendor,
       r:response:total::DOUBLE AS total,
       r:error_message::STRING AS extract_error
FROM (SELECT path, ai_extract(text,
        '{"invoice_number": {"type": "string"}, "vendor": {"type": "string"}, "total": {"type": "number"}}',
        map('version', '2.0')) AS r
      FROM parsed);`,
          notes: [
            'ai_parse_document handles up to 500 pages or 100 MB per file.',
            'Keep extract_error: rows that fail stay visible instead of failing the job.',
          ],
        },
        {
          label: 'Read a scanned document with OCR',
          language: 'sql',
          code: `-- One row per element OCR found: type, confidence, text, and where it is on the page.
CREATE OR REPLACE TABLE archive.scan_elements AS
SELECT path, e:bbox[0]:page_id::INT AS page, e:type::STRING AS type,
       e:confidence::DOUBLE AS confidence, e:content::STRING AS content,
       e:description::STRING AS description, cast(e:bbox[0]:coord AS ARRAY<DOUBLE>) AS coord
FROM (SELECT path, ai_parse_document(content, map(
        'version', '2.0',
        'imageOutputPath', '/Volumes/archive/scans/page_images/',
        'descriptionElementTypes', '*')) AS doc
      FROM read_files('/Volumes/archive/scans/inbox/', format => 'binaryFile'))
LATERAL VIEW explode(cast(doc:document:elements AS ARRAY<VARIANT>)) AS e;`,
          notes: [
            'Scans with no text layer work: OCR reads typed text, handwriting, and signatures, and labels each element.',
            'imageOutputPath saves one image per page, and coord is in that image’s pixels, so you can draw each box on the page to check what was read.',
            'descriptionElementTypes adds a written description of each figure or drawing.',
            'Check confidence before you extract. Faded pages produce low-confidence misreads, so keep elements above a threshold you set from a labeled sample (0.8 is a reasonable start) and send the rest to review.',
            'Results can vary between runs, so score a labeled sample more than once before you rely on a field.',
          ],
        },
        {
          label: 'Mask personal data before sharing',
          language: 'sql',
          code: `CREATE OR REPLACE TABLE shared.call_notes_masked AS
SELECT note_id, ai_mask(note, array('person', 'email', 'phone', 'address')) AS note
FROM crm.call_notes;`,
          notes: [
            'Masking is model-based, so check a sample before you rely on it. A column mask or row filter is the control; ai_mask cleans free text.',
          ],
        },
        {
          label: 'Match company names across two systems',
          language: 'sql',
          code: `CREATE OR REPLACE TABLE mdm.account_vendor_matches AS
SELECT * FROM (
  SELECT a.account_id, b.vendor_id, ai_similarity(a.name, b.name) AS score
  FROM crm.accounts a
  JOIN erp.vendors b ON a.country = b.country AND left(a.name, 1) = left(b.name, 1)
)
WHERE score > 0.85;`,
          notes: [
            'Block the join first. A full cross join calls the model once per pair.',
            'Score each pair once in the inner query, then filter on the saved score.',
            'No single threshold is clean: a true match can score below a wrong pair that shares a long prefix. Send a middle band, such as 0.75 to 0.9, to a person.',
          ],
        },
        {
          label: 'Translate to a language ai_translate does not cover',
          language: 'sql',
          code: `SELECT review_id,
       ai_query('databricks-meta-llama-3-3-70b-instruct',
                concat('Translate to Japanese. Return only the translation: ', review),
                failOnError => false) AS ja
FROM reviews.product_reviews;`,
          notes: [
            'ai_translate covers English, French, German, Hindi, Italian, Portuguese, Spanish, and Thai.',
            'With failOnError => false the result is a struct: read ja.result and ja.errorMessage.',
          ],
        },
        {
          label: 'Forecast daily orders by region',
          language: 'sql',
          code: `SELECT * FROM ai_forecast(
  observed => TABLE(SELECT order_date, region, orders FROM sales.daily_orders),
  horizon => '2027-03-31',
  time_col => 'order_date',
  value_col => 'orders',
  group_col => 'region'
);`,
          notes: [
            'Runs on the compute that submits it, with no separate inference charge. Run it on a Pro or serverless SQL warehouse, and check the function page for the runtimes that support it.',
          ],
        },
        {
          label: 'Predict churn for new customers in one query',
          language: 'sql',
          code: `SELECT customer_id, churned_prediction, churned_confidence
FROM ai_predict_class(
  input => TABLE(SELECT customer_id, tenure_months, plan, churned FROM crm.customers),
  target_col => 'churned',
  feature_cols => ARRAY('tenure_months', 'plan'),
  seed => 42
)
WHERE churned IS NULL;`,
          notes: [
            'Rows with a known churned value train the model; rows where it is NULL get a prediction and a confidence. The model is not saved.',
            'Runs on your compute with no model charge. Beta: an admin turns on the Predictive AI Functions preview. Use ai_predict_value for a number.',
          ],
        },
      ],
    },
    {
      id: 'pipelines',
      heading: 'In pipelines and jobs: structured output and evaluation',
      prose:
        'Run AI Functions where the rest of your transformation runs, in a Lakeflow Spark Declarative Pipeline or a Lakeflow Job, so the output is a governed table with lineage, retries, and a schedule. Do not call them from ad hoc dashboard queries.',
      points: [
        {
          strong: 'Put them in the pipeline.',
          text: 'Call the function in a streaming table or materialized view over new rows, so each row is scored once as it arrives. Put the prompt, labels, and schema in pipeline parameters or source files under Git.',
        },
        {
          strong: 'Ask for structured output.',
          text: 'ai_extract takes a JSON schema and ai_classify a label list, so the result has fixed fields you can cast and constrain. With ai_query, pass responseFormat with a JSON schema so the model returns parseable JSON instead of free text. Then add a pipeline expectation on the parsed fields and send rows that fail to a quarantine table.',
        },
        {
          strong: 'Keep errors as data.',
          text: 'Use failOnError => false with ai_query and keep the error column, so one bad row does not fail a batch and you can count and retry failures.',
        },
        {
          strong: 'Evaluate outputs against labels.',
          text: 'Hand-label a few hundred representative rows once. Score every prompt, schema, or model change against that set as an accuracy or per-field match, and gate the change on it. Rerun the set when release notes mention a function or when a model retires.',
        },
        {
          strong: 'Sample for drift.',
          text: 'In production, review a small random sample of outputs on a schedule, and track the share of nulls, errors, and low-confidence rows. A shift in those is the first sign that inputs or the model changed.',
        },
      ],
      links: [
        {
          label: 'ai_query',
          url: 'https://docs.databricks.com/aws/en/large-language-models/ai-query',
          note: 'Structured output with responseFormat, failOnError, and batch inference.',
        },
      ],
    },
    {
      id: 'decide',
      heading: 'When to use it, and when to build your own',
      prose:
        'AI Functions are for applying a model to rows you already have, in batch. Build something yourself when the work is a live request, needs several steps, depends on a model you trained, or does not need a model at all.',
      diagram: {
        type: 'matrix',
        title: 'Task function, ai_query, or hand-built',
        description:
          'Tagging two million tickets: a task function is the best fit, ai_query works, hand-built is overkill. Pulling 40 fields from contracts: ai_extract fits up to 256 fields; ai_query only past that. Translating to Japanese: no task function covers it; ai_query fits. Scoring a live checkout request: neither function is built for it; serve a model. A multi-step task with tools: build an agent. A fine-tuned model: call its endpoint with ai_query. A job a regex can do: use plain SQL.',
        corner: 'Job ↓ · Option →',
        columns: ['Task function', 'ai_query', 'Hand-built'],
        rows: [
          {
            label: 'Tag 2M support tickets',
            cells: [
              { state: 'own', text: 'Best fit', sub: 'ai_classify' },
              { state: 'optional', text: 'Works', sub: 'more to maintain' },
              { state: 'none', text: 'Overkill' },
            ],
          },
          {
            label: 'Pull 40 contract fields',
            cells: [
              { state: 'own', text: 'Best fit', sub: 'ai_extract' },
              { state: 'optional', text: 'Past 256 fields', sub: 'or deep nesting' },
              { state: 'none', text: 'Overkill' },
            ],
          },
          {
            label: 'Translate to Japanese',
            cells: [
              { state: 'none', text: 'Not covered' },
              { state: 'own', text: 'Best fit', sub: 'pick a model' },
              { state: 'none', text: 'Overkill' },
            ],
          },
          {
            label: 'Score a live request',
            sub: 'per call, low latency',
            cells: [
              { state: 'none', text: 'Batch only' },
              { state: 'none', text: 'Batch only' },
              { state: 'own', text: 'Model Serving', sub: 'REST endpoint' },
            ],
          },
          {
            label: 'Research with tools',
            sub: 'several steps',
            cells: [
              { state: 'none', text: 'One call per row' },
              { state: 'none', text: 'One call per row' },
              { state: 'own', text: 'Agent', sub: 'tools, memory, evals' },
            ],
          },
          {
            label: 'Use a fine-tuned model',
            cells: [
              { state: 'none', text: 'Fixed models' },
              { state: 'own', text: 'Call its endpoint' },
              { state: 'optional', text: 'Serve it first' },
            ],
          },
          {
            label: 'A regex would do',
            sub: 'ZIP codes, IDs, dates',
            cells: [
              { state: 'none', text: 'Costs tokens' },
              { state: 'none', text: 'Costs tokens' },
              { state: 'own', text: 'Plain SQL', sub: 'regexp_extract' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Use this' },
          { state: 'optional', label: 'Works, with caveats' },
          { state: 'none', label: 'Wrong tool' },
        ],
      },
      points: [
        {
          strong: 'Measure before you scale.',
          text: 'Label a few hundred rows by hand and compare. If accuracy is not good enough with a clearer label set or schema, that is the signal to try ai_query with a stronger model, or to train a classifier.',
        },
        {
          strong: 'Watch the volume.',
          text: 'Tens of millions of rows a day on a stable label set can cost more in tokens than a small trained model scored on the same compute. Compare the two in system.billing.usage.',
        },
        {
          strong: 'Version the prompt like code.',
          text: 'With ai_query the prompt and model name are logic. Keep them in the pipeline source under Git, not typed into a dashboard.',
        },
      ],
    },
    {
      id: 'flow',
      heading: 'Where a call goes',
      prose:
        'The query runs on your compute either way. What changes is where the model runs, which decides who sees the rows and what you are billed for.',
      diagram: {
        type: 'flow',
        title: 'From a query to a model',
        description:
          'A SQL or PySpark query runs on your warehouse, job, or pipeline. Task functions call a Databricks-hosted model, a Designated Service that processes data in your Geo. ai_query calls the endpoint you name: a Foundation Model API endpoint, your own serving endpoint, or an external model, where rows go to the provider.',
        lanes: [
          { label: 'Your compute', fromRow: 0, toRow: 0 },
          { label: 'Function', fromRow: 1, toRow: 1 },
          { label: 'Model', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          {
            id: 'query',
            label: 'SQL or PySpark query',
            sub: 'warehouse, job, pipeline',
            col: 1,
            row: 0,
            kind: 'surface',
          },
          { id: 'task', label: 'Task function', sub: 'ai_classify, ai_extract', col: 0, row: 1 },
          { id: 'aiq', label: 'ai_query', mono: true, sub: 'you name the endpoint', col: 2, row: 1 },
          {
            id: 'hosted',
            label: 'Databricks-hosted model',
            sub: 'Designated Service, Geo',
            col: 0,
            row: 2,
            kind: 'highlight',
          },
          {
            id: 'fmapi',
            label: 'Foundation Model API',
            sub: 'pay-per-token, reserved',
            col: 2,
            row: 2,
            kind: 'highlight',
          },
          { id: 'external', label: 'External model', sub: 'provider terms apply', col: 3, row: 2, kind: 'gate' },
        ],
        edges: [
          { from: 'query', to: 'task' },
          { from: 'query', to: 'aiq' },
          { from: 'task', to: 'hosted' },
          { from: 'aiq', to: 'fmapi' },
          { from: 'aiq', to: 'external', label: 'leaves', dashed: true },
        ],
        legend: [
          { kind: 'highlight', label: 'Hosted by Databricks' },
          { kind: 'gate', label: 'Data goes to a third party' },
          { kind: 'dashed', label: 'Outside Databricks' },
        ],
        caption:
          'ai_forecast, ai_detect_anomalies, and the predict functions never leave your compute. ai_query can also call your own serving endpoint, such as a fine-tuned model. Compute is always billed; model calls show up in system.billing.usage under AI_FUNCTIONS or MODEL_SERVING.',
      },
    },
    {
      id: 'models',
      heading: 'Models to be aware of',
      points: [
        {
          strong: 'Task functions choose their own model.',
          text: 'Databricks maintains the models behind ai_classify, ai_extract, and the rest, and does not name them. Output can change when they are upgraded, so keep your hand-labeled sample and rerun it after release notes mention a function.',
        },
        {
          strong: 'ai_query uses the model you name.',
          text: 'Not every serving endpoint accepts batch calls, and availability differs by region and workspace. Test a one-row ai_query against a model before you build on it, and prefer the batch-optimized models the ai_query page lists for large tables.',
        },
        {
          strong: 'Some models need cross-Geo routing.',
          text: 'The Google Gemini endpoints require cross-Geo routing to be enabled on the account. If residency rules forbid that, pick a model served in your Geo.',
        },
        {
          strong: 'Licenses follow the model.',
          text: 'Each model carries its provider’s terms, such as the Llama community license or the OpenAI and Anthropic terms. Checking them for your use is your responsibility, not Databricks’.',
        },
        {
          strong: 'Models retire.',
          text: 'Release notes announce retirements, often weeks ahead. Keep the endpoint name in one place, a pipeline parameter or a SQL UDF, so a swap is one change.',
        },
      ],
      links: [
        {
          label: 'Supported foundation models',
          url: 'https://docs.databricks.com/aws/en/machine-learning/foundation-model-apis/supported-models',
          note: 'Endpoint names, providers, and regional notes.',
        },
        {
          label: 'ai_query',
          url: 'https://docs.databricks.com/aws/en/large-language-models/ai-query',
          note: 'Endpoint types, batch-optimized models, and failOnError.',
        },
      ],
    },
    {
      id: 'governance',
      heading: 'Security and compliance checks',
      prose:
        'Run through these before an AI Function reads regulated or customer data. Several are account settings, so the answer can differ between workspaces.',
      steps: [
        {
          title: 'Decide who can call which function',
          body: 'All users have EXECUTE on the system.ai schema by default. A metastore admin can revoke it and grant individual functions to groups. Function-level permissions are in Public Preview and are turned on through the account team. They do not cover ai_query, which is governed by permissions on the model endpoint.',
          code: `REVOKE EXECUTE ON SCHEMA system.ai FROM \`account users\`;
GRANT EXECUTE ON FUNCTION system.ai.ai_classify TO \`support-analysts\`;
GRANT EXECUTE ON FUNCTION system.ai.ai_mask TO \`support-analysts\`;`,
        },
        {
          title: 'Know where the data is processed',
          body: 'AI Functions and Foundation Model APIs are Designated Services: they process data in the workspace’s Geo when the service is available there. If it is not, an admin may have to enable cross-Geo processing, which lets processing happen in another Geo. Data is not stored outside the workspace’s Geo either way.',
        },
        {
          title: 'Check the compliance security profile',
          body: 'On workspaces with the compliance security profile (HIPAA, PCI-DSS, and other standards), ai_extract and ai_classify are on by default. The ai_gen reference page states it is HIPAA compliant. Confirm each other function you plan to use against the profile’s list of supported features for your standard before regulated data reaches it.',
        },
        {
          title: 'Treat external models as a data transfer',
          body: 'An ai_query call to an external model sends each row to that provider under its terms and its retention policy. Mask or drop sensitive columns first, and record the provider in your data-processing inventory.',
        },
        {
          title: 'Turn on the previews you plan to use',
          body: 'Some functions stay off until someone enables them: ai_decide needs the AI Decide preview and ai_predict_class and ai_predict_value need the Predictive AI Functions preview, both set by a workspace admin. Function-level permissions are enabled through the account team. Beta and preview features come with their own terms and support level; check those before regulated data reaches one.',
        },
        {
          title: 'Know what grounding reaches',
          body: 'ai_enrich and ai_search can ground answers in AI Search indexes, which follow the index’s Unity Catalog permissions. ai_enrich can also use live web search, which sends queries outside Databricks. Restrict it with allowed_domains, or leave web search out for sensitive rows.',
        },
        {
          title: 'Do not count on the gateway to block bad input',
          body: 'ai_query requests are tracked in Unity Gateway usage and budgets, but the docs state guardrails and rate limits do not apply to them. Filter and mask inputs in the query itself.',
        },
        {
          title: 'Track cost and usage',
          body: 'Model calls land in system.billing.usage. Tag the job or warehouse so spend is attributable, and alert on a budget.',
          code: `SELECT usage_date, billing_origin_product, sum(usage_quantity) AS dbus
FROM system.billing.usage
WHERE billing_origin_product IN ('AI_FUNCTIONS', 'MODEL_SERVING')
GROUP BY ALL
ORDER BY usage_date DESC;`,
        },
      ],
      links: [
        {
          label: 'AI Functions permissions',
          url: 'https://docs.databricks.com/aws/en/large-language-models/ai-functions-uc-permissions',
        },
        {
          label: 'Designated Services and cross-Geo processing',
          url: 'https://docs.databricks.com/aws/en/resources/designated-services',
        },
        {
          label: 'Compliance security profile',
          url: 'https://docs.databricks.com/aws/en/security/privacy/security-profile',
        },
      ],
    },
    {
      id: 'requirements',
      heading: 'Requirements',
      table: {
        columns: ['Need', 'Detail'],
        rows: [
          [
            'Compute',
            'Serverless or Pro SQL warehouse, or Databricks Runtime 15.4 LTS and later. Not on classic SQL warehouses.',
          ],
          ['ai_parse_document', 'Databricks Runtime 17.3 and later'],
          [
            'ai_prep_search, ai_search, ai_enrich',
            'Databricks Runtime 18.2 and later, or serverless environment version 3 and later',
          ],
          [
            'ai_predict_class, ai_predict_value',
            'Pro or serverless SQL warehouse, or Databricks Runtime 19.3 and later, plus the Predictive AI Functions preview',
          ],
          ['ai_decide', 'The AI Decide preview, enabled by a workspace admin; available in select regions'],
          [
            'Function permissions',
            'Unity Catalog, Databricks Runtime 17.3 LTS and later, and the preview enabled by the account team',
          ],
          ['Region', 'AI Functions available in the workspace region, or cross-Geo processing enabled'],
        ],
      },
    },
  ],
  related: [
    { slug: 'agent-build-deployment', title: 'Building and shipping agents' },
    { slug: 'agent-framework-support', title: 'Agents, MCP, and model gateway' },
    { slug: 'row-column-security', title: 'Row and column security' },
    { slug: 'cost-chargeback', title: 'Cost tracking and chargeback' },
  ],
};
