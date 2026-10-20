from __future__ import annotations

import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from layout_lib import Facts, build_findings, classify_layout, environment_of, principal_kind, short_name, three_level_name  # noqa: E402

SP = "00000000-1111-2222-3333-444444444444"


def facts(**overrides) -> Facts:
    base = dict(
        environment="dev",
        catalog="analytics",
        schema="dev_rob_peng_envdemo",
        schema_names=["information_schema", "dev_rob_peng_envdemo"],
        user_name="rob.peng@example.com",
        isolation_mode="ISOLATED",
        owner=SP,
        has_managed_location=True,
        bindings=[(1, "BINDING_TYPE_READ_WRITE")],
        workspace_id=1,
        schema_tag="dev",
        schema_grants={},
    )
    base.update(overrides)
    return Facts(**base)


def by_check(findings):
    return {f.check: f for f in findings}


@pytest.mark.parametrize(
    "name,expected",
    [("dev", "dev"), ("prod_sales", "prod"), ("sales_stage", "stage"), ("dev_rob_peng_envdemo", "dev"), ("test-orders", "test"), ("analytics", None), ("production", None), ("", None)],
)
def test_environment_of(name, expected):
    assert environment_of(name) == expected


def test_classify_layout():
    assert classify_layout("prod", ["sales"]) == "a"
    assert classify_layout("prod_sales", ["reporting"]) == "b"
    assert classify_layout("analytics", ["information_schema", "dev_sales", "prod_sales"]) == "c"
    assert classify_layout("analytics", ["information_schema", "raw"]) == "unknown"


def test_three_level_names_for_each_layout():
    assert three_level_name("a", "prod") == "prod.sales.daily_revenue"
    assert three_level_name("b", "stage") == "stage_sales.reporting.daily_revenue"
    assert three_level_name("c", "test") == "analytics.test_sales.daily_revenue"
    with pytest.raises(ValueError):
        three_level_name("d", "dev")


def test_principals_and_short_names():
    assert principal_kind("rob.peng@example.com") == "user"
    assert principal_kind(SP) == "service principal"
    assert principal_kind("prod-readers") == "group"
    assert short_name("Rob.Peng@example.com") == "rob_peng"


def test_single_catalog_layout_warns_about_the_missing_boundary():
    found = by_check(build_findings(facts()))
    assert found["layout"].finding.startswith("Layout (c)")
    assert found["boundary"].status == "warn"
    assert found["environments"].status == "info" and "Missing: test, stage, prod" in found["environments"].finding
    assert found["sandbox"].status == "pass"
    assert found["isolation"].status == "pass"
    assert found["owner"].status == "pass"
    assert found["tag"].status == "pass"


def test_open_catalog_owned_by_a_person_is_flagged():
    found = by_check(build_findings(facts(isolation_mode="OPEN", owner="rob.peng@example.com", has_managed_location=False)))
    assert found["isolation"].status == "warn"
    assert found["owner"].status == "warn"
    assert found["storage"].status == "warn"


def test_two_bound_workspaces_are_called_out_in_layout_c():
    found = by_check(build_findings(facts(bindings=[(1, "BINDING_TYPE_READ_WRITE"), (2, "BINDING_TYPE_READ_ONLY")])))
    assert "2 workspaces are bound" in found["boundary"].finding
    assert "read-only" in found["bindings"].finding


def test_unreadable_bindings_and_grants_are_info():
    found = by_check(build_findings(facts(bindings=None, schema_grants=None)))
    assert found["bindings"].status == "info"
    assert found["grants"].status == "info"


def test_all_four_environments_pass():
    names = ["information_schema", "dev_rob_peng_envdemo", "test_envdemo", "stage_envdemo", "prod_envdemo"]
    assert by_check(build_findings(facts(schema_names=names)))["environments"].status == "pass"


def test_prod_schema_flags_people_with_write_access():
    prod = facts(environment="prod", schema="prod_envdemo", schema_tag="prod", schema_grants={"rob.peng@example.com": ["MODIFY"], "prod-readers": ["SELECT"]})
    assert by_check(build_findings(prod))["grants"].status == "warn"
    clean = facts(environment="prod", schema="prod_envdemo", schema_tag="prod", schema_grants={"prod-readers": ["SELECT"], SP: ["ALL_PRIVILEGES"]})
    assert by_check(build_findings(clean))["grants"].status == "pass"


def test_prod_schema_owned_by_a_person_warns_but_dev_does_not():
    prod = facts(environment="prod", schema="prod_envdemo", schema_tag="prod", schema_owner="rob.peng@example.com")
    assert by_check(build_findings(prod))["schema_owner"].status == "warn"
    assert by_check(build_findings(facts(schema_owner="rob.peng@example.com")))["schema_owner"].status == "info"
    owned = facts(environment="prod", schema="prod_envdemo", schema_tag="prod", schema_owner=SP)
    assert by_check(build_findings(owned))["schema_owner"].status == "pass"


def test_catalog_per_environment_gets_its_own_boundary():
    found = by_check(build_findings(facts(environment="prod", catalog="prod_sales", schema="reporting", schema_names=["reporting"], schema_tag="prod")))
    assert found["layout"].finding.startswith("Layout (b)")
    assert found["boundary"].status == "pass"


def test_wrong_tag_and_shared_dev_schema_warn():
    found = by_check(build_findings(facts(schema="shared_dev", schema_tag=None)))
    assert found["sandbox"].status == "warn"
    assert found["tag"].status == "warn"


def test_targets_map_each_environment_to_its_own_schema():
    bundle = yaml.safe_load((ROOT / "databricks.yml").read_text())
    targets = bundle["targets"]
    assert list(targets) == ["dev", "test", "stage", "prod"]
    for env in ("test", "stage", "prod"):
        assert targets[env]["mode"] == "production"
        assert targets[env]["presets"]["name_prefix"] == f"[{env}] "
        assert targets[env]["variables"]["environment"] == env
    assert targets["dev"]["mode"] == "development"
    # The four-workspace example keeps the same four target names
    example = yaml.safe_load((ROOT / "setup" / "databricks.four-workspaces.yml.example").read_text())
    assert list(example["targets"]) == ["dev", "test", "stage", "prod"]
