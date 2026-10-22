import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'ai-functions-data-quality',
  area: 'AI Guides',
  title: 'AI Functions for data quality',
  intro:
    'Rules catch what you can write down: a null, a range, a known code. Free text, messy addresses, near-duplicate names, and contradictions between fields need judgment. AI Functions earn their cost on the rows rules cannot judge. Below are the SQL for five checks and how to run them on only those rows. For the functions themselves see AI Functions in SQL, and for rules and quarantine see the data validation framework.',
  businessValue: {
    summary:
      'Data teams can check free text, addresses, duplicates, and sensitive values that rules cannot, without sending every row to a model. Rules run first, AI covers the rest, and a labelled sample shows which checks to trust.',
    outcomes: [
      {
        title: 'Coverage rules cannot reach',
        body: 'A reason code that contradicts its free text, a name typed three ways, or a phone number inside a note passes every format check. AI Functions flag them in SQL, with no model to host.',
      },
      {
        title: 'Spend limited to the residue',
        body: 'Rules settle most rows for compute cost only. Only rows they mark unknown reach a model, so the bill follows the hard rows, not the table size.',
      },
      {
        title: 'Trust set by measurement',
        body: 'Each AI check is scored against a labelled sample for precision and recall. A check that misses its thresholds stays advisory until a person has reviewed its output.',
      },
      {
        title: 'Failures kept and explained',
        body: 'AI and rule verdicts share one quality table with a reason. Failed and doubtful records go to quarantine for a reviewer instead of disappearing.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Rules first, AI for the residue.',
      body: 'Write every check you can as SQL or an expectation. Send a model only the rows a rule marks unknown. That one filter decides most of the cost.',
    },
    {
      title: 'One function per kind of check.',
      body: 'ai_classify validates a category, ai_extract standardizes fields, ai_similarity finds near-duplicates, ai_mask finds sensitive text, and ai_query returns pass, fail, and a reason for a whole record.',
    },
    {
      title: 'Return a verdict, not prose.',
      body: 'Use schemas, label lists, and responseFormat so every result is a value you can store, count, and test. Send anything the model cannot settle to review.',
    },
    {
      title: 'Store each result once.',
      body: 'Write AI verdicts to a quality table next to the rule results, quarantine failures with the reason, and join back to get the accepted rows. Do not call the functions from dashboards.',
    },
    {
      title: 'Measure before you trust.',
      body: 'Label a sample, compute precision and recall per check, set thresholds, and keep a human in the loop for the middle band. Rerun it when a prompt, model, or function version changes.',
    },
    {
      title: 'Treat the data path as a decision.',
      body: 'Task functions run on Databricks-hosted models in your Geo. ai_query goes wherever the endpoint goes. Mask or drop sensitive columns before an external model sees them.',
    },
  ],
  prerequisites: [
    {
      slug: 'ai-functions',
      title: 'AI Functions in SQL',
      why: 'It covers each function, requirements, and the Beta ones. Here they are used only for quality checks.',
    },
    {
      slug: 'data-validation-framework',
      title: 'Data validation framework',
      why: 'It builds the rule side: expectations, quarantine, and a results table. The AI checks here plug into that shape.',
    },
  ],
  sections: [
    {
      id: 'when',
      heading: 'When AI beats rules, and when it does not',
      prose:
        'Rules are exact, free, and explainable, and they cannot read. AI Functions read, and they cost a model call, give probabilistic answers, and can change when Databricks upgrades the model behind a task function. A trained model sits between: cheaper per row at volume, but you build and maintain it.',
      options: {
        caption: 'Rules and expectations, AI Functions, or a trained model',
        rows: [
          {
            option: 'Rules and expectations',
            when: 'The condition has a precise definition: not null, in a known set, in a range, matches a pattern, equals a reference value.',
            tradeoffs:
              'Practical guidance: deterministic, cheap, and easy to audit, but they miss anything that needs meaning, such as a reason that contradicts its code. Every new variant of bad data needs a new rule.',
          },
          {
            option: 'AI Functions',
            when: 'The judgment needs language: free text, mixed address formats, names spelled many ways, sensitive values in notes, contradictions between fields.',
            tradeoffs:
              'Docs: every call is a billed model inference on top of compute, and task functions pick their own model. Practical guidance: accuracy is not 100 percent, so measure it and keep review for doubtful rows. No training data or endpoint is needed.',
          },
          {
            option: 'A trained ML model',
            when: 'You have thousands of labelled rows, a stable label set, and tens of millions of rows a day, so a small model scored on your compute beats token cost.',
            tradeoffs:
              'Practical guidance: lowest cost per row at high volume and fully under your control, but you own labelling, training, deployment, and drift. Labelled data from an AI-first phase can seed it later.',
          },
        ],
        recommendation:
          'Rules first, AI for the residue. Move a check to a trained model only when volume makes the token bill larger than the cost of maintaining a model, and you have the labels to train it.',
      },
      points: [
        {
          strong: 'Let the rule say "I do not know".',
          text: 'A rule should return pass, fail, or unknown. The unknown rows are the residue. A rule that guesses when it is unsure hides the rows AI should see.',
        },
        {
          strong: 'Keep the cheap checks cheap.',
          text: 'Null, range, format, and referential checks stay in expectations. Using a model for them adds cost and variance with no gain.',
        },
        {
          strong: 'Expect the residue to be big for free text.',
          text: 'Keywords settle only some reason texts. In the sample dataset a keyword rule settles about half of the reason texts and ai_classify gets the rest. Measure your own share before you budget.',
        },
      ],
      links: [
        {
          label: 'AI Functions overview',
          url: 'https://docs.databricks.com/aws/en/large-language-models/ai-functions',
          note: 'Billing, requirements, and the full function list.',
        },
      ],
    },
    {
      id: 'flow',
      heading: 'The flow: rules, residue, AI, quality table',
      prose:
        'Every record passes through the rules first. The rules settle some checks and leave others unknown. Only the unknown rows reach an AI Function. Both kinds of verdict land in one quality table, and failed or doubtful records go to quarantine.',
      diagram: {
        type: 'flow',
        title: 'Rules first, AI on the residue',
        description:
          'Raw records go through rule expectations. A decision asks whether a rule can judge each check. Rows it settles go straight to the quality table. Unknown rows form the residue and go to AI checks, whose verdicts also go to the quality table. A verdict decision sends passing records to the accepted table and failed or doubtful records to quarantine for review.',
        nodes: [
          {
            id: 'raw',
            label: 'Raw records',
            sub: 'orders, contacts, notes',
            col: 0,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail:
              'The table to check. Free-text columns, addresses, and names are in it next to well-formed columns.',
          },
          {
            id: 'rules',
            label: 'Rule expectations',
            sub: 'SQL, patterns, keywords',
            col: 1,
            row: 0,
            icon: 'gear-teal',
            domain: 'data',
            detail:
              'Plain SQL and expectations. Each check returns pass, fail, or unknown. They cost compute only, so they run on every row.',
          },
          {
            id: 'judge',
            label: 'Rule sure?',
            col: 2,
            row: 0,
            kind: 'gate',
            domain: 'governance',
            detail: 'Rows a rule settles skip the model. Rows marked unknown are the residue and go on to AI.',
          },
          {
            id: 'quality',
            label: 'Quality table',
            sub: 'rule and AI side by side',
            col: 3,
            row: 0,
            kind: 'store',
            icon: 'list',
            domain: 'governance',
            detail:
              'One row per record and check: verdict, reason, source (rule or ai), and confidence. Reports and alerts read this table.',
          },
          {
            id: 'verdict',
            label: 'Verdict',
            sub: 'any fail or review?',
            col: 4,
            row: 0,
            kind: 'gate',
            domain: 'governance',
            detail:
              'A record with no failed or review check is accepted. Anything else is quarantined with its reasons.',
          },
          {
            id: 'residue',
            label: 'Residue',
            sub: 'unknown rows only',
            col: 2,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail:
              'The rows the rules could not judge. Filtering to these before the model call is what bounds the AI bill.',
          },
          {
            id: 'ai',
            label: 'AI checks',
            sub: 'AI Functions',
            col: 3,
            row: 1,
            kind: 'highlight',
            icon: 'gear-maroon',
            domain: 'ai',
            detail:
              'ai_classify, ai_extract, ai_similarity, ai_mask, and ai_query with structured output. Each result is stored once with its raw response.',
          },
          {
            id: 'accepted',
            label: 'Accepted records',
            sub: 'joined back',
            col: 4,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail:
              'Records with every check passed, joined back from the raw table. Downstream tables read from here.',
          },
          {
            id: 'quarantine',
            label: 'Quarantine',
            sub: 'fail or review, reasons',
            col: 3,
            row: 2,
            kind: 'store',
            icon: 'database',
            domain: 'governance',
            detail:
              'Failed and doubtful records with the checks and reasons. A reviewer fixes the source or the rule, and labels from review improve the sample.',
          },
        ],
        edges: [
          { from: 'raw', to: 'rules' },
          { from: 'rules', to: 'judge' },
          { from: 'judge', to: 'quality', label: 'pass or fail' },
          { from: 'judge', to: 'residue', label: 'unknown' },
          { from: 'residue', to: 'ai' },
          { from: 'ai', to: 'quality' },
          { from: 'quality', to: 'verdict' },
          { from: 'verdict', to: 'accepted', label: 'all pass' },
          { from: 'verdict', to: 'quarantine', label: 'fail or review', dashed: true },
        ],
        legend: [
          { kind: 'store', label: 'Unity Catalog table' },
          { kind: 'highlight', label: 'Model calls happen here' },
          { kind: 'gate', label: 'Decision point' },
          { kind: 'dashed', label: 'Needs a reviewer' },
        ],
        caption:
          'The reference job writes aidq_rule_results, aidq_ai_results, aidq_quality_results, aidq_quarantine, and aidq_records_accepted.',
      },
    },
    {
      id: 'patterns',
      heading: 'Which function for which check',
      prose:
        'Each check type maps to one function. The matrix shows where rules are enough and where a function earns its call. The five sections that follow give the SQL.',
      diagram: {
        type: 'matrix',
        title: 'Check type by function',
        description:
          'Rules are enough for null, range, and format checks. ai_classify validates a category against free text. ai_extract standardizes addresses, names, and units. ai_similarity finds near-duplicate names. ai_mask finds sensitive values in free text, and ai_query with a JSON schema validates a whole record and returns pass, fail, and a reason.',
        corner: 'Check ↓ · Function →',
        columns: ['Rules', 'ai_classify', 'ai_extract', 'ai_similarity', 'ai_mask', 'ai_query'],
        rows: [
          {
            label: 'Null, range, format',
            cells: [
              { state: 'own', text: 'Best fit', sub: 'SQL, expectations' },
              { state: 'none', text: 'Costs tokens' },
              { state: 'none', text: 'Costs tokens' },
              { state: 'none', text: 'Wrong tool' },
              { state: 'none', text: 'Wrong tool' },
              { state: 'none', text: 'Costs tokens' },
            ],
          },
          {
            label: 'Category fits its text',
            sub: 'status, reason code',
            cells: [
              { state: 'optional', text: 'Keywords', sub: 'settle the easy rows' },
              { state: 'own', text: 'Best fit', sub: 'labels + confidence' },
              { state: 'none', text: 'Wrong tool' },
              { state: 'none', text: 'Wrong tool' },
              { state: 'none', text: 'Wrong tool' },
              { state: 'optional', text: 'Works', sub: 'more to maintain' },
            ],
          },
          {
            label: 'Standardize fields',
            sub: 'address, name, unit',
            cells: [
              { state: 'optional', text: 'Regex', sub: 'one clean format' },
              { state: 'none', text: 'Wrong tool' },
              { state: 'own', text: 'Best fit', sub: 'schema, enum' },
              { state: 'none', text: 'Wrong tool' },
              { state: 'none', text: 'Wrong tool' },
              { state: 'optional', text: 'Past 256 fields' },
            ],
          },
          {
            label: 'Near-duplicates',
            sub: 'names, entities',
            cells: [
              { state: 'optional', text: 'Exact key', sub: 'after normalizing' },
              { state: 'none', text: 'Wrong tool' },
              { state: 'none', text: 'Wrong tool' },
              {
                state: 'own',
                text: 'Best fit',
                sub: 'blocked pairs',
                detail: 'ai_similarity scores a pair once. Block the join first, because every pair is a model call.',
              },
              { state: 'none', text: 'Wrong tool' },
              { state: 'none', text: 'Wrong tool' },
            ],
          },
          {
            label: 'Sensitive values',
            sub: 'in free text',
            cells: [
              { state: 'optional', text: 'Patterns', sub: 'email, phone, SSN' },
              { state: 'none', text: 'Wrong tool' },
              { state: 'none', text: 'Wrong tool' },
              { state: 'none', text: 'Wrong tool' },
              { state: 'own', text: 'Best fit', sub: 'names, places' },
              { state: 'optional', text: 'Works', sub: 'sends text to a model' },
            ],
          },
          {
            label: 'Fields contradict',
            sub: 'record-level',
            cells: [
              { state: 'none', text: 'Cannot read' },
              { state: 'none', text: 'Wrong tool' },
              { state: 'none', text: 'Wrong tool' },
              { state: 'none', text: 'Wrong tool' },
              { state: 'none', text: 'Wrong tool' },
              {
                state: 'own',
                text: 'Best fit',
                sub: 'responseFormat',
                detail: 'ai_query with a JSON schema returns a verdict and a reason you can store and count.',
              },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Use this' },
          { state: 'optional', label: 'Works, with caveats' },
          { state: 'none', label: 'Wrong tool' },
        ],
      },
    },
    {
      id: 'classify',
      heading: 'Pattern 1: ai_classify validates a category against its text',
      prose:
        'Use this when a column holds a code or status that a person typed next to a free-text explanation, and the two can disagree. Classify the text, compare the label with the submitted code, and treat a mismatch or a low confidence as a finding. Version 2.1 returns a confidence score and takes label descriptions, which become part of the prompt.',
      options: {
        caption: 'How to validate a category',
        rows: [
          {
            option: 'Keyword rules only',
            when: 'The text uses a small, stable vocabulary and a miss is cheap.',
            tradeoffs:
              'Practical guidance: no model cost and fully explainable, but it misses paraphrases such as "it did not survive the trip". Keep it as the first pass either way.',
          },
          {
            option: 'ai_classify on the residue',
            when: 'Two to a few dozen labels, free text, and rules that settle only part of the rows.',
            tradeoffs:
              'Docs: labels are a JSON array or an object of descriptions, 2 to 500 labels in version 2, with optional confidence scores and rationales in 2.1. Practical guidance: write mutually exclusive labels and describe each one. Accuracy depends on label wording.',
          },
          {
            option: 'ai_query with a prompt',
            when: 'You need a custom model, a rubric that does not fit a label set, or several outputs per row.',
            tradeoffs:
              'Practical guidance: most flexible and most to maintain. You own the prompt, the model name, and the parsing. Use responseFormat so the answer is parseable.',
          },
        ],
        recommendation:
          'Keywords first, ai_classify with described labels and confidence scores on the rest. Send rows under your confidence floor to review, and pick the floor from a labelled sample.',
      },
      examples: [
        {
          label: 'Classify the residue and compare with the submitted code',
          language: 'sql',
          code: `SELECT record_id, reason_code,
       r:response[0]:value::STRING AS predicted_code,
       r:response[0]:confidence_score::DOUBLE AS confidence,
       CASE WHEN r:response[0]:confidence_score::DOUBLE < 0.7 THEN 'review'
            WHEN r:response[0]:value::STRING = reason_code THEN 'pass'
            ELSE 'fail' END AS verdict
FROM (
  SELECT record_id, reason_code,
         ai_classify(
           reason_text,
           '{"damaged": "The item arrived broken, cracked, or crushed",
             "wrong_item": "A different item, size, or color than ordered",
             "late": "The order arrived after the promised date",
             "changed_mind": "The customer no longer wants the item"}',
           map('version', '2.1', 'enableConfidenceScores', 'true')) AS r
  FROM quality.returns_unknown
  WHERE reason_text IS NOT NULL
);`,
          notes: [
            'The inner query calls the function once per row. Reading r in the outer query does not call it again.',
            'Version 2.1 returns a VARIANT with response as an array of value and confidence_score. Version 2.0 returns an array of labels, and 1.0 a plain string.',
            'Check the confidence cutoff on a labelled sample. 0.7 here is a starting point, not a documented default.',
          ],
        },
      ],
      links: [
        {
          label: 'ai_classify',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_classify',
          note: 'Options, versions, and limits.',
        },
      ],
    },
    {
      id: 'extract',
      heading: 'Pattern 2: ai_extract standardizes addresses, names, and units',
      prose:
        'Use this when one text column holds several facts in several formats and you want typed fields. Give ai_extract a schema with a type and a description per field. Put the check on the extracted fields: a postal code that is not five digits, or a unit outside the allowed list, is a finding.',
      options: {
        caption: 'How to standardize messy text fields',
        rows: [
          {
            option: 'Regex and lookup tables',
            when: 'There is one dominant format and a reference list, such as ISO country codes or a unit map.',
            tradeoffs:
              'Practical guidance: free and exact on the formats you wrote it for, brittle on the rest. Good as the first pass that clears the clean rows.',
          },
          {
            option: 'ai_extract with a schema',
            when: 'The formats vary, a field can be absent, or you need an enum or nested object.',
            tradeoffs:
              'Docs: up to 256 fields, 12 levels deep, enum values up to 500, and type validation is enforced for integer, number, boolean, and enum, so an invalid value is an error. Practical guidance: say "or null" in the description so absent facts are not invented.',
          },
          {
            option: 'A dedicated address or reference service',
            when: 'You need deliverability, geocoding, or authoritative normalization.',
            tradeoffs:
              'Practical guidance: an external service is authoritative but adds cost and a data transfer to a third party. AI extraction fixes shape, and it does not prove an address exists.',
          },
        ],
        recommendation:
          'Regex for the canonical rows, ai_extract for the rest, and a deterministic check on what comes back. Keep the original value next to the standardized one.',
      },
      examples: [
        {
          label: 'Extract address fields and test the postal code',
          language: 'sql',
          code: `SELECT record_id, address_raw,
       r:response:street:value::STRING AS street,
       r:response:city:value::STRING AS city,
       r:response:state:value::STRING AS state,
       r:response:postal_code:value::STRING AS postal_code,
       r:error_message::STRING AS extract_error,
       regexp_like(coalesce(r:response:postal_code:value::STRING, ''), '^[0-9]{5}$') AS postal_code_ok
FROM (
  SELECT record_id, address_raw,
         ai_extract(
           address_raw,
           '{"street": {"type": "string", "description": "Street number and name, with any unit"},
             "city": {"type": "string"},
             "state": {"type": "string", "description": "Two-letter US state code"},
             "postal_code": {"type": "string", "description": "Five-digit ZIP code, or null when the text has none"}}',
           map('version', '2.1', 'enableConfidenceScores', 'true')) AS r
  FROM quality.addresses_unknown
  WHERE address_raw IS NOT NULL
);`,
          notes: [
            'Each field comes back as an object with value and, with enableConfidenceScores, confidence_score.',
            'Keep error_message. A failed row stays visible instead of failing the batch.',
          ],
        },
        {
          label: 'Standardize units with an enum',
          language: 'sql',
          code: `SELECT ai_extract(
  'about 2.5 kilos of flour',
  '{"quantity": {"type": "number", "description": "Numeric amount"},
    "unit": {"type": "enum", "labels": ["kg", "g", "lb", "oz"], "description": "Canonical unit"}}',
  map('version', '2.1')) AS r;`,
          notes: [
            'An enum keeps the unit to your allowed list. A value outside it returns an error and not a new unit.',
            'For one clean unit column, a lookup join is cheaper and exact.',
          ],
        },
      ],
      links: [
        {
          label: 'ai_extract',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_extract',
          note: 'Schema syntax, options, and limits.',
        },
      ],
    },
    {
      id: 'match',
      heading: 'Pattern 3: Near-duplicates and entity matching',
      prose:
        'Use this when the same company, person, or product is entered under several spellings and an exact key after normalizing does not join them. The cost trap is the number of pairs. A cross join of n rows is n squared model calls, so block first, score each pair once, and keep a middle band for a person.',
      options: {
        caption: 'How to find near-duplicates',
        rows: [
          {
            option: 'Normalize and match exactly',
            when: 'The variants differ by case, punctuation, or legal suffix.',
            tradeoffs:
              'Practical guidance: free, exact, and explainable. It settles a good share of duplicates and leaves typos, abbreviations, and reordered words.',
          },
          {
            option: 'ai_similarity on blocked pairs',
            when: 'Up to a few hundred thousand candidate pairs and you want a score in SQL.',
            tradeoffs:
              'Docs: Public Preview, returns a FLOAT where 1 means the texts are equal, relative and meant for ranking only, and tuned mainly for English. Practical guidance: one model call per pair, so cost follows pairs. Blocking trades recall for cost, because a duplicate outside the block is never compared.',
          },
          {
            option: 'Embeddings and vector search',
            when: 'Large tables, repeated lookups, or matching new records against a reference set.',
            tradeoffs:
              'Docs: an AI Search index with Databricks-computed embeddings stays in sync with its source table, and the vector_search SQL function is Public Preview. Practical guidance: you pay to build and keep an index, then each lookup is cheap. The index is a resource you manage.',
          },
        ],
        recommendation:
          'Exact keys first, then ai_similarity on blocked pairs for a few thousand rows. Move to a vector index when the table is large or you match new records against a reference set many times.',
      },
      examples: [
        {
          label: 'Score blocked pairs once and keep the scores',
          language: 'sql',
          code: `CREATE OR REPLACE TABLE quality.company_pair_scores AS
SELECT record_id, earlier_id, ai_similarity(company_raw, earlier_name) AS score
FROM (
  SELECT t.record_id, t.company_raw, e.record_id AS earlier_id, e.company_raw AS earlier_name
  FROM quality.companies_unknown t
  JOIN quality.companies e
    ON e.record_id < t.record_id AND left(e.name_key, 3) = left(t.name_key, 3)
  ORDER BY t.record_id, e.record_id
  LIMIT 1500
);

SELECT record_id, max_by(earlier_id, score) AS closest, max(score) AS best,
       CASE WHEN max(score) >= 0.85 THEN 'fail'
            WHEN max(score) < 0.6 THEN 'pass' ELSE 'review' END AS verdict
FROM quality.company_pair_scores GROUP BY record_id;`,
          notes: [
            'name_key is the normalized name. The LIMIT is a cost cap, so size it from the pair count you expect.',
            'Scores are relative. The 0.85 and 0.6 thresholds are demo choices, not documented values. Pick yours from labelled pairs.',
          ],
        },
        {
          label: 'Look up the nearest reference records with vector search',
          language: 'sql',
          code: `SELECT * FROM vector_search(
  index => 'main.mdm.company_name_index',
  query_text => 'Northwnd Traders',
  query_type => 'HYBRID',
  num_results => 5
);`,
          notes: [
            'Public Preview. Needs an AI Search index over the reference table, and does not run on classic SQL warehouses.',
            'num_results above 100 is not supported, and the SQL function does not accept filters_json.',
          ],
        },
      ],
      links: [
        {
          label: 'ai_similarity',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_similarity',
        },
        {
          label: 'vector_search function',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/vector_search',
        },
      ],
    },
    {
      id: 'sensitive',
      heading: 'Pattern 4: Find sensitive values in free text',
      prose:
        'Use this when a notes or comments column might hold names, phone numbers, or addresses that should not reach analysts or a shared table. Patterns catch the formats you can spell out. ai_mask finds the rest. Compare its output with the input and a changed note held something sensitive.',
      options: {
        caption: 'How to detect sensitive values',
        rows: [
          {
            option: 'Patterns for email, phone, and ID formats',
            when: 'The value has a fixed shape.',
            tradeoffs:
              'Practical guidance: free and exact on the shape, blind to names and places in prose. Run it first so the model sees fewer notes.',
          },
          {
            option: 'ai_mask on the residue',
            when: 'Free text where people write names, places, and addresses.',
            tradeoffs:
              'Docs: Public Preview, takes text and an array of entity labels and returns text with matches replaced by [MASKED], tuned for English. Practical guidance: model-based, so measure recall on your own notes, because a missed name is a leak.',
          },
          {
            option: 'Data Classification on columns',
            when: 'You need to find which columns hold sensitive data across a catalog.',
            tradeoffs:
              'Docs: an agentic system classifies and tags tables in Unity Catalog and stores results in system.data_classification.results. View scanning and detection exclusions are Beta. It classifies columns, not the words inside a free-text value, and an admin turns it on per catalog with the MANAGE privilege.',
          },
        ],
        recommendation:
          'Patterns first, ai_mask for free-text columns, Data Classification to find which columns need that treatment. Enforce access with column masks and row filters, and use ai_mask to clean text.',
      },
      examples: [
        {
          label: 'Flag notes where ai_mask changed the text',
          language: 'sql',
          code: `SELECT record_id,
       masked <> note AS has_sensitive_text,
       masked AS note_masked
FROM (
  SELECT record_id, note,
         ai_mask(note, array('person', 'email', 'phone', 'address')) AS masked
  FROM quality.notes_unknown
  WHERE note IS NOT NULL
);`,
          notes: [
            'ai_mask returns NULL for a NULL note. Filter them out first so the call is not wasted.',
            'Write the masked text to the quality table, not the original, so the quality table is safe to share.',
          ],
        },
      ],
      links: [
        {
          label: 'ai_mask',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_mask',
        },
        {
          label: 'Data Classification',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification',
        },
      ],
    },
    {
      id: 'validate',
      heading: 'Pattern 5: Record-level validation with structured output',
      prose:
        'Use this when the question needs several fields at once, such as a comment that contradicts the order status. ai_query with responseFormat returns JSON that matches a schema you set, so each row gets a verdict and a reason as columns. Set failOnError to false so one failed row does not fail the batch.',
      options: {
        caption: 'How to get a verdict back from ai_query',
        rows: [
          {
            option: 'Free-text answer, parsed after',
            when: 'A quick test on a few rows.',
            tradeoffs:
              'Practical guidance: models add words, change casing, and wrap answers in prose, so parsing breaks on some rows. Do not build a pipeline on it.',
          },
          {
            option: 'responseFormat with a JSON schema',
            when: 'Production checks that need a stable verdict, enum, and reason.',
            tradeoffs:
              'Docs: needs Databricks Runtime 15.4 LTS or above and a chat model. The schema is limited to 64 keys, and pattern, anyOf, oneOf, allOf, prefixItems, and $ref are not supported. Claude models on Foundation Model APIs accept only json_schema, and the structured outputs page lists the Claude 5.5 models as unsupported. Practical guidance: put an enum on the verdict, and treat an unparseable response as review.',
          },
          {
            option: 'A trained classifier',
            when: 'A fixed, high-volume check with labelled history.',
            tradeoffs:
              'Practical guidance: cheapest per row once built, with no reasons in the output. Train it later from the labels you collect here.',
          },
        ],
        recommendation:
          'responseFormat with a schema, failOnError => false, and review for anything unreadable. Name the endpoint in one pipeline parameter so a model swap is one change.',
      },
      examples: [
        {
          label: 'Return pass or fail with a reason',
          language: 'sql',
          code: `SELECT record_id, order_status, comment,
       from_json(r.response, 'verdict STRING, reason STRING') AS v,
       r.errorMessage AS error
FROM (
  SELECT record_id, order_status, comment,
         ai_query(
           'databricks-meta-llama-3-3-70b-instruct',
           concat('Return fail when the customer comment contradicts the order status, otherwise pass. ',
                  'Status: ', order_status, '. Comment: ', comment),
           responseFormat => '{
             "type": "json_schema",
             "json_schema": {
               "name": "status_comment_check",
               "schema": {
                 "type": "object",
                 "properties": {
                   "verdict": {"type": "string", "enum": ["pass", "fail"]},
                   "reason": {"type": "string"}
                 },
                 "required": ["verdict", "reason"]
               },
               "strict": true
             }
           }',
           failOnError => false) AS r
  FROM quality.status_comments_unknown
  WHERE comment IS NOT NULL
);`,
          notes: [
            'With failOnError => false the result is a struct. Read r.response and r.errorMessage.',
            'Not every pay-per-token endpoint accepts batch calls. Test one row first, and prefer a batch-optimized model from the ai_query page.',
          ],
        },
      ],
      links: [
        {
          label: 'ai_query',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_query',
        },
        {
          label: 'Structured outputs',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/structured-outputs',
        },
      ],
    },
    {
      id: 'normalize',
      heading: 'Pattern 6: Normalize text with ai_fix_grammar, carefully',
      prose:
        'ai_fix_grammar corrects grammatical errors in English text and returns NULL for a NULL input. It is Public Preview, and the docs list it as HIPAA compliant. It changes values, which makes it a cleaning step and not a check, so it fits free text a person will read and does not fit identifiers or anything you match on.',
      points: [
        {
          strong: 'Keep the original.',
          text: 'Write the fixed text to a new column and leave the source value alone. A changed value is the evidence of what was wrong.',
        },
        {
          strong: 'Use it for display text.',
          text: 'Comments and descriptions shown to readers benefit. Names, codes, and addresses do not, because a corrected name is a different name.',
        },
        {
          strong: 'Weigh it against a rule.',
          text: 'Trimming, casing, and whitespace are rules. Use the model for grammar only.',
        },
      ],
      examples: [
        {
          label: 'Add a corrected column',
          language: 'sql',
          code: `SELECT record_id, comment, ai_fix_grammar(comment) AS comment_clean
FROM quality.comments
WHERE comment IS NOT NULL AND length(comment) > 0;`,
          notes: ['Tuned for English. Public Preview.'],
        },
      ],
      links: [
        {
          label: 'ai_fix_grammar',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_fix_grammar',
        },
      ],
    },
    {
      id: 'pipeline',
      heading: 'Running it in a pipeline',
      prose:
        'The AI step is one more task in the pipeline that already runs your rules. Filter first, call once, write the result, and let everything downstream read the table. For expectations and quarantine on the rule side, see the data validation framework.',
      options: {
        caption: 'Where the AI check runs',
        rows: [
          {
            option: 'A task in a Lakeflow Job',
            when: 'Batch runs on a schedule, and the check reads a table the rules already filtered.',
            tradeoffs:
              'Practical guidance: simple, with retries, a schedule, and a clear run history. You manage incremental logic yourself, so rescore only new or changed rows.',
          },
          {
            option: 'A step in a Lakeflow Declarative Pipeline',
            when: 'New rows arrive continuously and each should be scored once as it lands.',
            tradeoffs:
              'Practical guidance: a streaming table can score each row as it arrives, so each row is billed once. A full refresh or a recomputed materialized view would call the model again for rows already scored, so test how your pipeline refreshes before you rely on it (the AI Functions docs do not state how refreshes behave).',
          },
          {
            option: 'Ad hoc in a dashboard or notebook query',
            when: 'A one-off exploration on a few hundred rows.',
            tradeoffs:
              'Practical guidance: every run or refresh of the query is a new billed inference, so it is fine to explore and wrong for anything that reruns.',
          },
        ],
        recommendation:
          'A job task or a pipeline step that writes a table once. Explore ad hoc on a few hundred rows, then move the query into the pipeline.',
      },
      steps: [
        {
          title: 'Filter to the residue',
          body: 'Join the rule results and keep verdict = unknown. Drop NULL inputs, because a NULL input returns NULL and still costs a call. Cap pairs and rows per run while you tune.',
        },
        {
          title: 'Call once, store the raw response',
          body: 'Keep the response, the model or function version, and the error. Unpack fields from the stored response, so reporting never calls a model again.',
        },
        {
          title: 'Write to the quality table next to the rules',
          body: 'One row per record and check, with source, verdict, reason, and confidence. Review is a verdict of its own, so unreadable or low-confidence answers do not become passes.',
          code: `CREATE OR REPLACE TABLE quality.results AS
SELECT record_id, check_name, 'rule' AS source, verdict, reason, CAST(NULL AS DOUBLE) AS confidence
FROM quality.rule_results WHERE verdict <> 'unknown'
UNION ALL
SELECT record_id, check_name, 'ai', verdict, reason, confidence FROM quality.ai_results;`,
        },
        {
          title: 'Quarantine, then join back',
          body: 'Any record with a failed or review check goes to quarantine with its reasons. The accepted set is the source table with those records removed.',
          code: `CREATE OR REPLACE TABLE quality.quarantine AS
SELECT record_id,
       array_sort(collect_set(CASE WHEN verdict = 'fail' THEN check_name END)) AS failed_checks,
       array_sort(collect_set(CASE WHEN verdict = 'review' THEN check_name END)) AS review_checks
FROM quality.results GROUP BY record_id
HAVING max(CASE WHEN verdict IN ('fail', 'review') THEN 1 ELSE 0 END) = 1;

CREATE OR REPLACE TABLE quality.records_accepted AS
SELECT r.* FROM raw.records r LEFT ANTI JOIN quality.quarantine q ON q.record_id = r.record_id;`,
        },
      ],
    },
    {
      id: 'accuracy',
      heading: 'Accuracy: measure each check',
      prose:
        'An AI check is a classifier. Score it like one. Label a sample of the rows that reach the model, run the check, and compute precision and recall with fail as the positive class. Precision is the share of fail verdicts that were real problems. Recall is the share of real problems the check caught.',
      options: {
        caption: 'What to do with an uncertain verdict',
        rows: [
          {
            option: 'Accept it',
            when: 'A wrong pass costs little and a human review costs more than the error.',
            tradeoffs:
              'Practical guidance: highest throughput, and the errors land downstream. Fits low-stakes checks with high measured precision and recall.',
          },
          {
            option: 'Send it to review',
            when: 'A missed problem or a wrong block both hurt, and the middle band is small.',
            tradeoffs:
              'Practical guidance: protects quality and costs people time. If more than a quarter of rows land in review, the model is not doing the work, so fix labels or the prompt first.',
          },
          {
            option: 'Fail it',
            when: 'Anything doubtful must not pass, such as sensitive data leaving a boundary.',
            tradeoffs:
              'Practical guidance: safe, with false fails that someone must clear. Pair it with a way for reviewers to release records.',
          },
        ],
        recommendation:
          'Review the middle band for checks where either error hurts, fail closed for sensitive data, and accept only where measured precision and recall clear your thresholds.',
      },
      points: [
        {
          strong: 'Label the residue, not the table.',
          text: 'The model only sees the rows rules left unknown, so score on those. A few hundred labelled rows per check give a rough number, and a low-prevalence problem needs more.',
        },
        {
          strong: 'Set thresholds before you look.',
          text: 'Write the minimum precision, recall, and the maximum share sent to review for each check, then compare. The reference job uses 0.8, 0.8, and 0.25 as examples, which are not recommendations.',
        },
        {
          strong: 'Score the rules too.',
          text: 'A rule that is wrong 5 percent of the time lowers the combined result more than a good model raises it.',
        },
        {
          strong: 'Rerun when anything moves.',
          text: 'A new prompt, label set, function version, or model changes the output. Task functions pick their own model and Databricks can upgrade it, so rerun the labelled sample when release notes mention a function you use.',
        },
        {
          strong: 'Sample production.',
          text: 'Review a small random slice of passes and fails every week, and track the share of review and error rows. A jump is the first sign of drift.',
        },
      ],
    },
    {
      id: 'cost',
      heading: 'Cost: what you pay for, and how to keep it down',
      prose:
        'AI Function usage has two parts. Your compute runs the query and is always billed. Most task functions also run inference on Databricks-managed serverless GPU infrastructure through Model Serving, which adds a charge. ai_classify and ai_extract usage is recorded in system.billing.usage under the AI_FUNCTIONS product. ai_similarity, ai_mask, ai_fix_grammar, ai_summarize, and similar functions are recorded under MODEL_SERVING with the BATCH_INFERENCE offering type. For ai_query, the docs do not say which product records it, so look at your own usage rows.',
      options: {
        caption: 'How to choose the model for ai_query checks',
        rows: [
          {
            option: 'Task function, no model choice',
            when: 'ai_classify, ai_extract, ai_similarity, or ai_mask covers the check.',
            tradeoffs:
              'Docs: Databricks picks and maintains the model. Practical guidance: least to manage, output can change on upgrade, and no model-size lever for cost.',
          },
          {
            option: 'ai_query on a batch-optimized model',
            when: 'The check needs a custom prompt or structured output, over a table.',
            tradeoffs:
              'Docs: for batch work Databricks recommends Databricks-hosted foundation models (names start with databricks-) over provisioned throughput endpoints. Practical guidance: pick the smallest model that clears your accuracy thresholds, because token price grows with model size.',
          },
          {
            option: 'Provisioned or external endpoint',
            when: 'You need a fine-tuned model, a throughput commitment, or a specific provider.',
            tradeoffs:
              'Docs: provisioned throughput and custom model endpoints run on their own serving compute and are billed that way, and they are not the recommended path for batch work. An external provider receives each row under its terms. Practical guidance: weigh the data transfer against the benefit.',
          },
        ],
        recommendation:
          'Task functions where one fits. For custom checks, the smallest batch-optimized model that clears the accuracy gate, named in one parameter.',
      },
      points: [
        {
          strong: 'Filter before the call.',
          text: 'Rules that settle rows, NULL filters, and blocking before similarity are the biggest levers, because cost follows the rows that reach the model.',
        },
        {
          strong: 'Submit the whole table in one query.',
          text: 'The docs recommend one query over the full dataset and not manual small batches. With ai_query, set failOnError to false so a few bad rows do not force a rerun of everything.',
        },
        {
          strong: 'Estimate from a sample.',
          text: 'Count rows and characters sent per check and divide tokens by a characters-per-token rule of thumb for a first estimate. The reference job uses 4 as an assumption, not a documented figure. Then read the real bill from system.billing.usage after a run.',
        },
        {
          strong: 'Billing lags.',
          text: 'Usage rows can arrive hours after the work. Measure the run, wait, and divide billed DBUs by rows sent for a cost per thousand rows.',
        },
        {
          strong: 'Check the current rates.',
          text: 'Batch inference is priced by the hour in DBUs per model on the Databricks pricing page, and AI Functions rates are not listed per call there. Use the GenAI cost calculator and your own measured usage, and check pricing for your cloud and tier.',
        },
      ],
      links: [
        {
          label: 'AI Functions overview',
          url: 'https://docs.databricks.com/aws/en/large-language-models/ai-functions',
          note: 'Billing, batch guidance, and usage records.',
        },
        {
          label: 'Foundation Model Serving pricing',
          url: 'https://www.databricks.com/product/pricing/foundation-model-serving',
        },
      ],
    },
    {
      id: 'governance',
      heading: 'Governance: data handling and model routing',
      prose:
        'A quality check reads the data you most want to protect. Decide where each check runs before it touches regulated rows.',
      points: [
        {
          strong: 'Task functions stay in the Geo.',
          text: 'AI Functions and Foundation Model APIs are Designated Services. Processing happens in the workspace Geo when the service is available there. If not, an admin may enable cross-Geo processing. The docs state data is not stored outside the workspace Geo either way.',
        },
        {
          strong: 'Partner-powered models are a separate setting.',
          text: 'The Designated Services page lists features powered by Azure AI Services, OpenAI on Databricks, and Anthropic on Databricks. The partner-powered AI features setting covers Genie, AI/BI visuals, AI-generated comments, and similar features, and its page does not list AI Functions. It defaults off on workspaces with the compliance security profile, and Databricks plans to remove it on November 1, 2026. Confirm with your account team whether it affects the functions you use.',
        },
        {
          strong: 'ai_query goes where the endpoint goes.',
          text: 'A Databricks-hosted endpoint keeps rows in Databricks. An external model endpoint sends each row to that provider. Mask or drop sensitive columns first, and record the provider in your data inventory.',
        },
        {
          strong: 'Control who can call what.',
          text: 'Everyone has EXECUTE on system.ai by default, and a metastore admin can revoke it and grant functions to groups. ai_query is governed by permissions on the endpoint. Function-level permissions are in Public Preview.',
        },
        {
          strong: 'Protect the output too.',
          text: 'The quality and quarantine tables can hold the text that failed. Store masked text where you can, and apply row filters and column masks to the rest. See row and column security.',
        },
        {
          strong: 'Check regional and compliance support.',
          text: 'Most batch-inference AI Functions are available in the Americas, Asia, Australia and New Zealand, Europe, and India, with exceptions for some versions in some regions. Confirm each function against your compliance standard before regulated data reaches it.',
        },
        {
          strong: 'Keep Beta and Preview in view.',
          text: 'ai_similarity, ai_mask, ai_fix_grammar, and the vector_search SQL function are Public Preview. ai_classify and ai_extract are generally available. Check the support level and terms before you depend on one.',
        },
      ],
      links: [
        {
          label: 'Designated Services and cross-Geo processing',
          url: 'https://docs.databricks.com/aws/en/resources/designated-services',
        },
        {
          label: 'AI Functions permissions',
          url: 'https://docs.databricks.com/aws/en/large-language-models/ai-functions-uc-permissions',
        },
        {
          label: 'Partner-powered AI features',
          url: 'https://docs.databricks.com/aws/en/databricks-ai/partner-powered',
        },
        {
          label: 'Compliance security profile',
          url: 'https://docs.databricks.com/aws/en/security/privacy/security-profile',
        },
      ],
    },
    {
      id: 'run',
      heading: 'Run it',
      prose:
        'The reference job runs the whole flow on 300 made-up order records with an answer key. It needs serverless notebook compute, the same as the AI Functions bundle, and no SQL warehouse. Check the setup in 00_start_here first: AI Functions in your region, the partner-powered setting if your account team says it applies, and an ai_query endpoint that serves batch calls.',
      steps: [
        {
          title: 'Messy sample',
          body: 'Writes aidq_records (inputs) and aidq_truth (answers) from a fixed seed. Safe to rerun, every table is replaced.',
        },
        {
          title: 'Rule checks',
          body: 'SQL rules return pass, fail, or unknown per record and check, and report how much is left for AI.',
        },
        {
          title: 'AI checks',
          body: 'ai_classify, ai_extract, ai_similarity, ai_mask, and ai_query run on the unknown rows only. Results go to aidq_quality_results, aidq_quarantine, and aidq_records_accepted.',
        },
        {
          title: 'Accuracy and cost',
          body: 'Precision and recall per check and source, threshold gates, a token estimate, and billed cost from system.billing.usage when it has landed.',
        },
      ],
    },
  ],
  related: [
    { slug: 'ai-functions', title: 'AI Functions in SQL' },
    { slug: 'data-validation-framework', title: 'Data validation framework' },
    { slug: 'data-observability', title: 'Lineage and drift detection' },
    { slug: 'row-column-security', title: 'Row and column security' },
    { slug: 'document-processing', title: 'Document processing pipelines and their cost' },
  ],
};
