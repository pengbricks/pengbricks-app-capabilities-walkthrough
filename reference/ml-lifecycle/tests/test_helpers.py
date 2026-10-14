import pathlib
import sys

import numpy as np
import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import ml_common as c  # noqa: E402


def test_spec_validates():
    spec = c.load_spec(str(ROOT / "use_cases" / "general.yml"))
    assert c.feature_columns(spec)[0] == "tenure_months"


def test_spec_rejects_bad_identifier():
    spec = c.load_spec(str(ROOT / "use_cases" / "general.yml"))
    spec["source"]["table"] = "bad name;"
    with pytest.raises(ValueError):
        c.validate_spec(spec)


def test_psi_is_zero_for_same_sample_and_large_for_shift():
    rng = np.random.default_rng(1)
    base = rng.uniform(0, 90, 5000)
    assert c.psi(base, base) == pytest.approx(0, abs=1e-6)
    assert c.psi(base, base + 30) > 0.2
    assert c.psi(base, rng.uniform(0, 90, 5000)) < 0.1


def test_mean_shift_in_standard_deviations():
    base = np.array([0.0, 2.0, 4.0, 6.0])
    assert c.mean_shift(base, base + base.std()) == pytest.approx(1.0)


def test_is_breach_uses_either_signal():
    assert c.is_breach(0.3, 0.0, 0.2, 0.5)
    assert c.is_breach(0.0, -0.9, 0.2, 0.5)
    assert not c.is_breach(0.05, 0.1, 0.2, 0.5)


def test_within_tolerance_and_environment_diff():
    assert c.within_tolerance(0.9, 0.9004, 0.001)
    assert not c.within_tolerance(0.9, 0.91, 0.001)
    assert c.diff_environment({"a": "1", "b": "2"}, {"a": "1", "b": "3"}) == [("b", "2", "3")]


def test_quality_queries_cover_key_columns_and_ranges():
    queries = dict(c.quality_queries("t", "id", ["x"], {"x": [0, 5]}))
    assert set(queries) == {"key_not_null", "key_unique", "not_null:x", "range:x"}
    assert "`x` < 0 OR `x` > 5" in queries["range:x"]


def test_split_is_deterministic_and_disjoint():
    import pandas as pd

    pdf = pd.DataFrame({"id": range(100), "v": range(100)})
    train, holdout = c.split_frame(pdf.sample(frac=1, random_state=3), "id", 5)
    assert len(holdout) == 20 and set(train["id"]).isdisjoint(holdout["id"])
