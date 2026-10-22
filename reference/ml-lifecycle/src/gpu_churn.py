"""Churn model helpers for the AI Runtime guide: array prep, a small PyTorch model, and the training loop.

The array prep is plain numpy and pandas, so tests run without a GPU. torch is imported inside the
functions that need it, so importing this module never needs a GPU image.
"""

from __future__ import annotations

from typing import Any

GPU_MODEL_NAME = "churn_classifier_gpu"
PARQUET_NAME = "ai_runtime/churn_snapshot.parquet"
ALIAS_SINGLE = "gpu_trained"
ALIAS_DISTRIBUTED = "gpu_distributed"


def snapshot_path(catalog: str, schema: str, volume: str) -> str:
    """Where the CPU task writes the churn snapshot that the GPU tasks read."""
    return f"/Volumes/{catalog}/{schema}/{volume}/{PARQUET_NAME}"


def split_arrays(pdf, features: list[str], label: str, key: str, holdout_mod: int):
    """Deterministic split on the key, then standardize with training-set statistics.

    Returns (x_train, y_train, x_holdout, y_holdout) as float32 numpy arrays. Every rank in a
    distributed run calls this on the same file and gets the same arrays.
    """
    import numpy as np

    pdf = pdf.sort_values(key).reset_index(drop=True)
    is_holdout = (pdf[key] % holdout_mod == 0).to_numpy()
    x = pdf[features].astype("float64").fillna(0.0).to_numpy()
    y = pdf[label].astype("float32").to_numpy()
    mean, std = x[~is_holdout].mean(axis=0), x[~is_holdout].std(axis=0)
    std[std == 0] = 1.0
    x = ((x - mean) / std).astype("float32")
    return x[~is_holdout], y[~is_holdout], x[is_holdout], y[is_holdout]


def shard(x, y, rank: int, world_size: int):
    """Every world_size-th row, starting at rank. The shards are disjoint and cover the array."""
    return x[rank::world_size], y[rank::world_size]


def build_model(n_features: int, hidden: int = 32):
    import torch.nn as nn

    return nn.Sequential(nn.Linear(n_features, hidden), nn.ReLU(), nn.Linear(hidden, 1))


def fit(model, x, y, device: str, epochs: int, seed: int, batch_size: int = 256, lr: float = 1e-2) -> list[float]:
    """Mini-batch training on `device`. `model` may be wrapped in DistributedDataParallel. Returns the epoch losses."""
    import torch

    gen = torch.Generator().manual_seed(seed)
    xt, yt = torch.from_numpy(x), torch.from_numpy(y)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = torch.nn.BCEWithLogitsLoss()
    losses = []
    for _ in range(epochs):
        order = torch.randperm(len(xt), generator=gen)
        total = 0.0
        for start in range(0, len(order), batch_size):
            idx = order[start : start + batch_size]
            xb, yb = xt[idx].to(device), yt[idx].to(device)
            optimizer.zero_grad()
            loss = loss_fn(model(xb).squeeze(1), yb)
            loss.backward()
            optimizer.step()
            total += float(loss) * len(idx)
        losses.append(total / max(len(order), 1))
    return losses


def holdout_auc(model, x, y, device: str) -> float:
    import torch
    from sklearn.metrics import roc_auc_score

    model.eval()
    with torch.no_grad():
        scores = torch.sigmoid(model(torch.from_numpy(x).to(device)).squeeze(1)).cpu().numpy()
    return float(roc_auc_score(y, scores))


def state_to_lists(model) -> dict[str, Any]:
    """CPU state dict as plain lists, so a rank can return it through the distributed call."""
    return {k: v.detach().cpu().numpy().tolist() for k, v in model.state_dict().items()}


def model_from_lists(state: dict[str, Any], n_features: int, hidden: int = 32):
    import torch

    model = build_model(n_features, hidden)
    model.load_state_dict({k: torch.tensor(v) for k, v in state.items()})
    return model
