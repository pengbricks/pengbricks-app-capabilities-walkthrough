import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Which upload route should an analyst use?',
    answer:
      'Upload to a volume in Catalog Explorer for one-off analysis. Use Lakeflow Designer for a no-code user who wants to clean the file, and the Excel Add-in for someone who lives in Excel. Use Auto Loader once a file arrives on a schedule.',
    links: [
      {
        label: 'Work with files in Unity Catalog volumes',
        url: 'https://docs.databricks.com/aws/en/ingestion/file-upload/',
      },
      { label: 'Lakeflow Designer', url: 'https://docs.databricks.com/aws/en/designer/' },
    ],
  },
  {
    question: 'Are Lakeflow Designer and the Excel Add-in generally available?',
    answer:
      'Yes, both are generally available. Designer builders need a sandbox schema to write to. The Excel Add-in queries a SQL warehouse as the signed-in user, so grants apply, and a write-back target needs its own schema and grants.',
    links: [{ label: 'Databricks Excel Add-in', url: 'https://docs.databricks.com/aws/en/integrations/excel/' }],
  },
  {
    question: 'How do we keep uploads from mixing with production tables?',
    answer:
      'Use a dedicated volume or sandbox schema where users can write and everyone else cannot read by default. Grant READ VOLUME and WRITE VOLUME to a group, give each user a folder named from the login, and tag uploads with an owner and purpose so you can review and expire them.',
  },
  {
    question: 'Why pass an explicit schema to read_files?',
    answer:
      'Without one, types are inferred, so a stray text value can change a column type. A declared schema prevents that, and rows that do not fit land in _rescued_data.',
    links: [
      {
        label: 'read_files table-valued function',
        url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/read_files',
      },
    ],
  },
  {
    question: 'Why use a full outer join against the governed table?',
    answer:
      'It keeps keys that appear on only one side, so you can label each as matched, upload_only, or governed_only. A typo then shows up as a row to fix instead of a silent drop. Trim whitespace and match case on both keys before you join.',
  },
  {
    question: 'When should an uploaded file become a governed table?',
    answer:
      'When others depend on it. Query in place first, load to the sandbox when you reuse the data, and promote to a governed schema once it is a shared input with a named owner, a schema, and a refresh plan.',
  },
];
