"""Shared helpers for the model release job: spec loading, real-data training snapshot, release gates."""

from __future__ import annotations

import re
from typing import Any

import yaml

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def load_spec(path: str) -> dict[str, Any]:
    with open(path) as handle:
        spec = yaml.safe_load(handle)
    validate_spec(spec)
    return spec


SNAPSHOT_COLUMNS = [
    "tenure_months", "monthly_spend", "returns", "products_per_order", "days_since_purchase", "days_between_orders",
]


def validate_spec(spec: dict[str, Any]) -> None:
    import public_data

    data = spec["data"]
    names = [*SNAPSHOT_COLUMNS, *data["derived"]]
    for name in [spec["model"]["name"], data["table"], data["transactions_table"], data["key"], spec["label"]["name"], *names]:
        if not _IDENT.match(name):
            raise ValueError(f"Not a valid identifier: {name}")
    missing = [f for f in spec["features"] if f not in names]
    if missing:
        raise ValueError(f"Features not in the snapshot: {missing}")
    if spec["label"]["name"] in names:
        raise ValueError("Label name collides with a snapshot column")
    public_data.check_snapshot_date(
        data["snapshot_date"], spec["label"]["window_months"], public_data.SOURCES[data["dataset"]]["last_date"]
    )


def full_model_name(catalog: str, schema: str, spec: dict[str, Any]) -> str:
    return f"{catalog}.{schema}.{spec['model']['name']}"


def training_table(catalog: str, schema: str, spec: dict[str, Any]) -> str:
    return f"{catalog}.{schema}.{spec['data']['table']}"


def build_training_frame(spark, spec: dict[str, Any], volume_path: str):
    """Land the source file (once) and return the customer snapshot with the label and model-only columns."""
    from pyspark.sql import functions as F

    import public_data

    data = spec["data"]
    catalog, schema = volume_path.split("/")[2:4]
    transactions = f"`{catalog}`.`{schema}`.`{data['transactions_table']}`"
    if not spark.catalog.tableExists(transactions.replace("`", "")):
        frame = public_data.read_online_retail(public_data.fetch(data["dataset"], volume_path))
        spark.createDataFrame(frame).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(transactions)
    df = spark.sql(public_data.customer_snapshot_sql(transactions, data["snapshot_date"], spec["label"]["window_months"]))
    for name, expr in data["derived"].items():
        df = df.withColumn(name, F.expr(expr))
    return df


def split_frame(pdf, spec: dict[str, Any]):
    """Deterministic train/holdout split on the customer key, shared by training and the tests."""
    is_holdout = pdf[spec["data"]["key"]] % spec["data"]["holdout_mod"] == 0
    return pdf[~is_holdout], pdf[is_holdout]


def evaluate_gates(
    candidate_auc: float,
    min_auc: float,
    champion_auc: float | None,
    max_regression: float,
) -> list[tuple[str, bool, str]]:
    """Quality threshold and champion comparison. Returns (name, passed, detail) rows."""
    gates = [
        ("quality_threshold", candidate_auc >= min_auc, f"auc={candidate_auc:.4f} min={min_auc:.4f}")
    ]
    if champion_auc is None:
        gates.append(("champion_comparison", True, "no current champion"))
    else:
        floor = champion_auc - max_regression
        gates.append(
            (
                "champion_comparison",
                candidate_auc >= floor,
                f"candidate={candidate_auc:.4f} champion={champion_auc:.4f} allowed_regression={max_regression:.4f}",
            )
        )
    return gates


def run_url(host: str, experiment_id: str, run_id: str) -> str:
    return f"{host.rstrip('/')}/ml/experiments/{experiment_id}/runs/{run_id}"


def to_bool(value: Any) -> bool:
    return str(value).strip().lower() in {"true", "1", "yes"}
