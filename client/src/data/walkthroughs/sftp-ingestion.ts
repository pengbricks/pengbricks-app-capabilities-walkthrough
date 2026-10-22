import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'sftp-ingestion',
  area: 'Ingestion',
  title: 'SFTP file retrieval',
  intro:
    'Use the Lakeflow Connect SFTP connector: a Unity Catalog connection stores the credentials, and Auto Loader reads files straight from the server incrementally. Fall back to a copy job only when the server needs something the connector does not support. This page covers the connector setup, key-based authentication, the network path, and the fallback.',
  businessValue: {
    summary:
      'Partners that still deliver files over SFTP can feed Databricks directly, with credentials held in Unity Catalog. Data teams drop the copy scripts and the servers that ran them.',
    outcomes: [
      {
        title: 'No copy job to operate',
        body: 'The connector reads files from the SFTP server and Auto Loader ingests each once. There is no transfer job or transfer log to own, unless you need the fallback.',
      },
      {
        title: 'Users never see the key',
        body: 'Granting USE CONNECTION lets people and service principals read from the server without seeing the key or password.',
      },
      {
        title: 'Least privilege by default',
        body: 'A PEM private key on a read-only account limited to the ingested directories narrows what a compromised credential can reach.',
      },
      {
        title: 'Reruns skip finished files',
        body: 'Auto Loader keeps a checkpoint, so a rerun reads only files it has not seen. A partner resending a day late does not trigger a reload of old data.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Read from SFTP with a connection and Auto Loader.',
      body: 'Create a Unity Catalog connection of type SFTP, then point Auto Loader at an sftp:// path with the databricks.connection option. It tracks files incrementally and ingests each once.',
    },
    {
      title: 'Prefer a PEM private key.',
      body: 'The connection supports a PEM private key (recommended) or a password. Use a read-only account limited to the directories you ingest.',
    },
    {
      title: 'Open the network path first.',
      body: 'The SFTP server must allow the IP addresses your compute connects from: a stable NAT address for classic compute, or the serverless outbound addresses through network connectivity configuration.',
    },
    {
      title: 'Govern with Unity Catalog.',
      body: 'Grant USE CONNECTION to the people or service principals that read the server. They never see the key or password.',
    },
    {
      title: 'Copy-then-ingest is the fallback.',
      body: 'If the server needs behavior the connector lacks, run a job that copies new files to a volume and let Auto Loader ingest the volume. You then own the transfer log.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'The recommended path',
      prose:
        'No copy step is needed. The connection holds the credentials, and the streaming table reads the remote path. Auto Loader keeps a checkpoint, so a rerun reads only files it has not seen.',
      diagram: {
        type: 'flow',
        title: 'SFTP connector to Delta',
        description:
          'A Unity Catalog connection stores the SFTP host, user, and PEM private key. A Lakeflow pipeline or job uses Auto Loader with the connection to read files from the SFTP server. Auto Loader tracks which files it has read and writes new rows to a streaming table. Compute reaches the server through a stable IP address that the server allows.',
        lanes: [
          { label: 'Unity Catalog', fromRow: 0, toRow: 0 },
          { label: 'Compute', fromRow: 1, toRow: 1 },
          { label: 'Outside', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          {
            id: 'conn',
            label: 'SFTP connection',
            sub: 'host, user, PEM key',
            col: 0,
            row: 0,
            kind: 'store',
            icon: 'id-provider',
            domain: 'governance',
            detail: 'A Unity Catalog connection that stores the SFTP host, user, and PEM private key.',
          },
          {
            id: 'table',
            label: 'Streaming table',
            sub: 'Delta, with checkpoint',
            col: 2,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail: 'A Delta streaming table. Auto Loader writes new rows here and keeps a checkpoint.',
          },
          {
            id: 'al',
            label: 'Auto Loader',
            sub: 'databricks.connection',
            col: 1,
            row: 1,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'data',
            detail:
              'Auto Loader reads files from the SFTP server through the connection and tracks which files it has read.',
          },
          {
            id: 'net',
            label: 'Stable egress IP',
            sub: 'NAT or serverless NCC',
            col: 2,
            row: 1,
            icon: 'cloud-network',
            domain: 'neutral',
            detail: 'A stable IP address for compute, from a NAT or a serverless NCC, that the server can allow.',
          },
          {
            id: 'server',
            label: 'SFTP server',
            sub: 'allow-lists the IP',
            col: 2,
            row: 2,
            kind: 'surface',
            icon: 'data-file',
            domain: 'neutral',
            detail: 'The external SFTP server. It allow-lists the egress IP.',
          },
        ],
        edges: [
          { from: 'conn', to: 'al', label: 'credentials' },
          { from: 'al', to: 'net' },
          { from: 'net', to: 'server' },
          { from: 'al', to: 'table' },
        ],
        legend: [
          { kind: 'highlight', label: 'Reads incrementally' },
          { kind: 'store', label: 'Unity Catalog object' },
          { kind: 'surface', label: 'External server' },
        ],
      },
      examples: [
        {
          label: 'Create the connection and ingest',
          language: 'sql',
          code: `-- One-time, by a user with CREATE CONNECTION
-- Create the connection in Catalog Explorer (type SFTP, auth type PEM Private Key),
-- or with SQL; then grant it:
GRANT USE CONNECTION ON CONNECTION partner_sftp TO \`ingest-sp\`;

-- In a pipeline
CREATE OR REFRESH STREAMING TABLE partner_files AS
SELECT *, _metadata.file_path AS source_file
FROM STREAM read_files(
  'sftp://partner.example.com:22/outbound/invoices/',
  format => 'csv',
  \`databricks.connection\` => 'partner_sftp',
  header => true
);`,
          notes: [
            'The connector needs compute on Databricks Runtime 17.3 or above. Pinning the connection by name with databricks.connection needs DBR 18.2 or above; earlier versions match the connection by host and user.',
            'Wildcards in the path select subsets of files. Auto Loader handles JSON, CSV, XML, Parquet, Avro, text, binary, and ORC.',
          ],
        },
      ],
      options: {
        caption: 'How files get from the SFTP server into Delta',
        rows: [
          {
            option: 'SFTP connector with Auto Loader',
            when: 'Databricks compute can reach the server and the connector supports its authentication and protocol features.',
            tradeoffs:
              'No copy job and no transfer log to operate, and credentials stay in a Unity Catalog connection. The server must allow-list your compute addresses, the connector needs a recent Databricks Runtime, and it was announced in Public Preview, so confirm the current stage.',
          },
          {
            option: 'Copy job to a volume, then Auto Loader',
            when: 'The server needs a protocol feature the connector lacks, or it is reachable only from a host outside Databricks.',
            tradeoffs:
              'Works with almost any server and gives you full control over what is copied. You maintain the copy code, a transfer log, change detection, and retries, and you store the files twice (volume and table).',
          },
          {
            option: 'A cloud transfer service that delivers files to object storage',
            when: 'The partner can push to a cloud storage location, or your team already runs a managed file-transfer service.',
            tradeoffs:
              'The transfer service handles protocol and access, and Databricks reads from storage with Auto Loader and file events. It adds a service to pay for and administer, outside Databricks governance until the files land.',
          },
        ],
        recommendation:
          'Use the SFTP connector when the server is reachable and you can allow-list compute addresses. Use a copy job only when the connector cannot work, and a managed transfer service when the partner can deliver to cloud storage.',
      },
      links: [
        { label: 'Ingest files from SFTP servers', url: 'https://docs.databricks.com/aws/en/ingestion/sftp' },
        {
          label: 'File connectors',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/file-connectors-overview',
        },
      ],
    },
    {
      id: 'auth',
      heading: 'Authentication and network access',
      points: [
        {
          strong: 'Private-key authentication.',
          text: 'Create the connection with auth type PEM Private Key, paste the key (and passphrase if the key has one), and leave host key fingerprint enforcement on. Databricks recommends the key over a password. If the connector rejects the key format, convert it to PEM.',
        },
        {
          strong: 'Least privilege on the server.',
          text: 'Use a non-root, read-only user whose home or chroot holds only the folders you ingest.',
        },
        {
          strong: 'Allow-list classic compute.',
          text: 'Give classic compute a stable public address through a NAT gateway or equivalent, and add that address to the server’s allow list. The server must also be reachable from the VPC your workspace uses.',
        },
        {
          strong: 'Allow-list serverless compute.',
          text: 'Get the outbound addresses for serverless from the serverless compute firewall configuration, or use a network connectivity configuration with stable IPs, and allow them on the server.',
        },
        {
          strong: 'Check the release stage.',
          text: 'Databricks announced the SFTP connector in Public Preview. Confirm its current stage on the docs page before you rely on it in production.',
        },
      ],
      options: {
        caption: 'How the server sees your compute',
        rows: [
          {
            option: 'Classic compute behind a NAT gateway',
            when: 'The workload already runs on classic compute in your VPC.',
            tradeoffs:
              'One stable public address that you own, and the server allow-list is narrow. You run the network path and the classic compute, and the server must also be reachable from that VPC.',
          },
          {
            option: 'Serverless with a network connectivity configuration (stable IPs)',
            when: 'Pipelines run on serverless compute and the server owner wants a fixed address list.',
            tradeoffs:
              'Databricks manages the compute while the addresses stay stable and specific to your account. Setup is an account-level configuration, usually done by an admin.',
          },
          {
            option: 'Allow-list the published serverless address ranges',
            when: 'A quick test, or a server that can accept broad ranges.',
            tradeoffs:
              'No network configuration to build. The ranges are broader than a dedicated address, so the allow-list is less specific, and the server owner must keep it current.',
          },
        ],
        recommendation:
          'Use a stable address in production: a NAT gateway for classic compute or a network connectivity configuration for serverless. Reserve the broad serverless ranges for tests.',
      },
      links: [
        {
          label: 'Serverless network security',
          url: 'https://docs.databricks.com/aws/en/security/network/serverless-network-security/',
        },
      ],
    },
    {
      id: 'new-files',
      heading: 'Fallback: copy to a volume, then ingest',
      prose:
        'Use this only when the connector does not fit, for example a server that requires a protocol feature it lacks, or one reachable only from a host outside Databricks. A job lists the remote tree, copies files it has not copied, and Auto Loader ingests the volume.',
      diagram: {
        type: 'flow',
        title: 'Deciding what to copy',
        description:
          'The job lists the remote tree recursively. For each file it looks for a log row with the same path, size, and modification time. A match skips the file. No match copies the file to the volume, checks the size, and adds a log row. Auto Loader reads only files it has not read before.',
        nodes: [
          {
            id: 'list',
            label: 'List remote tree',
            sub: 'recursive',
            col: 0,
            row: 0,
            icon: 'data-file',
            domain: 'data',
            detail: 'The job lists the remote tree recursively.',
          },
          {
            id: 'seen',
            label: 'In transfer log?',
            sub: 'path, size, mtime',
            col: 1,
            row: 0,
            kind: 'gate',
            domain: 'data',
            detail: 'Looks for a log row with the same path, size, and modification time. A match skips the file.',
          },
          {
            id: 'skip',
            label: 'Skip',
            col: 2,
            row: 0,
            domain: 'neutral',
            detail: 'The file is already in the log, so it is not copied again.',
          },
          {
            id: 'copy',
            label: 'Copy to volume',
            sub: 'check size after',
            col: 1,
            row: 1,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'data',
            detail: 'Copies the file to the volume and checks the size afterward.',
          },
          {
            id: 'logrow',
            label: 'Transfer log',
            sub: 'add a row',
            col: 2,
            row: 1,
            kind: 'store',
            icon: 'list',
            domain: 'data',
            detail: 'The transfer log. A row is added after each copy, so later runs can skip the file.',
          },
          {
            id: 'al',
            label: 'Auto Loader',
            sub: 'reads unread files',
            col: 3,
            row: 1,
            kind: 'highlight',
            icon: 'gear-teal',
            domain: 'data',
            detail: 'Reads only the files it has not read before.',
          },
        ],
        edges: [
          { from: 'list', to: 'seen' },
          { from: 'seen', to: 'skip', label: 'yes' },
          { from: 'seen', to: 'copy', label: 'no' },
          { from: 'copy', to: 'logrow' },
          { from: 'copy', to: 'al' },
        ],
        legend: [
          { kind: 'gate', label: 'Decision' },
          { kind: 'highlight', label: 'Action' },
          { kind: 'store', label: 'Delta table' },
        ],
      },
      points: [
        {
          strong: 'Credentials.',
          text: 'Keep the username, password, or private key in a secret scope and read them with dbutils.secrets.get. Use key-based authentication, and give only the job’s service principal access to the scope.',
        },
        {
          strong: 'Copy to a volume, not DBFS.',
          text: 'Land files in a Unity Catalog volume. Check the size after each copy and write the transfer log only after the copy succeeds.',
        },
        {
          strong: 'Change detection.',
          text: 'A file is new by path, size, and modification time. A server that rewrites a file in place with identical size and time is not detected as changed. Add a checksum if that matters.',
        },
        {
          strong: 'Prove idempotence.',
          text: 'Rerunning the fetch after ingestion should copy nothing. Make that a check that fails the job.',
        },
      ],
    },
  ],
  related: [
    { slug: 'file-format-ingestion', title: 'File format ingestion' },
    { slug: 'multi-source-pipeline', title: 'Multi-source pipeline' },
    { slug: 'batch-real-time-ingestion', title: 'Batch and streaming ingestion' },
  ],
};
