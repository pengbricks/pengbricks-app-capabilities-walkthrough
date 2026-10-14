"""Shared orchestration for one feed: read, validate, quarantine, upsert, and audit."""

from __future__ import annotations

from .adapters import get_adapter
from .audit import AuditRecord, write_audit
from .config import FeedConfig
from .validation import split_valid


SILVER_COLUMNS = (
    "record_id STRING, account_id STRING, event_ts TIMESTAMP, amount DECIMAL(18,2), currency STRING, "
    "status STRING, source_feed STRING, ingest_run_id STRING"
)


def ensure_tables(spark, catalog: str, schema: str) -> None:
    """Create shared framework tables once, before feeds run in parallel."""
    from .audit import AUDIT_SCHEMA

    prefix = f"{catalog}.{schema}"
    spark.sql(f"CREATE TABLE IF NOT EXISTS {prefix}.transactions_silver ({SILVER_COLUMNS}) CLUSTER BY (source_feed)")
    spark.sql(
        f"CREATE TABLE IF NOT EXISTS {prefix}.transactions_quarantine ({SILVER_COLUMNS}, "
        "_quarantine_reasons ARRAY<STRING>, quarantined_at TIMESTAMP) CLUSTER BY (source_feed)"
    )
    spark.sql(f"CREATE TABLE IF NOT EXISTS {prefix}.audit_log ({AUDIT_SCHEMA})")


class TransientSourceError(RuntimeError):
    """A retryable failure, such as a source that is briefly unavailable."""


def run_feed(spark, config: FeedConfig, catalog: str, schema: str, run_id: str) -> AuditRecord:
    prefix = f"{catalog}.{schema}"
    record = AuditRecord(run_id=run_id, feed=config.name)
    try:
        from pyspark.sql import functions as F

        # 1. Read and map: the adapter named in the feed config returns canonical columns.
        mapped = get_adapter(config.adapter)(spark, config, config.landing_path(catalog, schema))
        mapped = mapped.withColumn("source_feed", F.lit(config.name)).withColumn("ingest_run_id", F.lit(run_id))
        # 2. Validate: the same configured rules apply to every feed.
        valid, quarantined = split_valid(mapped, config.rules)

        record.rows_read = mapped.count()
        record.rows_quarantined = quarantined.count()
        record.rows_valid = record.rows_read - record.rows_quarantined

        # 3. Quarantine rejected rows with the names of the rules they failed.
        quarantined.withColumn("quarantined_at", F.current_timestamp()).write.mode("append").saveAsTable(
            f"{prefix}.transactions_quarantine"
        )

        # 4. Upsert valid rows by feed and key, so reruns of the same files are idempotent.
        silver = f"{prefix}.transactions_silver"
        deduped = valid.dropDuplicates(["source_feed", *config.keys])
        deduped.createOrReplaceTempView("incoming_valid")
        key_match = " AND ".join(f"t.{key} = s.{key}" for key in ("source_feed", *config.keys))
        spark.sql(
            f"MERGE INTO {silver} t USING incoming_valid s ON {key_match} "
            "WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT *"
        )
        record.finish("SUCCEEDED")
        return record
    except Exception as error:
        # Record the failure, then re-raise so the job's retry and alert policies apply.
        record.finish("FAILED", f"{type(error).__name__}: {error}")
        raise
    finally:
        # 5. Audit every run, successful or not.
        write_audit(spark, f"{prefix}.audit_log", record)
