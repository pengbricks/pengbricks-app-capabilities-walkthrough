import os
from datetime import datetime

import pytest

pytest.importorskip("pyspark")

from pyspark.sql import SparkSession  # noqa: E402

from dx_demo.transforms import add_band, clean_records  # noqa: E402

K, V, T = "id", "val", "ts"


@pytest.fixture(scope="module")
def spark():
    # On Databricks (serverless or Databricks Connect) reuse the existing session.
    # Elsewhere start a local one.
    if os.environ.get("DATABRICKS_RUNTIME_VERSION") or os.environ.get("SPARK_REMOTE"):
        return SparkSession.builder.getOrCreate()
    return SparkSession.builder.master("local[1]").appName("dx-tests").getOrCreate()


def _df(spark, rows):
    return spark.createDataFrame(rows, f"{K} string, {V} double, {T} timestamp")


def _clean(df):
    return clean_records(df, K, V, T)


def test_clean_drops_null_blank_and_negative(spark):
    df = _df(spark, [
        (None, 10.0, datetime(2024, 1, 1)),
        ("  ", 10.0, datetime(2024, 1, 1)),
        ("A-1", -5.0, datetime(2024, 1, 1)),
        ("A-2", None, datetime(2024, 1, 1)),
        ("A-3", 20.0, datetime(2024, 1, 1)),
    ])
    assert [r[K] for r in _clean(df).collect()] == ["A-3"]


def test_duplicates_differing_in_case_and_whitespace_collapse(spark):
    """The edge case: keys must be normalized before de-duplication."""
    df = _df(spark, [("a-1 ", 10.0, datetime(2024, 1, 1)), ("A-1", 30.0, datetime(2024, 1, 2))])
    rows = _clean(df).collect()
    assert len(rows) == 1 and rows[0][V] == 30.0


def test_dated_version_beats_undated_version(spark):
    df = _df(spark, [("B-1", 99.0, None), ("B-1", 50.0, datetime(2024, 1, 1))])
    rows = _clean(df).collect()
    assert len(rows) == 1 and rows[0][V] == 50.0


def test_add_band(spark):
    df = _df(spark, [("C-1", 50.0, None), ("C-2", 150.0, None), ("C-3", 900.0, None)])
    out = add_band(df, V, "band", [(500, "large"), (100, "medium")], "small")
    assert {r[K]: r["band"] for r in out.collect()} == {"C-1": "small", "C-2": "medium", "C-3": "large"}
