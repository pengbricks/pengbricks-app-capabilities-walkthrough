"""Shared validation: rules come from feed configuration and compile to Spark SQL."""

from __future__ import annotations

from .config import Rule


def rule_to_sql(rule: Rule) -> str:
    if rule.type == "not_null":
        return f"`{rule.column}` IS NOT NULL"
    if rule.type == "allowed_values":
        quoted = ", ".join("'" + value.replace("'", "''") + "'" for value in rule.values)
        return f"`{rule.column}` IN ({quoted})"
    if rule.type == "expression":
        if not rule.expr:
            raise ValueError(f"Rule {rule.name} needs expr")
        return rule.expr
    raise ValueError(f"Unsupported rule type {rule.type} in rule {rule.name}")


def quarantine_reasons_sql(rules: tuple[Rule, ...]) -> str:
    """Return a SQL expression producing an array of failed rule names (empty when valid)."""
    if not rules:
        return "CAST(array() AS ARRAY<STRING>)"
    cases = ", ".join(
        f"CASE WHEN NOT coalesce(({rule_to_sql(rule)}), false) THEN '{rule.name}' END" for rule in rules
    )
    return f"filter(array({cases}), reason -> reason IS NOT NULL)"


def split_valid(df, rules: tuple[Rule, ...]):
    """Split a DataFrame into (valid, quarantined); quarantined rows carry their failed rule names."""
    from pyspark.sql import functions as F

    flagged = df.withColumn("_quarantine_reasons", F.expr(quarantine_reasons_sql(rules)))
    valid = flagged.filter(F.size("_quarantine_reasons") == 0).drop("_quarantine_reasons")
    quarantined = flagged.filter(F.size("_quarantine_reasons") > 0)
    return valid, quarantined
