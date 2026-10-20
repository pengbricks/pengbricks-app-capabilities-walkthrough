"""Orders pipeline: dbldatagen generates raw orders (bronze), expectations clean them (silver),
and a daily roll-up answers the business question (gold).

dbldatagen comes from the pipeline's `environment: dependencies` setting in resources/orders.pipeline.yml.
The seed is fixed, so every update generates the same orders.
"""

import dbldatagen as dg
from pyspark import pipelines as dp
from pyspark.sql import functions as F

SEED = 42
CATEGORIES = ["electronics", "grocery", "home", "toys", "apparel"]
STATUSES = ["placed", "shipped", "delivered", "cancelled"]


def row_count() -> int:
    # Set by the bundle: `configuration: starter.row_count` in resources/orders.pipeline.yml.
    return int(spark.conf.get("starter.row_count", "100000"))


@dp.materialized_view(comment="Raw synthetic orders, including rows the silver rules reject")
def orders_bronze():
    # Each random column gets its own seed. With one shared seed every column draws the same random
    # number per row, so a low quantity would always come with the same category, status, and date.
    spec = (
        dg.DataGenerator(spark, name="orders", rows=row_count(), partitions=4, randomSeed=SEED)
        .withColumn("order_id", "long", minValue=1_000_000, uniqueValues=row_count())
        .withColumn("customer_id", "string", prefix="C", minValue=1, maxValue=5_000, random=True, randomSeed=SEED + 1, percentNulls=0.02)
        .withColumn("product_category", "string", values=CATEGORIES, weights=[2, 5, 3, 2, 3], random=True, randomSeed=SEED + 2)
        .withColumn("quantity", "int", minValue=-1, maxValue=8, random=True, randomSeed=SEED + 3)
        .withColumn("unit_price", "decimal(10,2)", minValue=1.99, maxValue=299.99, step=0.01, random=True, randomSeed=SEED + 4)
        .withColumn("status", "string", values=STATUSES + ["unknown"], weights=[3, 4, 8, 2, 1], random=True, randomSeed=SEED + 5)
        .withColumn("order_ts", "timestamp", begin="2026-01-01 00:00:00", end="2026-03-31 23:59:00", interval="1 minute", random=True, randomSeed=SEED + 6)
    )
    return spec.build()


@dp.materialized_view(comment="Orders that pass every rule, with the order total and date added")
@dp.expect_all_or_drop(
    {
        "customer_present": "customer_id IS NOT NULL",
        "quantity_positive": "quantity > 0",
        "status_known": "status IN ('placed', 'shipped', 'delivered', 'cancelled')",
    }
)
@dp.expect("price_in_range", "unit_price BETWEEN 1 AND 300")
def orders_silver():
    return spark.read.table("orders_bronze").select(
        "order_id",
        "customer_id",
        "product_category",
        "quantity",
        "unit_price",
        "status",
        "order_ts",
        F.to_date("order_ts").alias("order_date"),
        (F.col("quantity") * F.col("unit_price")).alias("order_total"),
    )


@dp.materialized_view(comment="Daily orders, units, and revenue per category, cancelled orders excluded")
def orders_daily_revenue():
    return (
        spark.read.table("orders_silver")
        .where("status <> 'cancelled'")
        .groupBy("order_date", "product_category")
        .agg(
            F.count("*").alias("orders"),
            F.sum("quantity").alias("units"),
            F.sum("order_total").alias("revenue"),
        )
    )
