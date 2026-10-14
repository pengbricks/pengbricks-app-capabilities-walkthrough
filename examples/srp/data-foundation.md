# Generic Data Foundation

## Reference batch

Use a public, generated, or tenant-supplied reference dataset selected through configuration. Preserve the source version, checksum, retrieval timestamp, source URL, and license or usage notes.

## Synthetic operational feeds

Generate deterministic, non-production batch records and incremental events. Include valid records plus duplicates, malformed payloads, missing keys, late events, and one schema-evolution field.

The generator records its seed, row count, schema version, scenario, and release SHA. Future tenants can replace the example inputs with governed custom datasets while retaining the same artifact contract.

## Medallion products

- Bronze: source-faithful records, provenance, rescued data, and ingestion metadata.
- Silver: canonical entities, relationships, transactions, and events.
- Gold: governed domain metrics, pipeline-quality metrics, and guide artifacts.
