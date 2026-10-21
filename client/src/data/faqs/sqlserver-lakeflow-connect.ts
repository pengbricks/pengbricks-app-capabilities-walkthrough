import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Why does the gateway need classic compute?',
    answer:
      'The gateway runs on classic compute in your workspace network, and a workspace that allows only serverless compute rejects it. Allow classic compute for the gateway. The ingestion pipeline stays serverless. An integrated CDC pipeline avoids the gateway if your workspace has it.',
    links: [
      {
        label: 'SQL Server connector overview',
        url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sql-server-overview',
      },
    ],
  },
  {
    question: 'Change Tracking or CDC for a given table?',
    answer:
      'Use Change Tracking for keyed tables that only need the latest row (SCD type 1). Use CDC for tables that need history (SCD type 2) or have no primary key. Do not enable both on one table, because the connector then uses Change Tracking.',
    links: [
      {
        label: 'Prepare SQL Server for ingestion',
        url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sql-server-source-setup',
      },
      {
        label: 'History tracking (SCD type 2)',
        url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/scd',
      },
    ],
  },
  {
    question: 'Can it read from a replica, and does SQL Server need to be on the internet?',
    answer:
      'No to both. Connect to the primary, or to the listener on an Always On Availability Group. Only the gateway connects, from the workspace network, over VNet or VPC peering, ExpressRoute, Direct Connect, VPN, a private endpoint, or a firewall rule on a public endpoint.',
    links: [
      {
        label: 'SQL Server connector FAQ',
        url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sql-server-faq',
      },
    ],
  },
  {
    question: 'What happens if the gateway goes down?',
    answer:
      'It resumes where it stopped, as long as SQL Server still holds the changes. If it is down longer than the CDC or Change Tracking retention, the affected tables need a full refresh. Do not stop the gateway to save cost in production.',
  },
  {
    question: 'What does a full refresh do to history tables?',
    answer:
      'A full refresh of an SCD type 2 table replaces it and restarts its history from the refresh point. Keep auto full refresh off on history tables, and refresh one table at a time with full_refresh_selection. Renames and type changes also need a full refresh of that table.',
  },
  {
    question: 'What does it cost, and how many tables can one pipeline carry?',
    answer:
      'DBUs only, with no per-row fee. The gateway bills classic compute around the clock, and the serverless ingestion pipeline bills per run. A pipeline takes up to 250 tables, with one gateway per ingestion pipeline, so split larger databases across pipelines.',
    links: [
      {
        label: 'Monitor ingestion costs',
        url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/monitor-costs',
      },
    ],
  },
];
