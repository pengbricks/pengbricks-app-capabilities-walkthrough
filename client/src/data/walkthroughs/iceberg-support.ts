import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'iceberg-support',
  area: 'General Guides',
  title: 'Apache Iceberg interoperability',
  intro:
    'The Databricks answer to Iceberg interoperability has three parts: managed Iceberg tables in Unity Catalog, the Unity Catalog Iceberg REST catalog for external engines, and credential vending so those engines never hold storage keys. You govern the table once in Unity Catalog, write it from Databricks or from an external Iceberg engine, and read it from Spark, Trino, Flink, PyIceberg, or Snowflake. This page covers which table type to use, how to expose it, and how to connect an outside client safely.',
  businessValue: {
    summary:
      'Databricks governs one Iceberg table in Unity Catalog and lets other engines read or write it. Teams that run Snowflake, Trino, or Flink next to Databricks avoid duplicate copies and separate access rules.',
    outcomes: [
      {
        title: 'One governed copy',
        body: 'Unity Catalog manages the table once, whether Spark, Trino, Flink, PyIceberg, or Snowflake reads it. There is no duplicate dataset or second set of permissions.',
      },
      {
        title: 'No storage keys outside',
        body: 'Credential vending gives external engines short-lived storage credentials scoped to the principal, so partners and other platforms never hold long-lived keys.',
      },
      {
        title: 'Format follows who owns it',
        body: 'Pick managed Iceberg, a Delta table with Iceberg reads, or a foreign Iceberg table by who owns the format. Teams avoid a forced conversion.',
      },
      {
        title: 'Share to Iceberg clients',
        body: 'OpenSharing for managed and foreign Iceberg tables is generally available, including to recipients that use Iceberg clients.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Managed Iceberg + REST catalog + credential vending.',
      body: 'Create a managed Iceberg table with USING ICEBERG. External engines connect to the Unity Catalog Iceberg REST catalog, and Unity Catalog vends short-lived storage credentials scoped to the principal.',
    },
    {
      title: 'Pick the table type by who owns the format.',
      body: 'Managed Iceberg when Iceberg is the contract. A Delta table with Iceberg reads when Databricks is the writer and Iceberg clients only read. A foreign Iceberg table when another catalog owns the table.',
    },
    {
      title: 'Iceberg v3 is generally available.',
      body: 'Managed tables can use v3 features: deletion vectors, VARIANT, row lineage, geospatial types, and write defaults. Requires Databricks Runtime 18 LTS or above.',
    },
    {
      title: 'Outside clients use a service principal with OAuth M2M.',
      body: 'Create a service principal, give it an OAuth secret, and grant it SELECT and EXTERNAL USE SCHEMA. Use a personal access token only as a fallback.',
    },
    {
      title: 'Share Iceberg through OpenSharing.',
      body: 'Sharing managed Iceberg tables, and foreign Iceberg tables, is generally available, including to recipients that use Iceberg clients.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'Write in Databricks, read anywhere',
      prose:
        'Unity Catalog is the single catalog. Databricks compute and external engines reach the same managed table, and Unity Catalog keeps snapshot expiration, compaction, and metadata current. Predictive optimization maintains managed Iceberg tables, and liquid clustering is available for them as a Public Preview.',
      diagram: {
        type: 'flow',
        title: 'One governed Iceberg table, many engines',
        description:
          'A managed Iceberg table lives in Unity Catalog and is written from Databricks SQL or Spark. External engines such as PyIceberg, Trino, Flink, and open-source Spark connect to the Unity Catalog Iceberg REST catalog with an OAuth token. The catalog returns table metadata and vended, short-lived storage credentials. The engines read the data files from cloud storage directly.',
        lanes: [
          { label: 'Databricks', fromRow: 0, toRow: 0 },
          { label: 'External Iceberg engines', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          {
            id: 'create',
            label: 'CREATE ... ICEBERG',
            sub: 'managed table',
            col: 0,
            row: 0,
            icon: 'gear-data',
            domain: 'data',
            detail: 'Create the table from Databricks SQL or Spark with CREATE ... ICEBERG.',
          },
          {
            id: 'table',
            label: 'Managed Iceberg table',
            sub: 'Unity Catalog',
            col: 1,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'governance',
            detail: 'A managed Iceberg table that lives in Unity Catalog.',
          },
          {
            id: 'opt',
            label: 'Predictive optimization',
            sub: 'compaction, expiry',
            col: 2,
            row: 0,
            icon: 'gear-teal',
            domain: 'data',
            detail: 'Predictive optimization handles compaction and snapshot expiry for the table.',
          },
          {
            id: 'client',
            label: 'Iceberg client',
            sub: 'OAuth bearer token',
            col: 0,
            row: 1,
            kind: 'highlight',
            icon: 'users',
            domain: 'neutral',
            detail:
              'An external engine such as PyIceberg, Trino, Flink, or open-source Spark. It authenticates with an OAuth bearer token.',
          },
          {
            id: 'irc',
            label: 'Iceberg REST catalog',
            sub: 'metadata + credentials',
            col: 1,
            row: 1,
            kind: 'surface',
            icon: 'network',
            domain: 'governance',
            detail:
              'The Unity Catalog Iceberg REST catalog. It returns table metadata and short-lived vended storage credentials.',
          },
          {
            id: 'storage',
            label: 'Cloud storage',
            sub: 'data files',
            col: 2,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail: 'Cloud storage holding the data files. Engines read them directly using the vended credentials.',
          },
        ],
        edges: [
          { from: 'create', to: 'table' },
          { from: 'table', to: 'opt' },
          { from: 'table', to: 'irc', label: 'exposed through' },
          { from: 'client', to: 'irc', label: 'load_table' },
          { from: 'client', to: 'storage', label: 'vended credentials', dashed: true },
        ],
        legend: [
          { kind: 'highlight', label: 'External engine' },
          { kind: 'surface', label: 'Unity Catalog endpoint' },
          { kind: 'dashed', label: 'Temporary storage credentials' },
        ],
      },
      examples: [
        {
          label: 'Create a managed Iceberg table',
          language: 'sql',
          code: 'CREATE TABLE <catalog>.<schema>.orders_iceberg (\n  order_id BIGINT, region STRING, amount DECIMAL(12,2), order_date DATE\n) USING ICEBERG;',
          notes: [
            "Add TBLPROPERTIES ('format-version' = 3) to use Iceberg v3 features. This needs Databricks Runtime 18 LTS or above.",
            'Managed Iceberg tables need serverless compute with network access to the table storage, because Databricks uses it to maintain metadata.',
          ],
        },
      ],
      links: [
        {
          label: 'What is Apache Iceberg in Databricks?',
          url: 'https://docs.databricks.com/aws/en/iceberg/',
          note: 'Managed and foreign tables, requirements, and limits.',
        },
      ],
    },
    {
      id: 'choose',
      heading: 'Which Iceberg option to use',
      prose:
        'There are three ways an Iceberg table shows up in Unity Catalog. Choose by who writes the table and who owns the format.',
      options: {
        caption: 'Managed Iceberg, Delta with Iceberg reads, or foreign Iceberg',
        rows: [
          {
            option: 'Managed Iceberg table',
            when: 'Iceberg is the contract: other engines such as Flink or open-source Spark must write through the REST catalog, or your platform standard is Iceberg.',
            tradeoffs:
              'Unity Catalog is the catalog of record, Databricks and external engines can both read and write, and predictive optimization maintains the table. Managed Iceberg tables reject Delta-style DataFrame writes, so create and write them with SQL. Liquid clustering for Iceberg is in Public Preview.',
          },
          {
            option: 'Delta table with Iceberg reads (formerly UniForm)',
            when: 'Databricks is the only writer and outside Iceberg clients only need to read.',
            tradeoffs:
              'Keeps the full Delta feature set with one copy of the data, and Iceberg clients get read-only access through the Unity Catalog REST catalog. It needs column mapping, deletion vectors cannot be enabled together with Iceberg reads on v2 compatibility, and external engines cannot read Unity Catalog views.',
          },
          {
            option: 'Foreign Iceberg table (Lakehouse Federation)',
            when: 'Another catalog, such as AWS Glue, Hive metastore, or Snowflake Horizon Catalog, owns the table and you only need to read it from Databricks.',
            tradeoffs:
              'No data movement, and the table stays where it is. It is read-only in Databricks and has limited platform support, so copy or clone into a managed table when you need the full feature set.',
          },
        ],
        recommendation:
          'Keep tables Delta and turn on Iceberg reads when only Databricks writes. Choose managed Iceberg when other engines must write or Iceberg is your standard. Use foreign Iceberg to read tables another catalog owns.',
      },
      points: [
        {
          strong: 'Default to Delta, add Iceberg reads for interoperability.',
          text: 'If only Databricks writes, keep the table Delta and turn on Iceberg reads so external Iceberg clients can query it.',
        },
        {
          strong: 'Choose managed Iceberg when other engines write.',
          text: 'If Flink, Spark, or another engine must write through the REST catalog, or the standard you commit to is Iceberg, create a managed Iceberg table.',
        },
        {
          strong: 'Limits to know.',
          text: 'External Iceberg engines cannot read Unity Catalog views. Iceberg reads require column mapping on the Delta table, and deletion vectors cannot be enabled together with Iceberg reads on v2 compatibility.',
        },
      ],
      examples: [
        {
          label: 'Keep a Delta table, expose it as Iceberg',
          language: 'sql',
          code: "-- The table stays Delta. External engines read it as Iceberg.\nALTER TABLE <catalog>.<schema>.orders SET TBLPROPERTIES (\n  'delta.columnMapping.mode' = 'name',\n  'delta.enableIcebergCompatV2' = 'true',\n  'delta.universalFormat.enabledFormats' = 'iceberg'\n);",
          notes: ['Use delta.enableIcebergCompatV3 instead to use Iceberg v3 features.'],
        },
      ],
      links: [
        {
          label: 'What is Apache Iceberg in Databricks?',
          url: 'https://docs.databricks.com/aws/en/iceberg/',
        },
        {
          label: 'Read Delta tables with Iceberg clients',
          url: 'https://docs.databricks.com/aws/en/delta/uniform',
          note: 'Iceberg reads: requirements, REORG, and limitations.',
        },
        {
          label: 'Use Apache Iceberg v3 features',
          url: 'https://docs.databricks.com/aws/en/iceberg/iceberg-v3',
        },
        {
          label: 'Foreign catalogs (Lakehouse Federation)',
          url: 'https://docs.databricks.com/aws/en/query-federation/foreign-catalogs',
        },
      ],
    },
    {
      id: 'external',
      heading: 'Connecting an outside client',
      prose:
        'External engines use the Iceberg REST catalog on the workspace host. Use the Iceberg client version the Databricks docs recommend (1.9.2 or above) and request vended credentials.',
      steps: [
        {
          title: 'Create a service principal for the client',
          body: 'Use a service principal with OAuth machine-to-machine credentials: a client ID and a secret that the client exchanges for a short-lived token. It has no human owner to leave the company, and you can scope and rotate it. Use a personal access token only as a fallback when OAuth M2M is not an option.',
        },
        {
          title: 'Grant least privilege',
          body: 'Grant the service principal USE CATALOG, USE SCHEMA, and SELECT on the tables it reads, plus EXTERNAL USE SCHEMA on each schema it reaches from outside. Add MODIFY for writers.',
        },
        {
          title: 'Point the engine at the REST catalog',
          body: 'The catalog URL is /api/2.1/unity-catalog/iceberg-rest on the workspace host. The warehouse property is the Unity Catalog catalog name. The client asks for vended credentials, so it needs no storage keys.',
          code: 'load_catalog("unity", type="rest",\n  uri="https://<host>/api/2.1/unity-catalog/iceberg-rest",\n  warehouse="<catalog>", token=token,\n  **{"header.X-Iceberg-Access-Delegation": "vended-credentials"})',
        },
      ],
      examples: [
        {
          label: 'Read the same table from open-source Spark',
          language: 'py',
          code: 'from pyspark.sql import SparkSession\n\nWS = "https://<workspace-url>"\nspark = (\n    SparkSession.builder\n    .config("spark.jars.packages",\n            "org.apache.iceberg:iceberg-spark-runtime-3.5_2.12:<iceberg-version>,"\n            "org.apache.iceberg:iceberg-aws-bundle:<iceberg-version>")\n    .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions")\n    .config("spark.sql.catalog.uc", "org.apache.iceberg.spark.SparkCatalog")\n    .config("spark.sql.catalog.uc.type", "rest")\n    .config("spark.sql.catalog.uc.rest.auth.type", "oauth2")\n    .config("spark.sql.catalog.uc.uri", f"{WS}/api/2.1/unity-catalog/iceberg-rest")\n    .config("spark.sql.catalog.uc.oauth2-server-uri", f"{WS}/oidc/v1/token")\n    .config("spark.sql.catalog.uc.credential", "<client-id>:<client-secret>")\n    .config("spark.sql.catalog.uc.scope", "all-apis")\n    .config("spark.sql.catalog.uc.warehouse", "<catalog>")\n    .getOrCreate()\n)\nspark.sql("SELECT * FROM uc.<schema>.orders_iceberg").show()',
          notes: [
            'Replace <iceberg-version> with the version the Databricks docs recommend (1.9.2 or above).',
            'Use the Azure or GCP bundle in place of iceberg-aws-bundle on those clouds.',
            'Read the client ID and secret from a secret store, not from source.',
          ],
        },
      ],
      options: {
        caption: 'How an outside party reads the table',
        rows: [
          {
            option: 'Iceberg REST catalog with credential vending',
            when: 'Your own engines or trusted teams read or write the tables live, and each client can speak the Iceberg REST catalog protocol.',
            tradeoffs:
              'Clients see current table state and get short-lived, scoped storage credentials. Setup per client: a service principal, EXTERNAL USE SCHEMA, the metastore external access setting, and a supported Iceberg client version. Managed Iceberg tables allow writes, and Delta tables with Iceberg reads are read-only.',
          },
          {
            option: 'OpenSharing',
            when: 'The reader is another organization or business unit, or you want to hand out access to selected tables without giving the reader a service principal in your account.',
            tradeoffs:
              'You grant access through a share and recipient, which keeps sharing explicit and auditable. Recipients can read shared Iceberg tables with Iceberg clients. It is read-only and less suited to engines that must write back.',
          },
        ],
        recommendation:
          'Use the REST catalog for engines you operate or trust that need live reads or writes. Use OpenSharing for partners and other organizations where you want a share and recipient to control access.',
      },
      links: [
        {
          label: 'Access Databricks tables from Iceberg clients',
          url: 'https://docs.databricks.com/aws/en/external-access/iceberg',
        },
        {
          label: 'Credential vending',
          url: 'https://docs.databricks.com/aws/en/external-access/credential-vending',
          note: 'Temporary, scoped storage credentials for external systems.',
        },
        {
          label: 'OpenSharing',
          url: 'https://docs.databricks.com/aws/en/opensharing',
        },
      ],
    },
    {
      id: 'access',
      heading: 'What external access depends on',
      prose: 'Two Unity Catalog controls gate the external read.',
      points: [
        {
          strong: 'Metastore setting.',
          text: 'A metastore admin enables external data access on the metastore. Until then, no external engine can get credentials.',
        },
        {
          strong: 'Schema privilege.',
          text: 'The reading principal needs EXTERNAL USE SCHEMA on the schema, plus ordinary SELECT on the table. A schema owner or admin grants it, so granting stays an explicit, auditable decision.',
        },
        {
          strong: 'Credential vending limits exposure.',
          text: 'Unity Catalog issues temporary credentials scoped to the table and the privilege, so a leaked token expires and cannot reach other storage.',
        },
      ],
    },
    {
      id: 'evolution',
      heading: 'Evolution, time travel, and sharing',
      prose: 'Managed Iceberg tables support the Iceberg features you expect, and external readers see them.',
      points: [
        {
          strong: 'Schema evolution in place.',
          text: 'ALTER TABLE ADD COLUMN adds a column without rewriting data. External readers load the new schema on their next table load.',
        },
        {
          strong: 'Time travel.',
          text: 'Read an earlier snapshot with VERSION AS OF or TIMESTAMP AS OF. Keep snapshot retention long enough for audit and rollback.',
        },
        {
          strong: 'Sharing.',
          text: 'Share managed Iceberg tables, and foreign Iceberg tables, with OpenSharing (formerly Delta Sharing). Recipients can read them with Iceberg clients. Sharing is generally available.',
        },
        {
          strong: 'Let the platform maintain the table.',
          text: 'Use predictive optimization on managed tables instead of hand-tuned compaction, and prefer liquid clustering to partitioning.',
        },
      ],
      links: [
        {
          label: 'OpenSharing',
          url: 'https://docs.databricks.com/aws/en/opensharing',
        },
      ],
    },
  ],
  related: [
    { slug: 'file-formats-delta-iceberg', title: 'JSON, CSV, Parquet, Delta, and Iceberg' },
    { slug: 'external-integrations', title: 'Partner tool integrations' },
    { slug: 'data-sharing', title: 'Governed data sharing' },
  ],
};
