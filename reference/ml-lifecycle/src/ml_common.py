"""Shared helpers for the ML lifecycle guides: spec, real-data snapshots, training, checks, drift math."""

from __future__ import annotations

import hashlib
import inspect
import platform
import re
from typing import Any

import yaml

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
TRACKED_PACKAGES = ["scikit-learn", "numpy", "pandas", "mlflow", "scipy"]


# --- spec ---------------------------------------------------------------------------------------
def load_spec(path: str) -> dict[str, Any]:
    with open(path) as handle:
        spec = yaml.safe_load(handle)
    validate_spec(spec)
    return spec


def validate_spec(spec: dict[str, Any]) -> None:
    import public_data

    src = spec["source"]
    columns = list(src["columns"])
    names = [
        src["table"], src["transactions_table"], src["key"], spec["label"]["name"], spec["features"]["table"],
        spec["model"]["trained_name"], spec["model"]["imported_name"], spec["model"]["drift_name"],
        *columns, *[d["name"] for d in spec["features"]["derived"]], *spec["model"]["derived"],
    ]
    for name in names:
        if not _IDENT.match(name):
            raise ValueError(f"Not a valid identifier: {name}")
    missing = [f for f in spec["features"]["passthrough"] if f not in columns]
    if missing:
        raise ValueError(f"Passthrough features not in the snapshot: {missing}")
    available = set(columns) | set(spec["model"]["derived"])
    unknown = [f for f in spec["model"]["features"] if f not in available]
    if unknown:
        raise ValueError(f"Model features not available: {unknown}")
    last = public_data.SOURCES[src["dataset"]]["last_date"]
    for cut in [src["snapshot_date"], spec["experiment"]["append_snapshot_date"], *spec["drift"]["batch_dates"]]:
        public_data.check_snapshot_date(cut, spec["label"]["window_months"], last)


def fq(catalog: str, schema: str, table: str) -> str:
    return f"`{catalog}`.`{schema}`.`{table}`"


def feature_columns(spec: dict[str, Any]) -> list[str]:
    return [*spec["features"]["passthrough"], *[d["name"] for d in spec["features"]["derived"]]]


# --- data ---------------------------------------------------------------------------------------
def land_transactions(spark, spec: dict[str, Any], table: str, volume_path: str) -> int:
    """Download the source file into the volume (once), parse it, and overwrite `table`. Returns rows."""
    import public_data

    path = public_data.fetch(spec["source"]["dataset"], volume_path)
    frame = public_data.read_online_retail(path)
    spark.createDataFrame(frame).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
    return len(frame)


def ensure_transactions(spark, spec: dict[str, Any], table: str, volume_path: str) -> None:
    """Land the transactions unless an earlier task or job already did."""
    if not spark.catalog.tableExists(table.replace("`", "")):
        land_transactions(spark, spec, table, volume_path)


def snapshot_frame(spark, spec: dict[str, Any], transactions: str, cut: str | None = None):
    """Customers as of `cut` (default: the spec's snapshot date) with the label and model-only columns."""
    from pyspark.sql import functions as F

    import public_data

    sql = public_data.customer_snapshot_sql(transactions, cut or spec["source"]["snapshot_date"],
                                            spec["label"]["window_months"])
    df = spark.sql(sql)
    for name, expr in spec["model"]["derived"].items():
        df = df.withColumn(name, F.expr(expr))
    return df


# --- training -----------------------------------------------------------------------------------
def make_pipeline(seed: int):
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler

    return Pipeline([("scale", StandardScaler()), ("model", GradientBoostingClassifier(random_state=seed % 2**31))])


def split_frame(pdf, key: str, holdout_mod: int):
    """Deterministic train/holdout split on the key, shared by every task."""
    pdf = pdf.sort_values(key).reset_index(drop=True)
    is_holdout = pdf[key] % holdout_mod == 0
    return pdf[~is_holdout], pdf[is_holdout]


