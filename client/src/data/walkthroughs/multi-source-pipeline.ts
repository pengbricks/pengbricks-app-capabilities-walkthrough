import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'multi-source-pipeline',
  area: 'Ingestion',
  title: 'Multi-source pipeline',
  intro:
    'Several systems describe the same business entity in different shapes. Conformance maps each system into one schema, tags every row with where it came from, and resolves duplicates across systems. This page covers the design: a staging table per source, append flows into one streaming table, per-source expectations, and entity resolution with survivorship.',
  businessValue: {
    summary:
      'When several systems describe the same customer or entity differently, this design produces one conformed table with traceable origins. Business teams get a single view without losing which system said what.',
    outcomes: [
      {
        title: 'One record per real-world entity',
        body: 'Entity resolution matches records across systems, so reports count a customer once. Exact key matches merge automatically, and fuzzy matches go through review.',
      },
      {
        title: 'Every value traces to its source',
        body: 'Each row carries source_system and source_id, and a crosswalk links the surviving record to its sources. Anyone can ask where a value came from.',
      },
      {
        title: 'Adding a system is low risk',
        body: 'Each source has its own staging table, append flow, and checkpoint. A new source adds a flow without reprocessing or touching the others.',
      },
      {
        title: 'Problems caught in the right place',
        body: 'Expectations on each staging table catch source quirks, and expectations on the conformed table enforce the shared contract.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Stage each source on its own.',
      body: 'One staging table per source keeps raw names, types, and quirks visible. A mapping mistake is then easy to trace, and a source can change without touching the others.',
    },
    {
      title: 'Tag every row with its source.',
      body: 'Add a source_system column and keep the source’s own key as source_id. The pair (source_system, source_id) is the natural key of the conformed table.',
    },
    {
      title: 'Append flows feed one streaming table.',
      body: 'Each source writes to the conformed streaming table through its own append flow with its own checkpoint. Adding a source adds a flow and does not reprocess the others.',
    },
    {
      title: 'Validate twice.',
      body: 'Put expectations for source quirks on each staging table, and expectations for the shared contract (required columns, allowed values) on the conformed table.',
    },
    {
      title: 'Resolve entities after conformance.',
      body: 'Match records across systems with deterministic keys first, then fuzzy matching. Choose a surviving value per field by explicit rules and keep a crosswalk to the source records.',
    },
  ],
  sections: [
    {
      id: 'graph',
      heading: 'The pipeline shape',
      prose:
        'Staging holds each source as it arrived, conformance maps to the shared schema, and resolution produces one record per real-world entity.',
      diagram: {
        type: 'flow',
        title: 'Sources to a resolved entity table',
        description:
          'Three sources feed three staging tables, each with its own expectations. Each staging table writes to one conformed streaming table through an append flow that sets source_system. Entity resolution reads the conformed table, matches records across sources, and writes a crosswalk table and a resolved entity table.',
        lanes: [
          { label: 'Sources', fromRow: 0, toRow: 0 },
          { label: 'Staging', fromRow: 1, toRow: 1 },
          { label: 'Conformed and resolved', fromRow: 2, toRow: 3 },
        ],
        nodes: [
          {
            id: 'db',
            label: 'Database',
            sub: 'CDC or extract',
            col: 0,
            row: 0,
            kind: 'surface',
            icon: 'database',
            domain: 'neutral',
            detail: 'A source database, read through CDC or an extract.',
          },
          {
            id: 'files',
            label: 'Files',
            sub: 'Auto Loader',
            col: 1,
            row: 0,
            kind: 'surface',
            icon: 'data-file',
            domain: 'neutral',
            detail: 'File source, read with Auto Loader.',
          },
          {
            id: 'api',
            label: 'API',
            sub: 'landed JSON',
            col: 2,
            row: 0,
            kind: 'surface',
            icon: 'network',
            domain: 'neutral',
            detail: 'API source whose JSON is landed first.',
          },
          {
            id: 'sdb',
            label: 'Staging: database',
            sub: 'source expectations',
            col: 0,
            row: 1,
            icon: 'gear-teal',
            domain: 'data',
            detail: 'Staging table that holds the database source as it arrived, with its own expectations.',
          },
          {
            id: 'sfiles',
            label: 'Staging: files',
            sub: 'source expectations',
            col: 1,
            row: 1,
            icon: 'gear-teal',
            domain: 'data',
            detail: 'Staging table that holds the file source as it arrived, with its own expectations.',
          },
          {
            id: 'sapi',
            label: 'Staging: API',
            sub: 'source expectations',
            col: 2,
            row: 1,
            icon: 'gear-teal',
            domain: 'data',
            detail: 'Staging table that holds the API source as it arrived, with its own expectations.',
          },
          {
            id: 'conf',
            label: 'Conformed table',
            sub: 'append flows',
            col: 1,
            row: 2,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'data',
            detail:
              'One streaming table that every source writes to through its own append flow. Each flow maps columns to the shared schema and sets source_system.',
          },
          {
            id: 'xwalk',
            label: 'Crosswalk',
            sub: 'source key to entity id',
            col: 0,
            row: 3,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail: 'Maps each source key to an entity ID, so every resolved record traces back to its source records.',
          },
          {
            id: 'ent',
            label: 'Resolved entities',
            sub: 'survivorship applied',
            col: 2,
            row: 3,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail: 'One record per real-world entity. A surviving value for each field is chosen by explicit rules.',
          },
        ],
        edges: [
          { from: 'db', to: 'sdb' },
          { from: 'files', to: 'sfiles' },
          { from: 'api', to: 'sapi' },
          { from: 'sdb', to: 'conf', label: 'flow' },
          { from: 'sfiles', to: 'conf', label: 'flow' },
          { from: 'sapi', to: 'conf', label: 'flow' },
          { from: 'conf', to: 'xwalk' },
          { from: 'conf', to: 'ent' },
        ],
        legend: [
          { kind: 'highlight', label: 'Shared schema, source_system on every row' },
          { kind: 'store', label: 'Output table' },
          { kind: 'surface', label: 'Source system' },
        ],
      },
    },
    {
      id: 'mapping',
      heading: 'Conform with append flows',
      prose:
        'Declare the conformed table once and give each source its own flow. Every flow maps its columns to the shared schema and sets source_system.',
      examples: [
        {
          label: 'One streaming table, one flow per source',
          language: 'sql',
          code: `CREATE OR REFRESH STREAMING TABLE customers_conformed (
  CONSTRAINT has_source EXPECT (source_system IS NOT NULL) ON VIOLATION FAIL UPDATE,
  CONSTRAINT has_key EXPECT (source_id IS NOT NULL) ON VIOLATION DROP ROW,
  CONSTRAINT valid_email EXPECT (email IS NULL OR email LIKE '%_@_%')
);

CREATE FLOW from_crm AS INSERT INTO customers_conformed BY NAME
SELECT 'crm' AS source_system, CAST(account_id AS STRING) AS source_id,
       account_name AS full_name, lower(email) AS email, city, country, opened_on AS created_date
FROM STREAM stg_crm_accounts;

CREATE FLOW from_web AS INSERT INTO customers_conformed BY NAME
SELECT 'web', CAST(id AS STRING), concat_ws(' ', firstName, lastName), lower(email),
       address.city, address.country, CAST(NULL AS DATE)
FROM STREAM stg_web_users;`,
          notes: [
            'BY NAME matches columns by name, so each flow can order its select list differently.',
            'Fill columns a source lacks with NULL of the right type instead of a made-up default.',
            'Append flows read streaming sources. For small batch sources, a materialized view with UNION ALL is simpler.',
          ],
        },
      ],
      options: {
        caption: 'How to combine sources into one table',
        rows: [
          {
            option: 'Append flows into one streaming table',
            when: 'Sources are streaming or incremental, and new sources arrive over time.',
            tradeoffs:
              'Each source gets its own flow and checkpoint, so you add a source without touching the others or reprocessing history. Reads only new rows, so cost follows data volume. It suits append-only inputs. Corrections to old rows need AUTO CDC.',
          },
          {
            option: 'Materialized view with UNION ALL',
            when: 'Sources are small batch tables and the combined result should always match them.',
            tradeoffs:
              'A single query is easy to read and review. Databricks refreshes it incrementally where it can and recomputes otherwise, so cost depends on the query and the data. Adding a source means editing one larger query.',
          },
          {
            option: 'View with UNION ALL',
            when: 'Sources are tiny, and the combined result must be live with no refresh to schedule.',
            tradeoffs:
              'Nothing is stored and it is always current. Every read recomputes the union and the mapping, so it slows down as sources grow, and downstream expectations do not run on a view.',
          },
        ],
        recommendation:
          'Use append flows for streaming or growing sources. Use a materialized view for small batch sources. Keep a plain view for tiny, always-live combinations only.',
      },
      links: [
        {
          label: 'Use append flows to write to a streaming table',
          url: 'https://docs.databricks.com/aws/en/ldp/flows',
        },
        { label: 'Materialized views', url: 'https://docs.databricks.com/aws/en/ldp/materialized-views' },
      ],
      points: [
        {
          strong: 'Own the contract.',
          text: 'Write the conformed schema down: column names, types, nullability, allowed values, and what NULL means. New sources conform to it, not the other way around.',
        },
        {
          strong: 'Keep source_id as text.',
          text: 'Cast keys to STRING so numeric, padded, and composite keys from different systems share one column.',
        },
        {
          strong: 'Record the origin.',
          text: 'Carry source_system, source_id, and a load time or source file. They support audit, lineage, and reprocessing.',
        },
      ],
    },
    {
      id: 'quality',
      heading: 'Expectations per source and for the contract',
      points: [
        {
          strong: 'On each staging table.',
          text: 'Check what is specific to that system: its date format, its status codes, its required fields. Drop or quarantine rows that break source rules here, so one source’s problems do not hide in the merged table.',
        },
        {
          strong: 'On the conformed table.',
          text: 'Check the shared contract: key not null, source_system in the known list, email shape. Use FAIL UPDATE for contract breaks that mean a mapping bug.',
        },
        {
          strong: 'Measure by source.',
          text: 'Group the pipeline event log or the conformed table by source_system to see which system produces the rejects and the nulls.',
        },
      ],
      links: [
        {
          label: 'Manage data quality with pipeline expectations',
          url: 'https://docs.databricks.com/aws/en/ldp/expectations',
        },
        {
          label: 'Use append flows to write to a streaming table',
          url: 'https://docs.databricks.com/aws/en/ldp/flows',
        },
      ],
    },
    {
      id: 'resolution',
      heading: 'Entity resolution and survivorship',
      prose:
        'Conformance gives one table of records. Resolution decides which of them are the same customer, and survivorship decides which value to show.',
      steps: [
        {
          title: 'Match on deterministic keys first',
          body: 'Normalize a key, such as lower-cased email or a tax ID, and group on it. Exact matches are safe to merge automatically.',
        },
        {
          title: 'Add fuzzy matching with review',
          body: 'For names and addresses, score candidate pairs with edit distance or ai_similarity, merge above a high threshold, and send the middle band to a review table.',
        },
        {
          title: 'Assign an entity id and keep a crosswalk',
          body: 'Write (entity_id, source_system, source_id) rows. The crosswalk lets you trace any resolved value back to its source records and undo a wrong merge.',
        },
        {
          title: 'Apply survivorship rules per field',
          body: 'Choose the value by explicit rule: source priority, most recent, or most complete. Rank the candidates and take the first.',
          code: `SELECT entity_id,
       max_by(email, struct(source_rank, updated_at)) AS email,
       max_by(full_name, struct(source_rank, updated_at)) AS full_name
FROM customers_matched
GROUP BY entity_id;`,
        },
      ],
      options: {
        caption: 'How to decide two records are the same entity',
        rows: [
          {
            option: 'Exact match on a normalized key',
            when: 'A reliable identifier exists in every source, such as a tax ID or a lower-cased email.',
            tradeoffs:
              'Cheap, fast, and explainable, and safe to merge automatically. It misses records that differ by typos or formatting, so match rates depend on key quality.',
          },
          {
            option: 'Edit distance on names and addresses',
            when: 'Identifiers are missing or unreliable, and candidate pairs can be narrowed first by a blocking key such as postal code.',
            tradeoffs:
              'Catches typos and spacing, using built-in functions such as levenshtein at no model cost. Comparing all pairs does not scale, so block first. Thresholds need tuning, and the uncertain middle band needs human review.',
          },
          {
            option: 'ai_similarity scoring',
            when: 'Records differ in wording, such as abbreviations or reordered words, and edit distance gives poor scores.',
            tradeoffs:
              'Scores meaning as well as spelling. It is in Public Preview and tuned for English. Each comparison calls a model, so it adds cost and latency, and the scores are harder to explain to a reviewer. Apply it only to candidate pairs.',
          },
        ],
        recommendation:
          'Match exactly on keys first and merge those automatically. Add edit distance on blocked candidates for the rest, and use ai_similarity only on pairs that edit distance cannot settle. Send the middle band to review and keep a crosswalk.',
      },
      links: [
        {
          label: 'levenshtein function',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/levenshtein',
        },
        {
          label: 'ai_similarity function',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_similarity',
        },
      ],
    },
  ],
  related: [
    { slug: 'relational-db-ingestion', title: 'Relational database extracts' },
    { slug: 'file-format-ingestion', title: 'File format ingestion' },
    { slug: 'rest-api-ingestion', title: 'Authenticated REST API ingestion' },
    { slug: 'medallion-architecture', title: 'Medallion architecture' },
  ],
};
