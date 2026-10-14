# SRP Architecture

## Boundary

Provider adapters own only source access and normalization into a canonical record contract. Feed configuration owns format, schema, mappings, primary keys, watermark, quality thresholds, target names, ownership, and service-level objectives.

The shared framework owns:

- Configuration validation and schema contracts.
- Audit fields, release SHA, and run correlation IDs.
- Auto Loader options, checkpoints, and rescued data.
- Value validation, quarantine routing, disposition, and replay.
- Bronze, Silver, and Gold registration.
- Exception normalization and failure evidence.
- Job orchestration, retries, timeouts, and notifications.

## Flow

`source -> landing volume -> bronze raw/quarantine -> silver canonical -> gold metrics -> evidence ledger`

Priority batch uses a triggered Lakeflow pipeline. Incremental feeds use streaming tables with managed checkpoints. Materialized views publish conformed and aggregate products.

## Required parameters

- `feed_config_path`
- `target_catalog`
- `target_schema`
- `landing_root`
- `checkpoint_root`
- `environment`
- `release_sha`
- `quality_threshold`

No environment-specific value belongs in shared transformation code.
