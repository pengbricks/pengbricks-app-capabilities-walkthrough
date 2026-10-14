"""Pure helpers for the online scoring guide: percentiles, request bodies, error cases."""

from __future__ import annotations

import math
from typing import Any


def percentile(values: list[float], pct: float) -> float:
    """Linear-interpolation percentile (same as numpy's default). pct is 0-100."""
    if not values:
        raise ValueError("percentile of an empty list")
    if not 0 <= pct <= 100:
        raise ValueError("pct must be between 0 and 100")
    ordered = sorted(values)
    rank = (len(ordered) - 1) * pct / 100
    low, high = math.floor(rank), math.ceil(rank)
    if low == high:
        return float(ordered[low])
    return float(ordered[low] + (ordered[high] - ordered[low]) * (rank - low))


def summarize(latencies_ms: list[float]) -> dict[str, float]:
    return {
        "count": len(latencies_ms),
        "p50_ms": round(percentile(latencies_ms, 50), 1),
        "p95_ms": round(percentile(latencies_ms, 95), 1),
        "max_ms": round(max(latencies_ms), 1),
    }


def feature_ranges(features: list[dict[str, Any]]) -> dict[str, tuple[float, float]]:
    return {f["name"]: (float(f["min"]), float(f["max"])) for f in features}


def build_record(features: list[dict[str, Any]], index: int) -> dict[str, float]:
    """Deterministic in-range record for request number `index` (no randomness, no seed drift)."""
    record = {}
    for position, feature in enumerate(features):
        low, high = float(feature["min"]), float(feature["max"])
        fraction = ((index * 37 + position * 11) % 100) / 100
        record[feature["name"]] = round(low + (high - low) * fraction, 2)
    return record


def dataframe_body(records: list[dict[str, Any]]) -> dict[str, Any]:
    return {"dataframe_records": records}


def error_cases(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Failure scenarios sent to the endpoint. `raw` bodies are sent as-is, not JSON-encoded."""
    base = build_record(features, 1)
    required = [f["name"] for f in features if not f.get("optional")]
    optional = [f["name"] for f in features if f.get("optional")]
    cases: list[dict[str, Any]] = [
        {
            "scenario": "malformed_payload",
            "description": "Body is not valid JSON",
            "raw": '{"dataframe_records": [{"' + features[0]["name"] + '": ',
            "expected_status": 400,
        },
        {
            "scenario": "wrong_payload_shape",
            "description": "Valid JSON with an unknown top-level key",
            "body": {"rows": [base]},
            "expected_status": 400,
        },
    ]
    if required:
        missing = {k: v for k, v in base.items() if k != required[0]}
        cases.append(
            {
                "scenario": "missing_required_feature",
                "description": f"Required feature {required[0]} omitted",
                "body": dataframe_body([missing]),
                "expected_status": 400,
            }
        )
    if optional:
        missing = {k: v for k, v in base.items() if k != optional[0]}
        cases.append(
            {
                "scenario": "missing_optional_feature",
                "description": f"Optional feature {optional[0]} omitted; the model imputes the training median",
                "body": dataframe_body([missing]),
                "expected_status": 200,
            }
        )
    return cases
