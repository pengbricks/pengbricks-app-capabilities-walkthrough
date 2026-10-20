"""Optional test that runs Spark on serverless compute through Databricks Connect.

It skips itself when Databricks Connect cannot reach serverless compute: no profile, an expired
sign-in, or no network. In VS Code, start it with the Debug icon in the Testing panel so the
"databricks": true launch configuration applies. From a terminal:
DATABRICKS_CONFIG_PROFILE=<profile> uv run pytest tests/test_connect.py
"""

import pytest

from orders_demo import clean_orders, daily_revenue, sample_orders, spark_daily_revenue

pytestmark = pytest.mark.connect


@pytest.fixture(scope="module")
def spark():
    connect = pytest.importorskip("databricks.connect")
    try:
        session = connect.DatabricksSession.builder.serverless().getOrCreate()
        session.range(1).collect()  # fails here, not in the test, when sign-in has expired
    except Exception as error:  # noqa: BLE001 - any connection problem means skip, not fail
        pytest.skip(f"Databricks Connect is not available: {type(error).__name__}")
    return session


def test_spark_total_matches_pandas_total(spark):
    cleaned = clean_orders(sample_orders())
    from_spark = spark_daily_revenue(spark.createDataFrame(cleaned)).toPandas()
    expected = daily_revenue(cleaned)
    assert len(from_spark) == len(expected)
    assert from_spark["revenue"].sum() == pytest.approx(expected["revenue"].sum())
