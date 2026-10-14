"""The accounts entity: initial snapshot and change batch, both generated from the spec."""

from __future__ import annotations

from typing import Any

from de_common.datagen import build_frame
from de_common.spec import plan_changes


def entity_columns(spec: dict[str, Any]) -> list[str]:
    return [column["name"] for column in spec["accounts"]["columns"]]


def _base(spark, spec: dict[str, Any]):
    accounts = spec["accounts"]
    changes = accounts["changes"]
    # Generate the initial rows plus the new keys in one pass so ids line up.
    total = int(accounts["rows"]) + int(changes["inserts"])
    return build_frame(spark, "accounts", int(spec["seed"]) + 100, total, accounts["columns"])


def initial_snapshot(spark, spec: dict[str, Any]):
    rows = int(spec["accounts"]["rows"])
    return _base(spark, spec).where(f"id < {rows}").select(*entity_columns(spec))


def change_batch(spark, spec: dict[str, Any]):
    """Rows with change_type INSERT, UPDATE, or DELETE."""
    from pyspark.sql import functions as F

    accounts = spec["accounts"]
    plan = plan_changes(int(accounts["rows"]), **{k: int(v) for k, v in accounts["changes"].items()})
    columns = entity_columns(spec)
    base = _base(spark, spec)

    def pick(ids: list[int]):
        return base.where(F.col("id").isin(ids))

    inserts = pick(plan["insert_ids"]).select(*columns, F.lit("INSERT").alias("change_type"))
    deletes = pick(plan["delete_ids"]).select(*columns, F.lit("DELETE").alias("change_type"))
    update_exprs = accounts["update_exprs"]
    update_columns = [f"{update_exprs[name]} AS {name}" if name in update_exprs else name for name in columns]
    updates = pick(plan["update_ids"]).selectExpr(*update_columns, "'UPDATE' AS change_type")
    return inserts.unionByName(updates).unionByName(deletes)
