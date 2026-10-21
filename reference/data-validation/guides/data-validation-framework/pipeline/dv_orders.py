"""Orders pipeline with expectations and a quarantine table.

The rules are defined once, as dictionaries. The silver table enforces them. The quarantine table
inverts the drop rules, so every row that silver drops is kept, with the names of the rules it broke.
"""

from pyspark import pipelines as dp
from pyspark.sql import functions as F

# Same rules as pipeline: in use_cases/general.yml (tests/test_dv_lib.py checks that they match).
DROP_RULES = {
    "amount_positive": "amount > 0",
    "customer_present": "customer_id IS NOT NULL",
}
WARN_RULES = {
    "status_known": "status IN ('shipped', 'pending', 'cancelled')",
}
FAIL_RULES = {
    "order_id_present": "order_id IS NOT NULL",
}

# A rule that evaluates to NULL counts as failed, on both sides.
failed_any_drop_rule = " OR ".join(f"NOT coalesce({rule}, false)" for rule in DROP_RULES.values())
broken_rule_names = F.concat_ws(
    ", ", *[F.when(~F.coalesce(F.expr(rule), F.lit(False)), F.lit(name)) for name, rule in DROP_RULES.items()]
)


@dp.materialized_view(name="dv_orders_silver", comment="Orders that pass every drop rule. Warn rules are counted and kept.")
@dp.expect_all_or_fail(FAIL_RULES)
@dp.expect_all_or_drop(DROP_RULES)
@dp.expect_all(WARN_RULES)
def dv_orders_silver():
    return spark.read.table("dv_orders_landed")  # noqa: F821


@dp.materialized_view(name="dv_orders_quarantine", comment="Orders that broke a drop rule, with the rule names.")
def dv_orders_quarantine():
    return (
        spark.read.table("dv_orders_landed")  # noqa: F821
        .where(F.expr(failed_any_drop_rule))
        .withColumn("quarantine_reasons", broken_rule_names)
        .withColumn("quarantined_at", F.current_timestamp())
    )
