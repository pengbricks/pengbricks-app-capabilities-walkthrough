"""Provider A adapter.

Provider A sends single-letter status codes that must be translated through a lookup
before the shared mapping runs. That translation is provider-specific, so it lives here;
reading, validation, audit, and error handling stay in the shared framework.
"""

from __future__ import annotations

from ..config import FeedConfig
from . import generic

STATUS_CODES = {"A": "approved", "P": "pending", "R": "rejected", "V": "voided"}


def status_case_sql(column: str) -> str:
    cases = " ".join(f"WHEN '{code}' THEN '{label}'" for code, label in STATUS_CODES.items())
    return f"CASE upper(trim({column})) {cases} ELSE NULL END"


def read(spark, config: FeedConfig, landing_path: str):
    raw = generic.read_raw(spark, config, landing_path)
    decoded = raw.selectExpr("*", f"{status_case_sql('STATUS_CD')} AS status_label")
    return decoded.selectExpr(*generic.mapping_select(config))
