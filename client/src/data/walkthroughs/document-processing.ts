import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'document-processing',
  area: 'AI Guides',
  title: 'Document processing pipelines and their cost',
  intro:
    'Documents arrive as PDFs, scans, and images, and the work is the same each time: land them, read them, decide what they are, pull out fields, check the result, and protect personal data. This page gives repeatable patterns for each step. Every pattern says when to use it, how it works, which options exist and what they trade off, the best practices, and a short common example. The examples are invoices, request forms, letters, and scanned receipts. The last pattern is a method for pricing the pipeline from a measured sample.',
  businessValue: {
    summary:
      'Teams that turn invoices, forms, letters, and scanned PDFs into structured data can run one governed pipeline on Databricks and price it from a measured sample. This guide gives the patterns, the design choices, and a cost method you can defend.',
    outcomes: [
      {
        title: 'Documents become queryable fields',
        body: 'Parsed text, document types, and extracted fields land in Unity Catalog tables. Analysts, dashboards, and apps read them with the same permissions as any other data.',
      },
      {
        title: 'Each page is paid for once',
        body: 'Parsing once and storing the output means reruns, retries, and new questions do not bill pages that were already read.',
      },
      {
        title: 'Doubtful results reach a person',
        body: 'Null and confidence checks send uncertain extractions to a quarantine table for review, so wrong values stay out of downstream systems.',
      },
      {
        title: 'A cost estimate you can defend',
        body: 'Cost per page comes from billed usage on a representative sample, then scales to annual volume with growth and reprocessing allowances written out.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Land, track, and keep the original.',
      body: 'Files go to a Unity Catalog volume. Auto Loader records each one once in a table of paths and metadata. The bytes stay in the volume.',
    },
    {
      title: 'Parse once and store the output.',
      body: 'ai_parse_document is the per-page cost. Parse only files not already in the parsed table, keep the whole result, and every later step reads the table.',
    },
    {
      title: 'Classify, then extract by type.',
      body: 'ai_classify picks the type and a confidence. The type picks the ai_extract schema. Low confidence goes to review instead of guessing.',
    },
    {
      title: 'Validate before anything is trusted.',
      body: 'Null, confidence, date, and range checks split results into a validated table and a quarantine table that a reviewer works from.',
    },
    {
      title: 'Mask personal data in the shared copy.',
      body: 'ai_mask hides names, emails, and phone numbers in text other teams read. Check for leaks against a sample with planted values.',
    },
    {
      title: 'Price it from a measured sample.',
      body: 'Run 100 or so representative documents, read the cost from system.billing.usage, divide by pages, then scale with growth and reprocessing allowances.',
    },
  ],
  sections: [
    {
      id: 'pipeline',
      heading: 'The pipeline and the patterns',
      prose:
        'Each box below is a pattern in this guide. The reference bundle runs all of them on 28 generated documents as a serverless Lakeflow Job and measures the bill. Every table is in Unity Catalog, so one set of grants, one lineage graph, and one audit log cover the whole path.',
      diagram: {
        type: 'flow',
        title: 'From a landed file to a validated row',
        description:
          'Files land in a Unity Catalog volume and Auto Loader records them in a table. ai_parse_document parses each new file once into a parsed table. ai_classify labels each document, and the label chooses the ai_extract schema. A validation step sends passing rows to a validated table and failing rows to a quarantine table that a reviewer app reads. ai_mask writes a masked copy of the parsed text for sharing.',
        nodes: [
          { id: 'volume', label: 'Volume', sub: 'original files', kind: 'store', col: 0, row: 0 },
          { id: 'loader', label: 'Auto Loader', sub: 'binaryFile, availableNow', col: 1, row: 0 },
          { id: 'parse', label: 'Parse once', sub: 'ai_parse_document', mono: true, kind: 'highlight', col: 2, row: 0 },
          { id: 'classify', label: 'Classify', sub: 'ai_classify', mono: true, col: 3, row: 0 },
          { id: 'extract', label: 'Extract', sub: 'ai_extract, by type', mono: true, col: 4, row: 0 },
          { id: 'parsed', label: 'Parsed table', sub: 'VARIANT and text', kind: 'store', col: 2, row: 1 },
          { id: 'validate', label: 'Validate', sub: 'null, confidence, range', kind: 'gate', col: 4, row: 1 },
          { id: 'mask', label: 'Mask', sub: 'ai_mask', mono: true, col: 2, row: 2 },
          { id: 'validated', label: 'Validated table', kind: 'store', col: 3, row: 2 },
          { id: 'quarantine', label: 'Quarantine table', sub: 'review_status pending', kind: 'store', col: 4, row: 2 },
          { id: 'masked', label: 'Masked copy', sub: 'shared with other teams', kind: 'store', col: 1, row: 2 },
          { id: 'reviewer', label: 'Reviewer', sub: 'table or Databricks App', kind: 'surface', col: 4, row: 3 },
        ],
        edges: [
          { from: 'volume', to: 'loader' },
          { from: 'loader', to: 'parse' },
          { from: 'parse', to: 'parsed' },
          { from: 'parse', to: 'classify' },
          { from: 'classify', to: 'extract', label: 'type picks schema' },
          { from: 'extract', to: 'validate' },
          { from: 'validate', to: 'validated', label: 'pass' },
          { from: 'validate', to: 'quarantine', label: 'fail', dashed: true },
          { from: 'quarantine', to: 'reviewer' },
          { from: 'parsed', to: 'mask' },
          { from: 'mask', to: 'masked' },
        ],
        legend: [
          { kind: 'highlight', label: 'The per-page cost' },
          { kind: 'gate', label: 'Quality check' },
          { kind: 'store', label: 'Unity Catalog table or volume' },
          { kind: 'dashed', label: 'Held for review' },
        ],
        caption:
          'The patterns are: land and track, parse once, classify and route, extract by schema, validate and review, mask before sharing, and measure then extrapolate cost.',
      },
      links: [
        {
          label: 'Intelligent document processing',
          url: 'https://docs.databricks.com/aws/en/agents/agent-bricks/intelligent-document-processing',
          note: 'The three ways to run the same functions: Agent Bricks UI, SQL, and REST.',
        },
      ],
    },
    {
      id: 'land',
      heading: 'Pattern 1: Land and track documents incrementally',
      prose:
        'When to use it: any intake that keeps producing files, such as scans from a mailroom, invoices from a portal, or forms from a service. How it works: files go into a Unity Catalog volume and stay unchanged. Auto Loader reads the folder with the binaryFile format and writes one row per new file to a table: path, size, modification time, and ingest time. It remembers what it has seen, so a rerun reads nothing twice. The table holds metadata only; later steps read the bytes from the volume.',
      options: {
        caption: 'How to find new files',
        rows: [
          {
            option: 'Auto Loader (cloudFiles, binaryFile)',
            when: 'Files arrive continuously or in batches and you want each one recorded once.',
            tradeoffs:
              'Docs: it processes new files incrementally as they land. Keeps a checkpoint to maintain. Works the same in a job notebook or a pipeline.',
          },
          {
            option: 'STREAM read_files in a streaming table',
            when: 'You build the pipeline in Lakeflow Spark Declarative Pipelines and want SQL only.',
            tradeoffs:
              'Practical guidance: the same incremental behavior with the checkpoint managed for you. It ties the ingest to the pipeline, so a notebook job cannot reuse it.',
          },
          {
            option: 'Plain read_files',
            when: 'A one-off load or a small sample you read in full.',
            tradeoffs:
              'Practical guidance: it lists and reads the whole path on every run, so each rerun re-reads old files and, if you parse in the same query, pays to parse them again.',
          },
        ],
        recommendation:
          'Use Auto Loader semantics. In a pipeline that is a streaming table over STREAM read_files; in a job it is cloudFiles with the binaryFile format. Both record each file once, which is what the parse step needs.',
      },
      points: [
        {
          strong: 'Keep the original file.',
          text: 'Never overwrite or move the landed file. The volume copy is the evidence and the input for any reparse after a model update.',
        },
        {
          strong: 'Store metadata, not bytes, in the tracking table.',
          text: 'Path, size, modified time, and ingested time are enough. Carrying the binary into every table copies the files.',
        },
        {
          strong: 'Use availableNow for batch cadence.',
          text: 'trigger(availableNow=True) processes what is new and stops, so a scheduled job does not hold compute while it waits for files.',
        },
        {
          strong: 'Give each source its own folder.',
          text: 'One landing folder per intake channel keeps grants simple and gives you a cheap routing hint for pattern 3.',
        },
      ],
      links: [
        {
          label: 'Auto Loader',
          url: 'https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/',
        },
        { label: 'Binary file format', url: 'https://docs.databricks.com/aws/en/query/formats/binary' },
        { label: 'Unity Catalog volumes', url: 'https://docs.databricks.com/aws/en/volumes/' },
        { label: 'read_files', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/read_files' },
        {
          label: 'Trigger a job when files arrive',
          url: 'https://docs.databricks.com/aws/en/jobs/file-arrival-triggers',
        },
      ],
    },
    {
      id: 'parse',
      heading: 'Pattern 2: Parse once, store, reuse',
      prose:
        'When to use it: PDFs, scans, images, and Office files whose text, tables, and layout you need as data. How it works: ai_parse_document takes the file bytes and returns a VARIANT with pages, elements (text, titles, tables, figures), bounding boxes, and a confidence for each. Scanned pages go through OCR inside the same call. The parse is the per-page cost of the pipeline, so parse a file once and keep the result. The docs limit a document to 500 pages and 100 MB, and a longer one fails unless you pass pageRange. Supported inputs are PDF, JPG, PNG, TIFF, DOC and DOCX, and PPT and PPTX.',
      options: {
        caption: 'Where the parsing runs',
        rows: [
          {
            option: 'ai_parse_document',
            when: 'Documents in the supported formats, and you want no model or OCR service to host.',
            tradeoffs:
              'Docs: GA since April 2026; billed under the AI_FUNCTIONS product; needs Databricks Runtime 17.3 or later, and on serverless environment version 3 or later. Docs list limits: 500 pages and 100 MB per document, weaker accuracy on non-Latin text such as Japanese or Korean, and digital signatures may not be processed accurately. You cannot swap the model.',
          },
          {
            option: 'A parser or OCR engine you run yourself',
            when: 'A format or language the function does not handle well, or a layout you must control.',
            tradeoffs:
              'Practical guidance: you own accuracy, dependencies, and scaling, and the cost moves from a per-page AI Functions charge to the compute you run. Governance stays good if the code runs in your workspace and writes to Unity Catalog; it weakens if the files leave for an outside service.',
          },
          {
            option: 'Agent Bricks Document Parsing',
            when: 'You want to look at a few sample documents and the parsed structure before you write any SQL.',
            tradeoffs:
              'The no-code UI on the same function, listed on the intelligent document processing page. It tests samples; the pipeline still runs the SQL function. I did not confirm its release stage in the docs.',
          },
        ],
        recommendation:
          'Start with ai_parse_document. Test 20 to 30 representative pages, including your worst scans, before you commit. Move to your own parser only for a format or language it fails on in that test.',
      },
      points: [
        {
          strong: 'Insert only files that are not in the parsed table yet.',
          text: 'An anti-join on path is the whole mechanism. The reference run parsed all 28 files on the first pass and none on the second.',
        },
        {
          strong: 'Count errors; do not test for NULL.',
          text: "The result is a VARIANT, and a JSON null inside it is a value. doc:error_status IS NULL drops every row. Use coalesce(array_size(try_variant_get(doc, '$.error_status', 'ARRAY<VARIANT>')), 0) = 0.",
        },
        {
          strong: 'Pass version 2.0.',
          text: "map('version', '2.0') selects the current output shape.",
        },
        {
          strong: 'Keep the whole VARIANT and a flat text column.',
          text: 'The VARIANT holds layout and per-element confidence. The text column is what classification, extraction, and masking read.',
        },
        {
          strong: 'Filter low-confidence OCR elements before extraction on poor scans.',
          text: 'The AI Functions guide shows a faded page where a misread element changed the extracted number. Choose the cutoff from a labeled sample.',
        },
      ],
      links: [
        {
          label: 'ai_parse_document',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_parse_document',
          note: 'Formats, options, output, and limits.',
        },
        {
          label: 'Intelligent document processing',
          url: 'https://docs.databricks.com/aws/en/agents/agent-bricks/intelligent-document-processing',
        },
      ],
    },
    {
      id: 'parse-store',
      heading: 'Parse once: store the output or parse on demand',
      prose:
        'The same page is read many times over a document’s life: to classify it, extract from it, mask it, search it, and answer a question later. Whether those reads call the parser again is a design choice.',
      options: {
        rows: [
          {
            option: 'Store the parsed output',
            when: 'Almost always. Any document you will touch twice.',
            tradeoffs:
              'Pays the parse once. Costs storage, and a VARIANT with layout is larger than the text. Needs a rule for when to reparse, such as after the docs announce a model update. Governed in Unity Catalog like any table.',
          },
          {
            option: 'Parse on demand',
            when: 'A one-time question over a document you will not see again.',
            tradeoffs:
              'No storage and no stale output. Every read pays the parse, so a retry, a new question, or a dashboard refresh bills the same pages again. Results can change if the model behind the function changes.',
          },
        ],
        recommendation:
          'Store it. Parse cost scales with pages and every later step is cheaper when it reads a table, while storage for text is small next to a second parse.',
      },
    },
    {
      id: 'classify',
      heading: 'Pattern 3: Classify and route by type',
      prose:
        'When to use it: a mixed intake where invoices, forms, letters, and receipts arrive together and need different handling. How it works: ai_classify takes the parsed text and a set of labels, each with a one-line description, and returns a label with a confidence score. The label chooses the extraction schema. A document whose confidence falls under your threshold takes a review route instead of a guess. The function takes up to 500 labels and a multilabel option.',
      options: {
        caption: 'How to decide the type',
        rows: [
          {
            option: 'ai_classify in SQL',
            when: 'Types are not obvious from where the file came from.',
            tradeoffs:
              'Docs: GA since June 2026; version 2.1 returns a confidence score and optionally a rationale. One more model call per document. Label descriptions are part of the prompt, so wording matters.',
          },
          {
            option: 'Agent Bricks Classification',
            when: 'You want to tune labels against sample documents in a UI first.',
            tradeoffs:
              'Built on the same v2 function; the release notes put the Classification UI in Public Preview in March 2026, and I found no later stage change. It prepares the labels; the pipeline still calls ai_classify.',
          },
          {
            option: 'Route by folder or file name',
            when: 'The intake channel already says what the document is.',
            tradeoffs:
              'Practical guidance: free and instant. Only as reliable as the channel, and a misfiled document goes down the wrong path without anyone noticing.',
          },
        ],
        recommendation:
          'Use the channel as a hint and ai_classify as the check. If they disagree, send the document to review.',
      },
      points: [
        {
          strong: 'Describe each label in a sentence.',
          text: 'Descriptions up to 1,000 characters are part of the prompt. Say what makes an invoice an invoice.',
        },
        {
          strong: 'Turn on confidence scores and set a floor.',
          text: 'enableConfidenceScores returns a score from 0 to 1. Pick the cutoff from a labeled sample; the docs say the right threshold depends on your tolerance for error.',
        },
        {
          strong: 'Keep the label set small and distinct.',
          text: 'Add a catch-all label such as other so odd documents have somewhere honest to go.',
        },
        {
          strong: 'Send the model a bounded slice of text.',
          text: 'Classification rarely needs a whole long document. The first few thousand characters usually carry the type; verify on your sample.',
        },
      ],
      links: [
        {
          label: 'ai_classify',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_classify',
        },
        {
          label: 'Agent Bricks Classification',
          url: 'https://docs.databricks.com/aws/en/agents/agent-bricks/classification',
        },
      ],
    },
    {
      id: 'extract',
      heading: 'Pattern 4: Extract by schema',
      prose:
        'When to use it: once you know the type and need named fields as columns. How it works: ai_extract takes the parsed text and a JSON schema with a type and a description for each field. Version 2.1 can return a confidence score per field and citations that point back into the document. Store the raw response once, then unpack it into one row per document and field. Ask only for the fields downstream needs: a four-field invoice schema is cheaper to run and easier to check than one that lists every line item.',
      options: {
        caption: 'How to run extraction',
        rows: [
          {
            option: 'ai_extract in SQL',
            when: 'Fields you can define in a schema, run in a pipeline or job.',
            tradeoffs:
              'Docs: GA since June 2026. You tune by editing field descriptions and the instructions option, and by trying precision mode on long or deeply nested documents. No built-in evaluation; you score against labeled rows yourself.',
          },
          {
            option: 'Agent Bricks Information Extraction',
            when: 'Accuracy needs tuning against labeled examples, or you want evaluation and versions without writing the evaluation code.',
            tradeoffs:
              'Docs: define the schema in a UI, give feedback that rewrites field descriptions, and run an evaluation against a Unity Catalog table of inputs and ground-truth JSON. It reports field accuracy, precision, recall, and F1, and keeps versions to compare. Use Agent opens a SQL query that calls ai_extract, or creates a Lakeflow pipeline. Release stage: Public Preview per the March 2026 release notes; I found no later change, and the current docs page shows no stage label.',
          },
          {
            option: 'ai_query with your own prompt',
            when: 'Output the schema cannot express, or you must choose the model.',
            tradeoffs:
              'Practical guidance: the most flexible and the most to maintain. You write the prompt, parse the JSON, handle failures, and check that the endpoint accepts batch calls. Per-row cost depends on the model you pick.',
          },
        ],
        recommendation:
          'Start with ai_extract and a labeled sample. Move to Information Extraction when the sample shows fields you cannot fix by editing descriptions, or when someone needs an evaluation report. Use ai_query only for output a schema cannot describe.',
      },
      points: [
        {
          strong: 'Write a description on every field.',
          text: 'Say the format (YYYY-MM-DD), the unit (USD), and what to return when the value is absent.',
        },
        {
          strong: 'Request confidence scores.',
          text: 'enableConfidenceScores adds a score from 0 to 1 to each field. Step 5 uses it.',
        },
        {
          strong: 'Make absence legal.',
          text: 'A field that is not in the document should come back null. A schema that forces a value invites a made-up one.',
        },
        {
          strong: 'Do not call the function once per field.',
          text: 'Store the full response in a table, then unpack fields from the table. The model runs once per document, and you keep the raw response to inspect later.',
        },
        {
          strong: 'Keep a labeled sample and score it after every change.',
          text: 'Release notes can change the model behind the function. A hundred labeled rows catches a regression the day it happens.',
        },
      ],
      links: [
        {
          label: 'ai_extract',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_extract',
          note: 'Schema syntax, version 2.1 options, and output.',
        },
        {
          label: 'Agent Bricks Information Extraction',
          url: 'https://docs.databricks.com/aws/en/agents/agent-bricks/info-extraction',
          note: 'Schema generation, evaluation, and versions.',
        },
        { label: 'ai_query', url: 'https://docs.databricks.com/aws/en/large-language-models/ai-query' },
      ],
    },
    {
      id: 'review',
      heading: 'Pattern 5: Validate, quarantine, and human review',
      prose:
        'When to use it: whenever an extracted value feeds a payment, a record, or a decision. How it works: check every document’s fields against rules, then write it to one of two tables. A document passes when its required fields are not null, every confidence is at or above your threshold, dates parse, and amounts are in range. Anything else goes to a quarantine table with the reasons and a review status of pending. A reviewer works from that table, fixes or rejects the row, and the corrected value moves to the validated table.',
      options: {
        caption: 'Where reviewers work',
        rows: [
          {
            option: 'A review table with SQL or a dashboard',
            when: 'Low volume, or reviewers who already work in SQL and dashboards.',
            tradeoffs:
              'Practical guidance: nothing to build or host. No form, no row locking, and no clean way to write a correction back, so status changes happen in SQL.',
          },
          {
            option: 'A Databricks App with Lakebase',
            when: 'Reviewers need to see the page next to the fields, fix a value, and approve it.',
            tradeoffs:
              'Practical guidance: a real review screen with state in Lakebase, a Postgres database, and sign-in through the workspace. You own an application: code, deployment, and a sync from the quarantine table.',
          },
          {
            option: 'An external review tool',
            when: 'A review team already works in another system.',
            tradeoffs:
              'Practical guidance: reuse the team’s tooling. Documents and extracted values leave Unity Catalog governance and audit unless you sync results back and control access to the tool.',
          },
        ],
        recommendation:
          'Begin with the review table. Build a Databricks App on Lakebase when reviewers spend real time on it and need the page and the fields on one screen.',
      },
      points: [
        {
          strong: 'Quarantine, do not drop.',
          text: 'Keep the file name, the type, every field, and the reasons. A reviewer needs the same evidence the check used.',
        },
        {
          strong: 'Treat a missing required field and a low-confidence field the same way.',
          text: 'Both mean the extraction is not trustworthy. Name the field in the reason.',
        },
        {
          strong: 'Seed failures to test the check.',
          text: 'The reference documents include an invoice with no total, a form with no date, and a faint, tilted receipt. The run reports how many the check caught and how many good documents it held back.',
        },
        {
          strong: 'Use pipeline expectations when you build in a pipeline.',
          text: 'Lakeflow expectations can drop or quarantine rows by rule. The quarantine table above is the same idea with reasons you control.',
        },
        {
          strong: 'Measure the review rate.',
          text: 'The share of documents quarantined is also a cost: people. Track it per document type.',
        },
      ],
      links: [
        { label: 'Lakeflow expectations', url: 'https://docs.databricks.com/aws/en/ldp/expectations' },
        { label: 'Databricks Apps', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/' },
        { label: 'Lakebase', url: 'https://docs.databricks.com/aws/en/oltp/projects' },
        {
          label: 'Use Lakebase from a Databricks App',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase',
        },
      ],
    },
    {
      id: 'mask',
      heading: 'Pattern 6: Mask personal data before sharing',
      prose:
        'When to use it: documents contain names, emails, phone numbers, or addresses, and other teams or tools need the text but not the identities. How it works: ai_mask takes text and a list of entity labels, such as person, email, and phone, and replaces each match with a mask token. Write the result to a separate masked table and grant other teams that table, not the parsed one.',
      options: {
        caption: 'How to keep personal data out of reach',
        rows: [
          {
            option: 'ai_mask on free text',
            when: 'The identities sit anywhere in paragraphs of text.',
            tradeoffs:
              'Docs: Public Preview, HIPAA compliant, and tuned for English. A model call per document, and it can miss a value, so test for leaks.',
          },
          {
            option: 'Unity Catalog column masks and row filters',
            when: 'The personal data is in known columns, such as applicant_name.',
            tradeoffs:
              'Docs: enforced at query time per user or group. Deterministic and free of model calls. It cannot find a name inside a text column.',
          },
          {
            option: 'Do not extract it',
            when: 'Nobody downstream needs the field.',
            tradeoffs:
              'Practical guidance: the strongest control, because the value is never copied. The parsed text table still holds it, so grants on that table still matter.',
          },
        ],
        recommendation:
          'Use column masks for known columns and ai_mask for text that others will read. Restrict the unmasked parsed table to the pipeline and the reviewers.',
      },
      points: [
        {
          strong: 'Plant known values and test for leaks.',
          text: 'The reference documents carry made-up names, emails, and phone numbers. The run counts how many survive masking.',
        },
        {
          strong: 'Mask the copy, not the source.',
          text: 'The parsed table keeps full text for reviewers. Other teams read the masked table.',
        },
        {
          strong: 'Check the language.',
          text: 'The docs say ai_mask is tuned for English during the preview. Test other languages before you rely on it.',
        },
      ],
      links: [
        { label: 'ai_mask', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_mask' },
        {
          label: 'Row filters and column masks',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks',
        },
      ],
    },
    {
      id: 'build',
      heading: 'Building it: pipeline or job',
      prose:
        'The steps are the same however you run them. Each one processes only what is new: files not yet landed, files not yet parsed, documents not yet classified. That incremental rule is what makes a rerun cheap. The reference bundle runs the notebooks as a serverless Lakeflow Job. The same SQL fits in a Lakeflow Spark Declarative Pipeline.',
      options: {
        caption: 'How to run it',
        rows: [
          {
            option: 'Scheduled batch in a pipeline',
            when: 'Documents arrive in batches, and a delay of hours is fine.',
            tradeoffs:
              'Practical guidance: streaming tables track what has been processed and expectations check quality. Serverless compute runs only during the update. The ai_* calls sit inside table definitions, so a fix to a prompt means a refresh.',
          },
          {
            option: 'Job with notebooks, triggered by schedule or file arrival',
            when: 'You want separate, testable steps, or a step the pipeline model does not fit, like measuring the bill.',
            tradeoffs:
              'Docs: a job can start when files land in a location. You write the incremental logic yourself: the anti-join and the checkpoint. More code, more control.',
          },
          {
            option: 'Continuous streaming',
            when: 'A person or system waits on each document within seconds or minutes.',
            tradeoffs:
              'Practical guidance: lowest latency and the highest standing cost, since compute stays up. Most intake work does not need it.',
          },
        ],
        recommendation:
          'Use a triggered pipeline or job on a schedule that matches how fast the business needs results. Add continuous processing only for a stated latency target.',
      },
      points: [
        {
          strong: 'One incremental rule per step.',
          text: 'Land: Auto Loader checkpoint. Parse: path not in the parsed table. Classify and extract: path not in the output table. A retry then repeats nothing that already succeeded.',
        },
        {
          strong: 'Keep failures in the data.',
          text: 'Count parse errors, keep the error message from ai_extract, and route failures to quarantine. One bad file should not fail the run.',
        },
        {
          strong: 'Run on serverless.',
          text: 'ai_parse_document needs serverless environment version 3 or later. Serverless jobs and pipelines also give you per-run usage in system.billing.usage.',
        },
      ],
      examples: [
        {
          label: 'The same first two steps in a pipeline',
          language: 'sql',
          code: `-- Not run in the reference job.
CREATE OR REFRESH STREAMING TABLE documents_raw AS
SELECT path, length AS size_bytes, modificationTime AS modified_at, content
FROM STREAM read_files('/Volumes/main/documents/landing/', format => 'binaryFile');

CREATE OR REFRESH STREAMING TABLE documents_parsed AS
SELECT path, ai_parse_document(content, map('version', '2.0')) AS doc
FROM STREAM documents_raw;`,
          notes: [
            'Each file flows through once, so each page is parsed once.',
            'This copy of the bytes sits in documents_raw. The reference job keeps only metadata and reads the file from the volume.',
          ],
        },
      ],
      links: [
        { label: 'Lakeflow Spark Declarative Pipelines', url: 'https://docs.databricks.com/aws/en/ldp/' },
        { label: 'Streaming tables', url: 'https://docs.databricks.com/aws/en/ldp/concepts/streaming-tables' },
        { label: 'Lakeflow Jobs', url: 'https://docs.databricks.com/aws/en/jobs/' },
        {
          label: 'Trigger types for streaming',
          url: 'https://docs.databricks.com/aws/en/structured-streaming/triggers',
        },
      ],
    },
    {
      id: 'governance',
      heading: 'Governance',
      prose:
        'Documents often hold regulated data, so settle access, residency, and audit before the first real file lands. Everything here is a Unity Catalog control, applied to the volume and the tables the same way.',
      steps: [
        {
          title: 'Grant on the volume and the tables, by role',
          body: 'The pipeline identity writes to the landing volume and every table. Reviewers read the quarantine table and the parsed one. Other teams read only the masked table.',
          code: `GRANT READ VOLUME, WRITE VOLUME ON VOLUME main.documents.landing TO \`doc-pipeline\`;
GRANT SELECT, MODIFY ON SCHEMA main.documents TO \`doc-pipeline\`;
GRANT SELECT ON TABLE main.documents.quarantine TO \`doc-reviewers\`;
GRANT SELECT ON TABLE main.documents.masked TO \`analysts\`;`,
        },
        {
          title: 'Mask what you share',
          body: 'Pattern 6: ai_mask for text, column masks for known columns, and no grant on the unmasked parsed table outside the pipeline and reviewers.',
        },
        {
          title: 'Know where the data is processed',
          body: 'AI Functions are Designated Services: they process data in the workspace’s Geo when the service is available there. If it is not, an admin may have to enable cross-Geo processing. Check this before regulated documents arrive.',
        },
        {
          title: 'Check the compliance security profile',
          body: 'On workspaces with the compliance security profile, the release notes say ai_parse_document, ai_extract, and ai_classify are available by default. ai_mask is in Public Preview. Confirm each function against your standard before regulated data reaches it.',
        },
        {
          title: 'Use lineage and audit to answer "where did this value come from"',
          body: 'Unity Catalog lineage links the volume, the parsed table, the extracted fields, and the validated table. The audit log records who read or changed each. Keep the original file and the stored parse so a disputed value can be traced to the page.',
        },
      ],
      links: [
        {
          label: 'Manage privileges in Unity Catalog',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/manage-privileges/',
        },
        {
          label: 'Data lineage',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage',
        },
        { label: 'Audit logs', url: 'https://docs.databricks.com/aws/en/admin/account-settings/audit-logs' },
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
      id: 'cost',
      heading: 'Pattern 7: Measure on a sample, then extrapolate cost',
      prose:
        'When to use it: any time someone needs an annual number for a document program. How it works: run a representative sample through the real pipeline, read what it was billed from system.billing.usage, divide by the pages and documents processed, and scale to your volume with explicit allowances. The result is a formula with inputs you can defend line by line, instead of a single guess. This guide gives no price per page: rates differ by contract, so take the rate from the pricing page and your own agreement.',
      options: {
        caption: 'How to build the estimate',
        rows: [
          {
            option: 'Sample and extrapolate',
            when: 'You have representative documents, even a few days before the estimate is due.',
            tradeoffs:
              'Captures your page mix, schemas, and pipeline overhead. Needs a sample large enough to include each type, and billing arrives late: the docs say records are typically available within 12 hours.',
          },
          {
            option: 'Per-token calculator',
            when: 'There are no documents yet, and you need a first number.',
            tradeoffs:
              'Practical guidance: you must guess tokens per page, calls per document, and the share of pages that need OCR. The task functions do not return token counts, so you cannot check the guess later.',
          },
          {
            option: 'Pricing page alone',
            when: 'A sanity check on a figure from another source.',
            tradeoffs:
              'Practical guidance: gives the unit rates, not your volume of calls or the compute around them. It cannot tell you cost per page for your mix of documents.',
          },
        ],
        recommendation:
          'Sample and extrapolate. Use the pricing page and your contract rate to convert the measured DBUs to currency, and a calculator only to cross-check.',
      },
      steps: [
        {
          title: 'What drives the cost',
          body: 'Four things. (1) Pages parsed: ai_parse_document usage recorded under AI_FUNCTIONS, which scales with pages, not documents. (2) Classification and extraction: model work that grows with the text sent and the size of the schema. (3) The serverless compute that runs the job or pipeline, recorded under the job run. (4) Storage for the originals, the parsed VARIANT, and the stored responses, which is billed by your cloud storage and is not in system.billing.usage. Reviewers and a review app add people and hosting cost outside the bill.',
        },
        {
          title: 'How to measure',
          body: 'Run about 100 documents that cover every type, including your worst scans. Then read the run from system.billing.usage. The table is account-wide, so filter to your workspace, the identity that ran the job, and the run window. Keep AI_FUNCTIONS rows, split by product_features.ai_functions.ai_function (for example AI_PARSE_DOCUMENT), and the serverless compute rows that carry the run’s job_run_id. Billing lags the work, so wait for the table to catch up before you divide.',
          code: `SELECT u.billing_origin_product,
       u.product_features.ai_functions.ai_function AS ai_function,
       sum(u.usage_quantity) AS dbus
FROM system.billing.usage u
WHERE u.workspace_id = '<workspace-id>'
  AND u.identity_metadata.run_as = '<job-run-as>'
  AND u.usage_start_time < TIMESTAMP '<run end>' AND u.usage_end_time > TIMESTAMP '<run start>'
  AND (u.billing_origin_product = 'AI_FUNCTIONS'
       OR (u.billing_origin_product = 'JOBS' AND u.usage_metadata.job_run_id = '<job-run-id>'))
GROUP BY ALL;`,
        },
        {
          title: 'The formula',
          body: 'cost per page = (AI Functions DBUs + serverless compute DBUs for the sample run) / pages in the sample. Annual DBUs = cost per page x pages per year x (1 + growth) x (1 + share reprocessed). Multiply by your contract rate per DBU, then add storage, any review app and database, and reviewer time. Keep each input visible, so a sponsor can change one and see the total move.',
        },
        {
          title: 'A worked example',
          body: 'Take a per-page cost c in DBUs from your sample run. Assume 500,000 pages a year, 20% growth, and 5% of pages parsed again. Those three volume inputs are examples, not findings. Annual DBUs = c x 500,000 x 1.20 x 1.05 = c x 630,000. Convert with your contract rate per DBU. The reference run’s own per-page figure was not yet in system.billing.usage when this page was written, so no measured figure is quoted here.',
        },
      ],
      points: [
        {
          strong: 'Parse once and store.',
          text: 'The biggest lever. A pipeline that reparses on every rerun multiplies the largest line by the number of reruns.',
        },
        {
          strong: 'Extract only the fields you need.',
          text: 'A short schema is a smaller job. Add a field when a downstream use needs it.',
        },
        {
          strong: 'Route simple documents to a cheaper path.',
          text: 'If the channel already says a file is a receipt, a smaller schema, or no extraction at all, spares the classification call.',
        },
        {
          strong: 'Batch the work.',
          text: 'Run on a schedule over everything new, rather than one document at a time. The reference job processes its batch in one query per step.',
        },
        {
          strong: 'Cut the review rate.',
          text: 'Every quarantined document costs a person’s time. Better descriptions and a labeled sample lower it.',
        },
      ],
      links: [
        {
          label: 'Billable usage system table',
          url: 'https://docs.databricks.com/aws/en/admin/system-tables/billing',
          note: 'Columns, billing_origin_product values, and record availability.',
        },
        {
          label: 'View costs for AI Function workloads',
          url: 'https://docs.databricks.com/aws/en/large-language-models/ai-functions',
          note: 'The AI_FUNCTIONS queries, including the per-function filter.',
        },
        {
          label: 'Jobs cost system table',
          url: 'https://docs.databricks.com/aws/en/admin/system-tables/jobs-cost',
        },
        { label: 'Databricks pricing', url: 'https://www.databricks.com/product/pricing' },
      ],
    },
    {
      id: 'reference-run',
      heading: 'What the reference run measured',
      prose:
        'One run in the reference workspace: 28 generated documents and 33 pages, on serverless compute. The documents are clean and simple, so the accuracy figures say the setup works, not how the functions do on your documents. The cost figures are measured on this small sample in the reference workspace. They are not a quote.',
      table: {
        columns: ['Step', 'Result in the reference run'],
        rows: [
          [
            'Land 28 documents',
            'Auto Loader ingested 28 files on the first pass and none on the second. The 410,805 bytes of original files stayed in the volume.',
          ],
          [
            'Parse once',
            '28 documents and 33 pages parsed with no errors in about 22 seconds. A second pass parsed nothing. The faint, tilted receipt came through OCR with every field correct.',
          ],
          ['Classify and route', 'All 28 got the right type; none went to the review route.'],
          [
            'Extract by schema',
            '112 of 113 fields correct. The miss is below. An earlier run of the same code scored 113 of 113.',
          ],
          [
            'Validate and quarantine',
            '26 documents validated and 2 quarantined, both on purpose: the invoice with no total and the form with no date. No good document was held back.',
          ],
          ['Mask', '13 forms and letters masked. None of the 33 planted names, emails, and phone numbers survived.'],
          [
            'Measure cost',
            'The job’s last task found no billing rows yet: the newest row for the workspace was about three hours older than the run. It recorded a billing_status of not_available and -1 on every cost line, which means no usage yet, not zero cost. The notebook runs again once the table catches up.',
          ],
        ],
      },
      points: [
        {
          strong: 'The same input gave different answers.',
          text: 'The invoice with its total line removed came back as null in one run. In the recorded run it came back as 2868.04, a figure that is on the page nowhere. The line items sum to 2,870.24. The confidence on that field was 0.10, so the 0.8 floor in the validation step quarantined it. Keep the floor.',
        },
        {
          strong: 'Billing arrives hours later.',
          text: 'The newest billing row for the workspace was about three hours behind when the run finished. The docs say records are typically available within 12 hours. The job\u2019s last task polls for four minutes, records a billing_status of not_available, and the notebook is rerun later to fill in the numbers.',
        },
        {
          strong: 'The usage table covers the whole account.',
          text: 'The first query without a workspace filter returned AI Functions usage from other users. Filter by workspace and the identity that ran the job, or you will count other people\u2019s work.',
        },
        {
          strong: 'Wall time is small next to startup.',
          text: 'Parse took about 22 seconds, classify about 18, and extract about two minutes for four queries over 28 documents. Waiting for each serverless task to start took longer than any step ran.',
        },
        {
          strong: 'The sample is below the size to trust.',
          text: 'Twenty-eight documents is enough to learn the method and too few to size a program. Use about 100 or more of your own, with every type and your worst scans.',
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
            'Serverless jobs and pipelines. ai_parse_document needs serverless environment version 3 or later.',
          ],
          ['ai_parse_document', 'Databricks Runtime 17.3 or later; 500 pages and 100 MB per document'],
          [
            'ai_extract version 2.1',
            'Databricks Runtime 18.2 or later is recommended for the best performance and latest features',
          ],
          ['Region', 'AI Functions available in the workspace region, or cross-Geo processing enabled'],
          ['Unity Catalog', 'A volume for the files, a schema for the tables, and grants for the pipeline identity'],
          [
            'System tables',
            'Read access to system.billing.usage and system.billing.list_prices to repeat the cost measurement',
          ],
        ],
      },
    },
  ],
  related: [
    { slug: 'ai-functions', title: 'AI Functions in SQL' },
    { slug: 'file-format-ingestion', title: 'File format ingestion' },
    { slug: 'cost-chargeback', title: 'Cost tracking and chargeback' },
  ],
};
