import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import common  # noqa: E402


@pytest.fixture
def spec():
    return common.load_spec(str(ROOT / "use_cases" / "general.yml"))


def test_spec_is_valid(spec):
    assert spec["seed"] and spec["features"]
    assert all(f != spec["label"]["name"] for f in spec["features"])


def test_bad_feature_rejected(spec):
    spec["features"].append("missing")
    with pytest.raises(ValueError):
        common.validate_spec(spec)


def test_gates_without_champion():
    assert all(ok for _, ok, _ in common.evaluate_gates(0.9, 0.8, None, 0.0))


def test_gate_blocks_low_auc():
    assert not common.evaluate_gates(0.7, 0.8, None, 0.0)[0][1]


def test_gate_blocks_regression_against_champion():
    gates = dict((n, ok) for n, ok, _ in common.evaluate_gates(0.88, 0.8, 0.9, 0.0))
    assert gates["quality_threshold"] and not gates["champion_comparison"]


def test_gate_allows_regression_within_tolerance():
    assert all(ok for _, ok, _ in common.evaluate_gates(0.88, 0.8, 0.9, 0.05))
