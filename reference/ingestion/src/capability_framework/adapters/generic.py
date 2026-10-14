"""Generic adapter: read files with configured options and apply the configured column mapping."""

from __future__ import annotations

from ..config import CANONICAL_COLUMNS, FeedConfig


def mapping_select(config: FeedConfig) -> list[str]:
    return [f"{config.mapping[column]} AS {column}" for column in CANONICAL_COLUMNS]


def read_raw(spark, config: FeedConfig, landing_path: str):
    return spark.read.format(config.format).options(**config.options).load(landing_path)


def read(spark, config: FeedConfig, landing_path: str):
    return read_raw(spark, config, landing_path).selectExpr(*mapping_select(config))
