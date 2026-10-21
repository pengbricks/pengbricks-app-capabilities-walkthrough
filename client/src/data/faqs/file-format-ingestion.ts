import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'When should I use read_files and when the cloudFiles reader in Python?',
    answer:
      'Use read_files with STREAM in SQL for pipelines and simple streaming tables, since it runs on Auto Loader and keeps a checkpoint. Use the cloudFiles reader in Python when you need foreachBatch, custom post-processing, or options read_files does not expose. Without STREAM, read_files is a one-time batch read.',
    links: [
      {
        label: 'read_files table-valued function',
        url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/read_files',
      },
    ],
  },
  {
    question: 'How does Auto Loader find new files cheaply?',
    answer:
      'Enable file events on the Unity Catalog external location. Auto Loader then learns of new files from storage events instead of listing the directory, which the docs describe as more performant and scalable and recommend for most workloads. Directory listing still works for small folders. File notification mode without file events is not supported for Unity Catalog volumes.',
    links: [
      {
        label: 'Auto Loader file events',
        url: 'https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/file-events-explained',
      },
    ],
  },
  {
    question: 'What happens when a partner adds a column or sends a value that does not fit?',
    answer:
      'It depends on schemaEvolutionMode. addNewColumns stops the update once and adds the column, rescue keeps the stream running and parks the data as JSON in _rescued_data, and failOnNewColumns fails until someone reviews it. Use rescue for partner files where the stream must not stop, and monitor _rescued_data.',
    links: [
      {
        label: 'Configure schema inference and evolution in Auto Loader',
        url: 'https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/schema',
      },
    ],
  },
  {
    question: 'Why does Excel behave differently from the other formats?',
    answer:
      'The Excel reader does not evolve or rescue, so schemaEvolutionMode must be none. Rely on schemaHints and a row-count check instead. Pick the sheet with dataAddress, such as Orders or Orders!A1:G1001. A single cell like Orders!A1 is read as a sheet name and fails.',
  },
  {
    question: 'Should I load JSON as a Variant?',
    answer:
      'Yes when the shape changes often. Land it as a VARIANT column with parse_json, so new keys and type changes do not break the load. Then promote stable fields to typed columns in silver.',
    links: [{ label: 'Query variant data', url: 'https://docs.databricks.com/aws/en/semi-structured/variant' }],
  },
  {
    question: 'Do I need to set a checkpoint or schema location?',
    answer:
      'Not in a pipeline. Each Auto Loader streaming table keeps its own checkpoint and inferred schema in storage the pipeline manages. Outside a pipeline, set cloudFiles.schemaLocation and checkpointLocation yourself. A full refresh clears that state and re-reads all files, so protect tables whose source files expire.',
  },
];
