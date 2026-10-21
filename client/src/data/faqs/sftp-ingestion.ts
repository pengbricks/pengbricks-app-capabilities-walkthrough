import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Is the SFTP connector generally available?',
    answer:
      'Databricks announced it in Public Preview, so confirm the current stage on the docs page before you rely on it in production.',
    links: [{ label: 'Ingest files from SFTP servers', url: 'https://docs.databricks.com/aws/en/ingestion/sftp' }],
  },
  {
    question: 'What compute and runtime does the connector need?',
    answer:
      'Compute on Databricks Runtime 17.3 or above. Pinning the connection by name with databricks.connection needs DBR 18.2 or above, and earlier versions match the connection by host and user.',
  },
  {
    question: 'Should I authenticate with a password or a private key?',
    answer:
      'Use a PEM private key, which Databricks recommends over a password. Use a non-root, read-only account whose home or chroot holds only the folders you ingest. If the connector rejects the key format, convert it to PEM.',
  },
  {
    question: 'What does the SFTP server need to allow?',
    answer:
      'The server must allow the IP addresses your compute connects from. Use a NAT gateway address for classic compute or a network connectivity configuration with stable IPs for serverless. The published serverless ranges are broader, so reserve them for tests.',
    links: [
      {
        label: 'Serverless network security',
        url: 'https://docs.databricks.com/aws/en/security/network/serverless-network-security/',
      },
    ],
  },
  {
    question: 'Can users read from the server without seeing the key?',
    answer:
      'Yes. Grant USE CONNECTION on the Unity Catalog connection to the people or service principals that read the server. They never see the key or password.',
  },
  {
    question: 'When should I use a copy job instead of the connector?',
    answer:
      'Only when the server needs a protocol feature the connector lacks, or it is reachable only from a host outside Databricks. You then own the copy code, a transfer log, change detection, and retries, and files are stored twice. If the partner can push to cloud storage, a managed transfer service is another option.',
    links: [
      {
        label: 'File connectors',
        url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/file-connectors-overview',
      },
    ],
  },
];
