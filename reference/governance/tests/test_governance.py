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


# --- Warehouse type audit -------------------------------------------------------------------

from governance_lib import edm, warehouses  # noqa: E402
from governance_lib.edm_api import lineage_object, ref_name, related_names  # noqa: E402


def test_warehouse_class_reads_the_serverless_flag():
    assert warehouses.warehouse_class("PRO", True) == "serverless"
    assert warehouses.warehouse_class("PRO", False) == "pro"
    assert warehouses.warehouse_class("PRO", None) == "pro"
    assert warehouses.warehouse_class("CLASSIC", True) == "classic"
    assert warehouses.warehouse_class(None, None) == "unknown"
    assert warehouses.warehouse_class("TYPE_UNSPECIFIED", False) == "unknown"


def test_auto_stop_flag_uses_the_documented_default_per_type():
    assert warehouses.auto_stop_flag("serverless", 10) is None
    assert warehouses.auto_stop_flag("serverless", 11)
    assert warehouses.auto_stop_flag("pro", 45) is None
    assert warehouses.auto_stop_flag("classic", 60)
    assert "off" in warehouses.auto_stop_flag("pro", 0)
    assert warehouses.auto_stop_flag("pro", None) is None


def test_audit_row_flags_not_serverless_and_long_auto_stop():
    good = warehouses.audit_row("a", "bi", "PRO", True, "Small", 1, 2, 10, "RUNNING")
    assert good["is_serverless"] and not good["flagged"] and good["flags"] == ""
    bad = warehouses.audit_row("b", "etl", "CLASSIC", False, "Large", 1, 1, 120, "STOPPED")
    assert bad["flagged"] and bad["warehouse_class"] == "classic"
    assert bad["flags"].count("|") == 1 and bad["auto_stop_default_minutes"] == 45
    assert warehouses.audit_row("c", "x", "PRO", False, None, None, None, None, None)["size"] == ""


def test_serverless_request_sets_both_fields():
    body = warehouses.serverless_request_body("w")
    assert body["warehouse_type"] == "PRO" and body["enable_serverless_compute"] is True


# --- Unity Catalog and EDM ------------------------------------------------------------------


def test_plan_upsert_creates_missing_and_updates_existing():
    plan = edm.plan_upsert({"a", "z"}, ["a", "b", "b"])
    assert plan == {"create": ["b"], "update": ["a"], "extra": ["z"]}
    assert edm.plan_upsert([], []) == {"create": [], "update": [], "extra": []}
    # A second pass after creating everything finds nothing to create.
    assert edm.plan_upsert({"a", "b"}, ["a", "b"])["create"] == []


def test_plan_removal_only_touches_prefixed_names_and_is_a_noop_when_empty():
    assert edm.plan_removal(["edm_external_x", "other", "edm_external_a"], edm.EXTERNAL_PREFIX) == ["edm_external_a", "edm_external_x"]
    assert edm.plan_removal([], edm.EXTERNAL_PREFIX) == []
    assert edm.plan_removal(["other"], edm.EXTERNAL_PREFIX) == []


def test_contract_mode_needs_every_column_tag_governed_and_applied():
    governed = [{"column_name": "a", "tag_kind": "governed", "applied": True}, {"column_name": None, "tag_kind": "plain", "applied": True}]
    assert edm.contract_mode(governed) == "governed"
    assert edm.contract_mode(governed + [{"column_name": "b", "tag_kind": "plain", "applied": True}]) == "plain"
    assert edm.contract_mode([{"column_name": "a", "tag_kind": "governed", "applied": False}]) == "plain"
    assert edm.contract_mode([]) == "plain"


def test_tag_sql_uses_documented_forms():
    assert edm.set_tag_sql("COLUMN", "t.c", "k", "v") == "SET TAG ON COLUMN t.c `k` = `v`"
    assert edm.set_tag_sql("TABLE", "t", "k") == "SET TAG ON TABLE t `k`"
    assert edm.alter_tag_sql("t", "k", "o'v") == "ALTER TABLE t SET TAGS ('k' = 'o''v')"
    assert "UNSET TAGS" in edm.unset_tag_sql("t", "k", "c")
    with pytest.raises(ValueError):
        edm.set_tag_sql("SCHEMA", "t", "k")


