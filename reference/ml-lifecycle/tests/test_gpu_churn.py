import pathlib
import sys

import numpy as np
import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import gpu_churn as g  # noqa: E402


def _frame(n=200):
    rng = np.random.default_rng(3)
    return pd.DataFrame({"customer_id": np.arange(1, n + 1), "a": rng.normal(size=n), "b": rng.normal(5, 2, size=n),
                         "churned": rng.integers(0, 2, size=n)})


def test_split_is_deterministic_disjoint_and_standardized():
    pdf = _frame()
    one = g.split_arrays(pdf, ["a", "b"], "churned", "customer_id", 5)
    two = g.split_arrays(pdf.sample(frac=1, random_state=1), ["a", "b"], "churned", "customer_id", 5)
    for left, right in zip(one, two):
        assert np.array_equal(left, right)
    x_train, _, x_hold, _ = one
    assert len(x_hold) == 40 and len(x_train) == 160
    assert abs(float(x_train.mean())) < 1e-5 and x_train.dtype == np.float32


def test_shards_are_disjoint_and_cover_the_array():
    x, y = np.arange(23, dtype="float32").reshape(-1, 1), np.arange(23, dtype="float32")
    parts = [g.shard(x, y, rank, 4) for rank in range(4)]
    assert sorted(np.concatenate([p[1] for p in parts]).tolist()) == list(range(23))


def test_snapshot_path_is_under_the_volume():
    assert g.snapshot_path("c", "s", "v") == "/Volumes/c/s/v/ai_runtime/churn_snapshot.parquet"