def train_and_score(pdf, spec: dict[str, Any]):
    """Fit the pipeline on the training split and return (pipeline, holdout AUC, holdout frame)."""
    from sklearn.metrics import roc_auc_score

    features, label = spec["model"]["features"], spec["label"]["name"]
    train, holdout = split_frame(pdf, spec["source"]["key"], spec["model"]["holdout_mod"])
    pipeline = make_pipeline(spec["seed"]).fit(train[features], train[label])
    auc = float(roc_auc_score(holdout[label], pipeline.predict_proba(holdout[features])[:, 1]))
    return pipeline, auc, holdout


def delta_version(spark, table: str) -> int:
    return int(spark.sql(f"DESCRIBE HISTORY {table} LIMIT 1").collect()[0]["version"])


# --- environment and code references ------------------------------------------------------------
def environment_versions() -> dict[str, str]:
    from importlib import metadata

    versions = {"python": platform.python_version()}
    for package in TRACKED_PACKAGES:
        try:
            versions[package] = metadata.version(package)
        except metadata.PackageNotFoundError:
            versions[package] = "not installed"
    return versions


def code_hash() -> str:
    """Hash the training code the tracked run used (pipeline definition, split, and scoring)."""
    source = "".join(inspect.getsource(fn) for fn in (make_pipeline, split_frame, train_and_score))
    return hashlib.sha256(source.encode()).hexdigest()[:16]


def diff_environment(recorded: dict[str, str], current: dict[str, str]) -> list[tuple[str, str, str]]:
    """Return (package, recorded, current) for every tracked package whose version differs."""
    return [(k, v, current.get(k, "missing")) for k, v in recorded.items() if current.get(k) != v]


def within_tolerance(expected: float, actual: float, tolerance: float) -> bool:
    return abs(expected - actual) <= tolerance


# --- quality checks -----------------------------------------------------------------------------
def quality_queries(table: str, key: str, columns: list[str], ranges: dict[str, list[float]]) -> list[tuple[str, str]]:
    """Each query returns the number of violating rows (0 means the check passes)."""
    queries = [
        ("key_not_null", f"SELECT count(*) FROM {table} WHERE `{key}` IS NULL"),
        ("key_unique", f"SELECT count(*) - count(DISTINCT `{key}`) FROM {table}"),
    ]
    for col in columns:
        queries.append((f"not_null:{col}", f"SELECT count(*) FROM {table} WHERE `{col}` IS NULL"))
    for col, (lo, hi) in ranges.items():
        queries.append((f"range:{col}", f"SELECT count(*) FROM {table} WHERE `{col}` < {lo} OR `{col}` > {hi}"))
    return queries


# --- drift --------------------------------------------------------------------------------------
def psi(expected, actual, bins: int = 10) -> float:
    """Population Stability Index of `actual` against `expected`, using baseline quantile bins."""
    import numpy as np

    expected, actual = np.asarray(expected, dtype=float), np.asarray(actual, dtype=float)
    edges = np.unique(np.quantile(expected, np.linspace(0, 1, bins + 1)))
    if len(edges) < 3:
        return 0.0
    edges[0], edges[-1] = -np.inf, np.inf
    e = np.histogram(expected, edges)[0] / len(expected)
    a = np.histogram(actual, edges)[0] / len(actual)
    e, a = np.clip(e, 1e-6, None), np.clip(a, 1e-6, None)
    return float(np.sum((a - e) * np.log(a / e)))


def mean_shift(expected, actual) -> float:
    """Shift of the mean in baseline standard deviations."""
    import numpy as np

    expected, actual = np.asarray(expected, dtype=float), np.asarray(actual, dtype=float)
    std = expected.std()
    return float((actual.mean() - expected.mean()) / std) if std else 0.0


def is_breach(psi_value: float, shift_value: float, psi_threshold: float, shift_threshold: float) -> bool:
    return psi_value > psi_threshold or abs(shift_value) > shift_threshold
