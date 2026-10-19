from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from governance_lib.analysis import max_concurrency, over_budget, percentile  # noqa: E402
from governance_lib.datagen import table_frame  # noqa: E402
from governance_lib.spec import load_spec  # noqa: E402
from governance_lib.sqlgen import (  # noqa: E402
    IndividualGrantError,
    attribute_filter_body,
    dynamic_filter_body,
    grant_sql,
    mask_body,
    mask_expression,
    mask_function_sql,
    principal_kind,
    qualified,
    quote,
)

SPEC = load_spec(ROOT / "use_cases" / "general.yml")


def test_spec_declares_two_masked_columns_and_both_environments():
    assert len(SPEC["policy"]["masked_columns"]) == 2
    assert set(SPEC["access"]["environments"]) == {"dev", "prod"}
    for item in SPEC["policy"]["masked_columns"]:
        assert item["column"] in {c["name"] for c in SPEC["tables"][item["table"]]["columns"]}


def test_prod_is_narrower_than_dev():
    dev, prod = SPEC["access"]["environments"]["dev"], SPEC["access"]["environments"]["prod"]
    assert "MODIFY" in dev["privileges"] and "MODIFY" not in prod["privileges"]
    assert prod["table_privileges"] == {"orders": ["SELECT"]}


def test_principal_kind():
    assert principal_kind("someone@example.com") == "user"
    assert principal_kind("00000000-1111-2222-3333-444444444444") == "service_principal"
    assert principal_kind("capability-guides-readers") == "group"


def test_grant_refuses_individual_users():
    with pytest.raises(IndividualGrantError):
        grant_sql(["SELECT"], "TABLE", "c.s.t", "someone@example.com")


def test_grant_sql_shape_and_unknown_privilege():
    assert grant_sql(["USE_SCHEMA", "SELECT"], "SCHEMA", qualified("c", "s"), "readers") == \
        "GRANT USE SCHEMA, SELECT ON SCHEMA `c`.`s` TO `readers`"
    with pytest.raises(ValueError):
        grant_sql(["DROP_EVERYTHING"], "SCHEMA", "`c`.`s`", "readers")


def test_quote_rejects_injection():
    with pytest.raises(ValueError):
        quote("x`; DROP TABLE y; --")


def test_mask_checks_session_user_before_membership():
    body = mask_body("email", "v", "account users", "admins")
    assert body.index("session_user()") < body.index("is_member(")
    assert "THEN NULL" in body


def test_mask_expressions():
    assert mask_expression("national_id", "v") == "concat('***-**-', right(v, 4))"
    with pytest.raises(ValueError):
        mask_expression("unknown", "v")
    assert "CREATE OR REPLACE FUNCTION f(v STRING)" in mask_function_sql("f", "email", "account users", "admins")


def test_twin_swaps_identity_literals():
    body = dynamic_filter_body("region", "t", "account users", "admins", session="'sp-id'", member="false")
    assert "session_user()" not in body and "'sp-id'" in body
    assert attribute_filter_body("sensitivity", "restricted", "admins", member="false").startswith("(false OR")


def test_table_frame_uses_spec_columns_and_row_counts():
    from unittest import mock

    with mock.patch("sample_data.generate") as generate:
        table_frame(None, SPEC, "orders", rows=7)
    args, kwargs = generate.call_args
    assert [c["name"] for c in args[1]] == [c["name"] for c in SPEC["tables"]["orders"]["columns"]]
    assert kwargs["rows"] == 7 and kwargs["seed"] == int(SPEC["seed"])


def test_max_concurrency():
    assert max_concurrency([(0, 10), (5, 15), (8, 9)]) == 3
    assert max_concurrency([(0, 5), (5, 10)]) == 1
    assert max_concurrency([]) == 0


def test_percentile_and_budget():
    assert percentile([1, 2, 3, 4, 5], 50) == 3
    assert percentile([1, 2, 3, 4, 5], 95) == 5
    assert percentile([], 95) == 0.0
    assert over_budget(100.6, 50) and not over_budget(50, 50)


def test_shared_schema_tables_are_prefixed_but_demo_tables_keep_names():
    assert SPEC["shared_table_prefix"] == "gov_"
    assert set(SPEC["tables"]) == {"customers", "orders"}
    assert set(SPEC["access"]["rows_per_table"]) == {"customers", "orders"}
