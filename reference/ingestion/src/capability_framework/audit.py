"""Shared audit trail: one row per feed run, written whether the run succeeds or fails."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class AuditRecord:
    run_id: str
    feed: str
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: datetime | None = None
    status: str = "RUNNING"
    rows_read: int = 0
    rows_valid: int = 0
    rows_quarantined: int = 0
    error: str | None = None

    def finish(self, status: str, error: str | None = None) -> "AuditRecord":
        self.status = status
        self.error = error[:2000] if error else None
        self.ended_at = datetime.now(timezone.utc)
        return self


AUDIT_SCHEMA = (
    "run_id STRING, feed STRING, started_at TIMESTAMP, ended_at TIMESTAMP, status STRING, "
    "rows_read BIGINT, rows_valid BIGINT, rows_quarantined BIGINT, error STRING"
)


def write_audit(spark, table: str, record: AuditRecord) -> None:
    row = [
        (
            record.run_id,
            record.feed,
            record.started_at,
            record.ended_at,
            record.status,
            record.rows_read,
            record.rows_valid,
            record.rows_quarantined,
            record.error,
        )
    ]
    spark.createDataFrame(row, AUDIT_SCHEMA).write.mode("append").saveAsTable(table)
