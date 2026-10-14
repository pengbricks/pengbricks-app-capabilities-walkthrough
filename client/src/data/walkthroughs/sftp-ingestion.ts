import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'sftp-ingestion',
  area: 'Ingestion',
  title: 'SFTP file retrieval',
  intro:
    'A job stores SFTP credentials in a secret scope, connects with paramiko, copies the files it has not copied before into a volume, and a Lakeflow Declarative Pipeline ingests them with Auto Loader. The reference run reads the public test server test.rebex.net: 17 files, of which 2 are text and 15 are images.',
  shortVersion: [
    {
      title: 'Credentials stay in a secret scope.',
      body: 'The first task creates the scope capability-guides and writes sftp-username and sftp-password. Code reads them with dbutils.secrets.get.',
    },
    {
      title: 'The job copies, Auto Loader ingests.',
      body: 'paramiko lists the server and copies files to the volume. The pipeline reads from the volume, not from the server.',
    },
    {
      title: 'A transfer log decides what is new.',
      body: 'A file counts as new when its path, size, and modification time are not in sftp_transfer_log.',
    },
    {
      title: 'A second fetch copies nothing.',
      body: 'After ingestion, refetch_finds_nothing lists the same 17 files and copies 0. The task fails if it copies any.',
    },
    {
      title: 'A blocked server has a fallback.',
      body: 'If SFTP cannot connect, the same code runs against a folder in the volume and the run records the error.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'From server to table',
      prose:
        'Five tasks run in order. Each one leaves a table behind, so a failed run shows which step stopped.',
      diagram: {
        type: 'flow',
        title: 'The SFTP job',
        description:
          'setup_secrets creates the secret scope. fetch_files reads the credentials, connects to the SFTP server, copies new files to the landing volume, and writes sftp_transfer_log. The ingest_files task runs a Lakeflow Declarative Pipeline whose Auto Loader streaming tables read the volume: sftp_text_files and sftp_binary_files. refetch_finds_nothing runs the fetch again and fails if it copies a file. verify_tables compares copied and ingested file counts.',
        lanes: [
          { label: 'Lakeflow job tasks', fromRow: 0, toRow: 0 },
          { label: 'Data and credentials', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'secrets', label: 'setup_secrets', mono: true, col: 0, row: 0 },
          { id: 'fetch', label: 'fetch_files', mono: true, sub: 'paramiko copy', col: 1, row: 0, kind: 'highlight' },
          { id: 'ingest', label: 'ingest_files', mono: true, sub: 'pipeline update', col: 2, row: 0, kind: 'highlight' },
          { id: 'refetch', label: 'refetch_finds_nothing', mono: true, col: 3, row: 0 },
          { id: 'verify', label: 'verify_tables', mono: true, col: 4, row: 0 },
          { id: 'scope', label: 'Secret scope', sub: 'capability-guides', col: 0, row: 1, kind: 'store' },
          { id: 'server', label: 'SFTP server', sub: 'test.rebex.net', col: 1, row: 1, kind: 'surface' },
          { id: 'volume', label: 'Volume', sub: 'landing/sftp', col: 2, row: 1, kind: 'store' },
          { id: 'log', label: 'sftp_transfer_log', mono: true, col: 1, row: 2, kind: 'store' },
          { id: 'text', label: 'sftp_text_files', mono: true, sub: '2 rows', col: 2, row: 2, kind: 'store' },
          { id: 'bin', label: 'sftp_binary_files', mono: true, sub: '15 rows', col: 3, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'secrets', to: 'scope' },
          { from: 'secrets', to: 'fetch' },
          { from: 'scope', to: 'fetch', label: 'user, password' },
          { from: 'server', to: 'fetch' },
          { from: 'fetch', to: 'volume', label: 'copy' },
          { from: 'fetch', to: 'log' },
          { from: 'fetch', to: 'ingest' },
          { from: 'volume', to: 'text' },
          { from: 'volume', to: 'bin' },
          { from: 'ingest', to: 'refetch' },
          { from: 'refetch', to: 'verify' },
        ],
        legend: [
          { kind: 'highlight', label: 'Does the work' },
          { kind: 'store', label: 'Volume, scope, or table' },
          { kind: 'surface', label: 'External server' },
        ],
      },
    },
    {
      id: 'new-files',
      heading: 'How a file is judged new',
      prose:
        'The copy step compares each remote file with the transfer log before it downloads anything. Auto Loader then tracks the volume files in its own checkpoint, so a copied file is ingested once.',
      diagram: {
        type: 'flow',
        title: 'Deciding what to copy',
        description:
          'The job lists the remote tree recursively. For each file it looks for a log row with the same path, size, and modification time. A match skips the file. No match copies the file to the volume, checks the size, and adds a log row. Auto Loader reads only files it has not read before.',
        nodes: [
          { id: 'list', label: 'List remote tree', sub: 'recursive', col: 0, row: 0 },
          { id: 'seen', label: 'In transfer log?', sub: 'path, size, mtime', col: 1, row: 0, kind: 'gate' },
          { id: 'skip', label: 'Skip', col: 2, row: 0 },
          { id: 'copy', label: 'Copy to volume', sub: 'check size after', col: 1, row: 1, kind: 'highlight' },
          { id: 'logrow', label: 'sftp_transfer_log', mono: true, sub: 'add a row', col: 2, row: 1, kind: 'store' },
          { id: 'al', label: 'Auto Loader', sub: 'reads unread files', col: 3, row: 1, kind: 'highlight' },
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
    },
    {
      id: 'result',
      heading: 'What the run produced',
      prose: 'The two fetch tasks and the two tables, from the successful run.',
      diagram: {
        type: 'matrix',
        title: 'Files by step',
        description:
          'fetch_files saw 17 remote files and copied 17. refetch_finds_nothing saw the same 17 and copied 0. sftp_text_files holds 2 rows and sftp_binary_files holds 15 rows.',
        corner: 'Step ↓ · Count →',
        columns: ['Remote files', 'Copied', 'Rows ingested'],
        rows: [
          {
            label: 'fetch_files',
            sub: 'first copy',
            cells: [
              { state: 'own', text: '17' },
              { state: 'own', text: '17' },
              { state: 'none', text: '-' },
            ],
          },
          {
            label: 'ingest_files',
            sub: 'Auto Loader',
            cells: [
              { state: 'none', text: '-' },
              { state: 'none', text: '-' },
              { state: 'own', text: '2 text, 15 binary' },
            ],
          },
          {
            label: 'refetch_finds_nothing',
            sub: 'same server, same files',
            cells: [
              { state: 'own', text: '17' },
              { state: 'none', text: '0' },
              { state: 'none', text: '-' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Files counted' },
          { state: 'none', label: 'Zero or not applicable' },
        ],
      },
    },
    {
      id: 'limits',
      heading: 'Before you use this against a real server',
      points: [
        {
          strong: 'The scope is created by the job.',
          text: 'Secret scopes are not a bundle resource. Delete capability-guides with databricks secrets delete-scope when you are done.',
        },
        {
          strong: 'Key-based auth.',
          text: 'Store the private key as another secret in the same scope and pass it to paramiko.',
        },
        {
          strong: 'Rewritten files.',
          text: 'A server that rewrites a file in place with the same size and modification time is not detected as changed.',
        },
        {
          strong: 'Lakeflow Connect SFTP connector.',
          text: 'It is in Public Preview and replaces the copy step with a managed incremental pull.',
        },
      ],
    },
  ],
  related: [
    { slug: 'file-format-ingestion', title: 'File format ingestion' },
    { slug: 'multi-source-pipeline', title: 'Multi-source pipeline' },
  ],
};