def test_policy_sql_matches_on_tags_and_drops_safely():
    mask = edm.mask_policy_sql("p", "`c`.`s`.`t`", "`c`.`s`.`f`", "account users", "edm_pii", "id_number")
    assert "COLUMN MASK" in mask and "has_tag_value('edm_pii', 'id_number')" in mask and "TO `account users`" in mask
    row = edm.row_filter_policy_sql("p2", "`c`.`s`.`t`", "`c`.`s`.`f`", "account users", "edm_region")
    assert "ROW FILTER" in row and "has_tag('edm_region')" in row and "USING COLUMNS (region)" in row
    assert edm.drop_policy_sql("p", "`c`.`s`.`t`") == "DROP POLICY `p` ON TABLE `c`.`s`.`t`"
    assert edm.policy_missing(Exception("[POLICY_NOT_FOUND] The policy `p` does not exist"))
    assert not edm.policy_missing(Exception("[PERMISSION_DENIED] no MANAGE"))
    with pytest.raises(ValueError):
        edm.drop_policy_sql("p`; DROP", "t")


def test_scanner_grants_are_least_privilege():
    grants = edm.scanner_grants("edm-scanner", "cat", "sch")
    assert all(g.endswith("TO `edm-scanner`") for g in grants)
    assert not any("ALL PRIVILEGES" in g or "MODIFY" in g or "MANAGE" in g for g in grants)
    assert "GRANT SELECT ON TABLE `system`.`access`.`column_lineage` TO `edm-scanner`" in grants
    assert sum("SELECT ON TABLE `cat`.`sch`" in g for g in grants) == len(edm.SAMPLE_TABLES)
    with pytest.raises(IndividualGrantError):
        edm.scanner_grants("someone@example.com", "cat", "sch")


def test_feed_queries_are_scoped_to_the_sample_tables():
    queries = edm.feed_queries("cat", "sch")
    assert set(queries) == {f"edm_metadata_feed_{n}" for n in ("tables", "columns", "tags", "privileges", "table_lineage", "column_lineage")}
    for sql in queries.values():
        assert "edm_customers" in sql
    assert "information_schema.column_tags" in queries["edm_metadata_feed_tags"]
    assert "system.access.column_lineage" in queries["edm_metadata_feed_column_lineage"]


def test_external_objects_use_prefixed_names_and_example_urls():
    plan = edm.external_objects("cat", "sch")
    names = {m["name"] for m in plan["metadata"]}
    assert all(n.startswith(edm.EXTERNAL_PREFIX) for n in names)
    assert all("example.com" in m["url"] for m in plan["metadata"])
    for rel in plan["relationships"]:
        ends = [rel["source"], rel["target"]]
        assert any("external" in e for e in ends) and any("table" in e for e in ends)
        assert all(e["external"] in names for e in ends if "external" in e)


def test_certification_sql():
    assert edm.certification_sql("t") == "SET TAG ON TABLE t `system.certification_status` = `certified`"


class _Info:
    def __init__(self, table=None, external=None):
        self.table_info = table
        self.external_metadata_info = external


class _Lineage:
    def __init__(self, infos):
        self.infos = infos

    def list_external_lineage_relationships(self, object_info, lineage_direction, **_):
        return iter(self.infos)


def test_related_names_collects_tables_and_external_objects():
    from types import SimpleNamespace as NS

    w = NS(external_lineage=_Lineage([
        _Info(table=NS(catalog_name="c", schema_name="s", name="t")),
        _Info(external=NS(name="edm_external_x")),
    ]))
    assert related_names(w, {"table": "c.s.t"}, "UPSTREAM") == {"c.s.t", "edm_external_x"}
    assert related_names(NS(external_lineage=_Lineage([])), {"external": "x"}, "DOWNSTREAM") == set()
    assert ref_name({"table": "a"}) == "a" and ref_name({"external": "b"}) == "b"
    assert lineage_object({"table": "c.s.t"}).table.name == "c.s.t"
    assert lineage_object({"external": "x"}).external_metadata.name == "x"


def test_normalize_tag_mode():
    assert edm.normalize_tag_mode("plain") == "plain"
    assert edm.normalize_tag_mode(" Governed ") == "governed"
    assert edm.normalize_tag_mode("") == "governed" and edm.normalize_tag_mode(None) == "governed"
    with pytest.raises(ValueError):
        edm.normalize_tag_mode("both")


def test_contract_mode_is_plain_when_plain_tags_were_requested():
    rows = [{"column_name": "a", "tag_kind": "plain", "applied": True}, {"column_name": None, "tag_kind": "plain", "applied": True}]
    assert edm.contract_mode(rows) == "plain"
