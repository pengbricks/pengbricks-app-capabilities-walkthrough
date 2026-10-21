import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Which schema changes break existing readers?',
    answer:
      'Renaming or dropping a column, narrowing a type, and changing what a value means all break readers that select columns by name. Adding a nullable column and widening a type (for example int to bigint) do not. Tightening nullability and adding a NOT NULL column also break writers.',
    links: [{ label: 'Delta type widening', url: 'https://docs.databricks.com/aws/en/tables/features/type-widening' }],
  },
  {
    question: 'Can I rename or drop a column without rewriting the table?',
    answer:
      'Yes, with column mapping. A rename or drop becomes a metadata-only change. Column mapping raises the minimum reader and writer protocol versions and can break streaming readers, so confirm every reader and sharing recipient supports it first.',
    links: [
      {
        label: 'Rename and drop columns with column mapping',
        url: 'https://docs.databricks.com/aws/en/tables/features/column-mapping',
      },
    ],
  },
  {
    question: 'How should Auto Loader handle new columns in bronze?',
    answer:
      'Use rescue for bronze tables that feed a reviewed gold layer, so the schema stays put and new fields land in _rescued_data. Use addNewColumns where the producer adds fields often and a job restarts the stream, since the stream fails once after adding the columns. Use none only with a rescued data column set, or values can disappear without a signal.',
    links: [
      {
        label: 'Auto Loader schema evolution',
        url: 'https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/schema',
      },
    ],
  },
  {
    question: 'Should I use table constraints or pipeline expectations to reject bad rows?',
    answer:
      'Use constraints on gold tables, and expectations in ingestion pipelines with quarantine where bad rows need review. A constraint violation fails the whole transaction, while an expectation can drop rows, fail the update, or warn. The default expectation action, warn, keeps invalid rows in the target.',
    links: [
      {
        label: 'Manage data quality with pipeline expectations',
        url: 'https://docs.databricks.com/aws/en/ldp/expectations',
      },
    ],
  },
  {
    question: 'How do I find who still reads a table before I retire it?',
    answer:
      'Query system.access.table_lineage for the jobs, notebooks, dashboards, and downstream tables that read the object. Add system.query.history to catch ad hoc SQL warehouse readers that lineage does not attribute to a person. Tag the object as deprecated first, then notify owners and re-run the lineage query before the sunset date.',
    links: [
      {
        label: 'Lineage system tables',
        url: 'https://docs.databricks.com/aws/en/admin/system-tables/lineage',
      },
    ],
  },
  {
    question: 'What should I share with outside recipients, the table or a view?',
    answer:
      'Share a stable view, so you can change the table under it. Recipients outside your workspace do not show up in your lineage. Features such as column mapping and type widening raise reader requirements, so check that each recipient client supports them before you enable them on a shared table.',
    links: [{ label: 'OpenSharing', url: 'https://docs.databricks.com/aws/en/opensharing' }],
  },
];
