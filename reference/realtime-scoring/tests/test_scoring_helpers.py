import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from scoring_helpers import build_record, dataframe_body, error_cases, percentile, summarize  # noqa: E402

FEATURES = [
    {"name": "a", "min": 0, "max": 10},
    {"name": "b", "min": 5, "max": 15, "optional": True},
]


def test_percentile_interpolates():
    assert percentile([10, 20, 30, 40], 50) == 25
    assert percentile([1, 2, 3, 4, 5], 100) == 5
    assert percentile([7], 95) == 7


def test_percentile_rejects_bad_input():
    with pytest.raises(ValueError):
        percentile([], 50)
    with pytest.raises(ValueError):
        percentile([1], 101)


def test_summarize():
    result = summarize([100.0] * 19 + [500.0])
    assert result["count"] == 20
    assert result["p50_ms"] == 100.0
    assert result["max_ms"] == 500.0
    assert 100.0 < result["p95_ms"] < 500.0


def test_build_record_is_deterministic_and_in_range():
    assert build_record(FEATURES, 3) == build_record(FEATURES, 3)
    for i in range(50):
        record = build_record(FEATURES, i)
        assert 0 <= record["a"] <= 10
        assert 5 <= record["b"] <= 15


def test_error_cases_cover_required_and_optional():
    cases = {c["scenario"]: c for c in error_cases(FEATURES)}
    assert set(cases) == {"malformed_payload", "wrong_payload_shape", "missing_required_feature", "missing_optional_feature"}
    assert "a" not in cases["missing_required_feature"]["body"]["dataframe_records"][0]
    assert "b" not in cases["missing_optional_feature"]["body"]["dataframe_records"][0]
    assert cases["malformed_payload"]["expected_status"] == 400
    assert cases["missing_optional_feature"]["expected_status"] == 200
    assert dataframe_body([{"a": 1}]) == {"dataframe_records": [{"a": 1}]}
