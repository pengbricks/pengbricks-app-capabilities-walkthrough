"""CDC from three source shapes in one serverless Lakeflow Declarative Pipeline.

1. Debezium-style change events in JSON files -> bronze streaming table -> AUTO CDC SCD type 1
2. Delta change data feed of an operational table -> AUTO CDC SCD type 2 (status and amount only)
3. A snapshot table that is fully replaced each run -> AUTO CDC from snapshot, SCD type 2

A materialized view over the type 1 table shows incremental materialized view refresh.
Settings come from the pipeline configuration in resources/cdc.pipeline.yml.
"""

from pyspark import pipelines as dp
from pyspark.sql import functions as F

# Batch 1 has no before images, so Auto Loader cannot infer their type from it. Hint the full shape.
ORDER_STRUCT = (
    "STRUCT<order_id: BIGINT, customer_id: BIGINT, status: STRING, amount: DOUBLE, channel: STRING, updated_at: STRING>"
)
SCHEMA_HINTS = f"before {ORDER_STRUCT}, after {ORDER_STRUCT}, source.lsn BIGINT, source.ts_ms BIGINT, ts_ms BIGINT"

LANDING_PATH = spark.conf.get("cdc_landing_path")
SOURCE_TABLE = spark.conf.get("cdc_source_table")
SNAPSHOT_TABLE = spark.conf.get("cdc_snapshot_table")


# --- 1. CDC feed files: Auto Loader -> bronze -> flatten -> AUTO CDC ---------------------------


@dp.table(
    name="cdc_orders_bronze",
    comment="Raw Debezium-style change events, one row per event. Never reset by a full refresh.",
    table_properties={"pipelines.reset.allowed": "false"},
)
def cdc_orders_bronze():
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "json")
        .option("cloudFiles.inferColumnTypes", "true")
        .option("cloudFiles.schemaHints", SCHEMA_HINTS)
        .load(LANDING_PATH)
        .select("*", F.col("_metadata.file_path").alias("_source_file"), F.current_timestamp().alias("_ingested_at"))
    )


@dp.temporary_view(comment="One row per change: the after image, or the before image for a delete.")
def cdc_orders_feed():
    events = spark.readStream.table("cdc_orders_bronze")
    image = F.when(F.col("op") == "d", F.col("before")).otherwise(F.col("after"))
    return events.select(
        image.alias("row"),
        F.col("op"),
        F.col("source.lsn").alias("lsn"),
        (F.col("source.ts_ms") / 1000).cast("timestamp").alias("source_ts"),
    ).select(
        "row.order_id",
        "row.customer_id",
        "row.status",
        F.col("row.amount").cast("decimal(10,2)").alias("amount"),
        "row.channel",
        "row.updated_at",
        "op",
        "lsn",
        "source_ts",
    )


dp.create_streaming_table(
    name="cdc_orders_scd1",
    comment="Latest state of each order from the change events (SCD type 1).",
    table_properties={"delta.enableRowTracking": "true"},
)

# keys identify the row, sequence_by orders events (a late event with a lower LSN is dropped),
# and apply_as_deletes marks deletes. The flow name is its checkpoint identity: rename it and
# the flow starts over from a new checkpoint.
dp.create_auto_cdc_flow(
    name="cdc_orders_scd1_flow",
    target="cdc_orders_scd1",
    source="cdc_orders_feed",
    keys=["order_id"],
    sequence_by="lsn",
    apply_as_deletes=F.expr("op = 'd'"),
    except_column_list=["op", "lsn"],
    stored_as_scd_type=1,
)


# --- 2. Delta change data feed of an operational table -> AUTO CDC SCD type 2 -----------------


# The stream's checkpoint stores the last Delta table version of cdc_orders_source it processed.
# readChangeFeed adds _change_type, _commit_version and _commit_timestamp to each row.
@dp.temporary_view(comment="Change data feed of cdc_orders_source without the pre-update images.")
def cdc_orders_changes():
    return (
        spark.readStream.option("readChangeFeed", "true")
        .table(SOURCE_TABLE)
        .where("_change_type != 'update_preimage'")
    )


dp.create_streaming_table(
    name="cdc_orders_from_cdf",
    comment="Order history from the change data feed (SCD type 2, status and amount tracked).",
)

dp.create_auto_cdc_flow(
    name="cdc_orders_from_cdf_flow",
    target="cdc_orders_from_cdf",
    source="cdc_orders_changes",
    keys=["order_id"],
    sequence_by="_commit_version",
    apply_as_deletes=F.expr("_change_type = 'delete'"),
    except_column_list=["_change_type", "_commit_version", "_commit_timestamp"],
    stored_as_scd_type=2,
    track_history_column_list=["status", "amount"],
)


# --- 3. Snapshot-only source -> AUTO CDC from snapshot, SCD type 2 ----------------------------

dp.create_streaming_table(
    name="cdc_orders_snapshot_scd2",
    comment="Order history derived by comparing each full snapshot with the previous one (SCD type 2).",
)

dp.create_auto_cdc_from_snapshot_flow(
    target="cdc_orders_snapshot_scd2",
    source=SNAPSHOT_TABLE,
    keys=["order_id"],
    stored_as_scd_type=2,
)


# --- Materialized view over the type 1 table: incremental refresh -----------------------------


@dp.materialized_view(
    name="cdc_orders_daily",
    comment="Orders and revenue per day, channel and status. Refreshes incrementally when it can.",
)
def cdc_orders_daily():
    return (
        spark.read.table("cdc_orders_scd1")
        .groupBy(F.to_date("updated_at").alias("order_date"), "channel", "status")
        .agg(F.count("*").alias("orders"), F.sum("amount").alias("revenue"))
    )
