"""Pure PySpark transformations: DataFrame in, DataFrame out. Column names come from the caller."""
from typing import Sequence, Tuple

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F


def clean_records(df: DataFrame, key: str, value: str, order_by: str) -> DataFrame:
    """Normalize keys, drop invalid rows, keep the latest version of each key.

    Edge cases:
    - Keys are normalized BEFORE de-duplication, so " k-1" and "K-1" are the same record.
    - Rows with a null `order_by` sort last, so a dated version always beats an undated one.
    """
    normalized = (
        df.withColumn(key, F.upper(F.trim(F.col(key))))
        .withColumn(key, F.when(F.col(key) == "", None).otherwise(F.col(key)))
        .filter(F.col(key).isNotNull())
        .filter(F.col(value).isNotNull() & (F.col(value) >= 0))
    )
    latest = Window.partitionBy(key).orderBy(F.col(order_by).desc_nulls_last())
    return (
        normalized.withColumn("_rn", F.row_number().over(latest))
        .filter(F.col("_rn") == 1)
        .drop("_rn")
    )


def add_band(df: DataFrame, value: str, column: str, thresholds: Sequence[Tuple[float, str]], default: str) -> DataFrame:
    """Add a label column from (min, label) thresholds."""
    expr = F.lit(default)
    for minimum, label in sorted(thresholds):  # lowest first, so the highest match wins last
        expr = F.when(F.col(value) >= minimum, label).otherwise(expr)
    return df.withColumn(column, expr)


def add_date(df: DataFrame, timestamp: str, column: str = "event_date") -> DataFrame:
    return df.withColumn(column, F.to_date(F.col(timestamp)))
