import type { Faq } from './types.ts';

const UNIFORM = {
  label: 'Read Delta tables with Iceberg clients',
  url: 'https://docs.databricks.com/aws/en/delta/uniform',
};
const ICEBERG = {
  label: 'Access Databricks tables from Iceberg clients',
  url: 'https://docs.databricks.com/aws/en/external-access/iceberg',
};
const MANAGED = { label: 'Unity Catalog managed tables', url: 'https://docs.databricks.com/aws/en/tables/managed' };
const CLONE = { label: 'CLONE', url: 'https://docs.databricks.com/aws/en/sql/language-manual/delta-clone' };
const DV = { label: 'Deletion vectors', url: 'https://docs.databricks.com/aws/en/delta/deletion-vectors' };
const LINEAGE = {
  label: 'Data lineage',
  url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage',
};

export const faqs: Faq[] = [
  {
    question: 'Is my data locked in?',
    answer:
      'No for the files. Managed and external tables are stored as Delta Lake or Apache Iceberg in cloud storage, both open table formats with open-source readers. The lock-in sits around the data: ABAC policies, governed tags, lineage history, serving endpoints, AI/BI dashboards, Genie Agents, and Databricks Apps. Those need a rebuild or a rewrite on the target.',
    links: [MANAGED],
  },
  {
    kind: 'decision',
    question: 'Should outside engines read through the Iceberg REST catalog, OpenSharing, or the files?',
    answer:
      'Pick per consumer. Use the Iceberg REST catalog for engines you run that need live reads. Use OpenSharing for another organization or platform, since a share and recipient bound the access and it is read-only and revocable. Use direct files only for external tables where you accept owning the access control, because Unity Catalog grants do not apply to that path.',
    links: [ICEBERG, { label: 'OpenSharing', url: 'https://docs.databricks.com/aws/en/opensharing' }],
  },
  {
    kind: 'decision',
    question: 'Do I copy the data out or read it in place?',
    answer:
      'Read in place while both platforms run, because it avoids a second copy to reconcile. Copy when the exit date is fixed or you want files under your own control. Deep clone gives a complete, independent copy and can be rerun to catch up. CTAS suits a format change or a subset, but it drops history and table properties.',
    links: [CLONE],
  },
  {
    kind: 'tradeoff',
    question: 'What does deep clone cost compared with reading in place?',
    answer:
      'A deep clone holds a second full copy of the data until you retire the source, so you pay storage twice during the verification window, plus the read and any cloud egress to create it. Reading in place pays no copy cost but keeps Databricks in the read path and on the bill. The cloud provider sets egress rates, so multiply your inventory sizes by your own rate.',
    links: [CLONE],
  },
  {
    question: 'Which table features can break an outside reader?',
    answer:
      'The docs list deletion vectors, column mapping, and type widening as reader and writer features, so the reader must support them. Deletion vectors cannot be on while Iceberg reads are enabled on v2. OSS Delta supports deletion vectors from 2.3.0. You can purge them with REORG TABLE APPLY (PURGE) or drop the feature. Check the target engine release notes for the rest, since the Databricks docs give no engine matrix.',
    links: [DV, UNIFORM],
  },
  {
    kind: 'tradeoff',
    question: 'What do I give up by reading Delta tables as Iceberg?',
    answer:
      'Iceberg reads on a Delta table are read-only. They need column mapping, a Unity Catalog table, and writes from Databricks Runtime 14.3 LTS or above. They are not supported on materialized views or streaming tables, and legacy change data feed has no Iceberg equivalent. A managed Iceberg table allows outside writes, but external clients cannot run maintenance such as snapshot expiry.',
    links: [UNIFORM, ICEBERG],
  },
  {
    question: 'What governance metadata can I export?',
    answer:
      'Comments, grants, tags, row filters, and column masks are rows in information_schema, so you can export them to tables you keep. ABAC policies and governed tags do not carry over, so record the intent and rewrite it in the target. Lineage shows in Catalog Explorer for data captured after September 1, 2024, and the lineage system tables keep a rolling one-year window, so export those rows first.',
    links: [LINEAGE, { label: 'System tables', url: 'https://docs.databricks.com/aws/en/admin/system-tables/' }],
  },
  {
    kind: 'decision',
    question: 'Should I keep Unity Catalog OSS or move governance to another catalog?',
    answer:
      'Choose by what your engines already speak. Unity Catalog OSS is Apache 2.0 with an open API, the Iceberg REST catalog APIs, and credential vending, so it keeps the namespace and client paths the same. You run and secure the server, and it is a separate project from the Databricks product, so confirm each feature you rely on. A target catalog such as Glue or Horizon means less to run and a rewrite of grants and masks.',
    links: [{ label: 'Unity Catalog OSS', url: 'https://www.unitycatalog.io/' }],
  },
  {
    question: 'Do my pipelines run on open-source Spark?',
    answer:
      'Spark and SQL transformations do, apart from dbutils, widgets, and Databricks-only functions. Apache Spark Declarative Pipelines is open source, and Databricks says Lakeflow pipelines extend and interoperate with it. The docs do not list which Lakeflow features are Databricks-only, so run each pipeline on open-source Spark before you count on it.',
    links: [
      { label: 'Lakeflow Spark Declarative Pipelines', url: 'https://docs.databricks.com/aws/en/ldp/' },
      {
        label: 'Apache Spark Declarative Pipelines',
        url: 'https://spark.apache.org/docs/latest/declarative-pipelines-programming-guide.html',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'Should I exit in one cutover or by domain?',
    answer:
      'Phase by domain unless the estate is small or the contract date is fixed. A phased exit costs parallel-run months for storage and compute, but each domain is verified and can be reversed. A big-bang cutover is shorter and has no easy rollback. Move reads first, then writers, and keep a rollback until the verification window closes.',
  },
  {
    kind: 'decision',
    question: 'Which assets should I rebuild and which should I retire?',
    answer:
      'Rebuild AI/BI dashboards, Genie Agents, serving endpoints, and apps only if people still use them, since each is rebuilt one by one on the target. Keep the SQL, table comments, model artifacts, and app source to shorten that. Retire assets with no recent use, with an owner sign-off and a saved definition for audit.',
  },
];
