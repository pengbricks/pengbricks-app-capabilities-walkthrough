import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import apps_lib as a  # noqa: E402

NOW = datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc)
APP_YAML = (ROOT / "app" / "app.yaml").read_text()


def app(**overrides):
    base = {
        "name": "cg-apps-demo",
        "url": "https://cg-apps-demo.example.databricksapps.com",
        "compute_size": "MEDIUM",
        "app_status": {"state": "RUNNING"},
        "compute_status": {"state": "ACTIVE"},
        "update_time": "2026-10-20T12:00:00Z",
        "user_api_scopes": ["sql"],
        "resources": [{"name": "sql-warehouse", "sql_warehouse": {"id": "abc", "permission": "CAN_USE"}}],
        "active_deployment": {
            "deployment_id": "d1",
            "source_code_path": "/Workspace/x/app",
            "status": {"state": "SUCCEEDED"},
            "update_time": "2026-10-20T12:00:00Z",
        },
        "service_principal_name": "app-123 cg-apps-demo",
        "service_principal_client_id": "client-1",
    }
    base.update(overrides)
    return base


# ---- app.yaml -------------------------------------------------------------------------------------------

def test_app_yaml_parses_command_and_env():
    parsed = a.parse_app_yaml(APP_YAML)
    assert parsed["command"] == ["python", "app.py"]
    by_name = {e.name: e for e in parsed["env"]}
    assert by_name["WAREHOUSE_ID"].value_from == "sql-warehouse" and by_name["WAREHOUSE_ID"].value is None
    assert by_name["SHARED_SCHEMA_PATTERN"].value == "%capability_guides"


def test_empty_app_yaml_is_valid():
    assert a.parse_app_yaml("") == {"command": [], "env": []}


@pytest.mark.parametrize("text", ["env:\n  - value: x\n", "env:\n  - name: A\n", "env:\n  - name: A\n    value: x\n    valueFrom: k\n"])
def test_bad_env_entries_are_rejected(text):
    with pytest.raises(ValueError):
        a.parse_app_yaml(text)


def test_resolve_env_uses_resource_values_and_keeps_fixed_values():
    env = a.parse_app_yaml(APP_YAML)["env"]
    assert a.resolve_env(env, {"sql-warehouse": "wh1"}) == {"WAREHOUSE_ID": "wh1", "SHARED_SCHEMA_PATTERN": "%capability_guides"}


def test_resolve_env_fails_on_unknown_key():
    env = a.parse_app_yaml(APP_YAML)["env"]
    with pytest.raises(KeyError, match="sql-warehouse"):
        a.resolve_env(env, {"other": "x"})


def test_value_from_keys_are_listed_once_in_order():
    env = a.parse_app_yaml("env:\n  - {name: A, valueFrom: k1}\n  - {name: B, valueFrom: k2}\n  - {name: C, valueFrom: k1}\n")["env"]
    assert a.value_from_keys(env) == ["k1", "k2"]


def test_every_value_from_key_in_app_yaml_is_declared_in_the_bundle():
    bundle = yaml.safe_load((ROOT / "resources" / "databricks_apps.app.yml").read_text())
    declared = [r["name"] for r in bundle["resources"]["apps"]["databricks_apps_demo"]["resources"]]
    assert a.missing_resource_keys(a.parse_app_yaml(APP_YAML)["env"], declared) == []


def test_bundle_declares_medium_compute_sql_scope_and_can_use():
    demo = yaml.safe_load((ROOT / "resources" / "databricks_apps.app.yml").read_text())["resources"]["apps"]["databricks_apps_demo"]
    assert demo["compute_size"] == "MEDIUM"
    assert demo["user_api_scopes"] == ["sql"]
    assert demo["resources"][0]["sql_warehouse"]["permission"] == "CAN_USE"


def test_app_reads_the_forwarded_token_header():
    source = (ROOT / "app" / "app.py").read_text()
    assert "x_forwarded_access_token" in source and 'auth_type="pat"' in source


# ---- reading an app -----------------------------------------------------------------------------------------

def test_describe_resource_names_type_and_permission():
    assert a.describe_resource(app()["resources"][0]) == {"name": "sql-warehouse", "type": "sql_warehouse", "permission": "CAN_USE"}
    assert a.describe_resource({"name": "x"})["type"] == "unknown"


def test_compute_size_defaults_to_medium_and_sets_the_rate():
    assert a.compute_size_of({}) == "MEDIUM" and a.dbu_per_hour({}) == 0.5
    assert a.dbu_per_hour({"compute_size": "LARGE"}) == 1.0
    assert a.dbu_per_hour({"compute_size": "XLARGE"}) == 3.0


def test_inventory_row_is_flat_and_complete():
    row = a.inventory_row(app(), "run-1", NOW)
    assert set(row) == set(a.INVENTORY_COLUMNS)
    assert row["resources"] == "sql-warehouse (sql_warehouse, CAN_USE)"
    assert row["user_api_scopes"] == "sql" and row["deployment_state"] == "SUCCEEDED" and row["dbu_per_hour"] == 0.5


def test_inventory_row_handles_an_app_with_no_deployment():
    row = a.inventory_row(app(active_deployment=None, resources=None, user_api_scopes=None), "r", NOW)
    assert row["deployment_state"] == "NONE" and row["resources"] == "" and row["source_code_path"] == ""


def test_inventory_merge_keys_on_app_name_so_a_rerun_updates_one_row():
    sql = a.inventory_merge_sql("c.s.databricks_apps_inventory", a.inventory_row(app(), "run-1", NOW))
    assert "ON t.app_name = s.app_name" in sql
    assert "WHEN MATCHED THEN UPDATE SET *" in sql and "WHEN NOT MATCHED THEN INSERT *" in sql
    assert sql.count("MERGE INTO") == 1 and "INSERT INTO" not in sql
    again = a.inventory_merge_sql("c.s.databricks_apps_inventory", a.inventory_row(app(), "run-1", NOW))
    assert again == sql


def test_inventory_merge_escapes_quotes():
    sql = a.inventory_merge_sql("t", a.inventory_row(app(name="it's"), "r", NOW))
    assert "'it''s' AS app_name" in sql


# ---- cost and idle ----------------------------------------------------------------------------------------------

def test_only_running_apps_bill():
    assert a.is_billing(app())
    assert not a.is_billing(app(app_status={"state": "UNAVAILABLE"}, compute_status={"state": "STOPPED"}))
    assert not a.is_billing(app(app_status={"state": "CRASHED"}))
    assert not a.is_billing(app(app_status={"state": "DEPLOYING"}))


def test_monthly_dbu_is_zero_when_not_billing():
    assert a.monthly_dbu(app()) == 365.0
    assert a.monthly_dbu(app(app_status={"state": "UNAVAILABLE"})) == 0.0


def test_idle_needs_running_and_an_old_change():
    old = "2026-09-01T00:00:00Z"
    old_app = app(update_time=old, active_deployment={"update_time": old})
    assert a.is_idle(old_app, NOW, 14)
    assert not a.is_idle(app(), NOW, 14)


def test_stopped_apps_are_never_flagged_idle():
    old = "2026-01-01T00:00:00Z"
    stopped = app(update_time=old, active_deployment={"update_time": old}, app_status={"state": "UNAVAILABLE"}, compute_status={"state": "STOPPED"})
    assert not a.is_idle(stopped, NOW, 14)
    assert a.cost_row(stopped, NOW, 14)["flag"] == "not billing"


def test_idle_uses_the_newest_of_update_and_deployment_time():
    recent = app(update_time="2026-01-01T00:00:00Z", active_deployment={"update_time": "2026-10-20T00:00:00Z"})
    assert not a.is_idle(recent, NOW, 14)


def test_running_app_with_no_timestamps_counts_as_idle():
    assert a.is_idle(app(update_time=None, active_deployment=None), NOW, 14)


def test_idle_boundary_is_inclusive():
    edge = (NOW - timedelta(days=14)).isoformat()
    assert a.is_idle(app(update_time=edge, active_deployment=None), NOW, 14)


def test_cost_row_labels():
    assert a.cost_row(app(), NOW, 14)["flag"] == "running"
    old = app(update_time="2026-01-01T00:00:00Z", active_deployment=None)
    row = a.cost_row(old, NOW, 14)
    assert row["flag"] == "running and idle" and row["dbu_per_month_if_running"] == 365.0


# ---- cleanup: stop or no-op ------------------------------------------------------------------------------------

def test_cleanup_keeps_the_app_unless_stop_app_is_true():
    for value in ("false", "", "no", "False "):
        assert a.cleanup_action(app(), value) == "keep"


def test_cleanup_stops_a_running_app():
    assert a.cleanup_action(app(), "true") == "stop"
    assert a.cleanup_action(app(), " TRUE ") == "stop"


def test_cleanup_is_a_no_op_for_a_stopped_or_stopping_app():
    assert a.cleanup_action(app(compute_status={"state": "STOPPED"}), "true") == "noop_already_stopped"
    assert a.cleanup_action(app(compute_status={"state": "STOPPING"}), "true") == "noop_already_stopped"


def test_cleanup_is_a_no_op_for_a_missing_app():
    assert a.cleanup_action(None, "true") == "noop_missing"
    assert a.cleanup_action(None, "false") == "keep"


def test_second_cleanup_after_a_stop_does_nothing():
    first = a.cleanup_action(app(), "true")
    after = app(compute_status={"state": "STOPPED"}, app_status={"state": "UNAVAILABLE"})
    assert (first, a.cleanup_action(after, "true")) == ("stop", "noop_already_stopped")


# ---- App Spaces ----------------------------------------------------------------------------------------------------

def test_spaces_preview_status():
    assert a.spaces_preview_status(None) == "on"
    assert a.spaces_preview_status(RuntimeError("403")) == "off or no access"


def test_ui_steps_name_the_preview_toggle():
    assert any("Governed agentic app-building" in s for s in a.UI_STEPS)


# ---- job and notebooks ------------------------------------------------------------------------------------------------

JOB = yaml.safe_load((ROOT / "resources" / "databricks_apps.job.yml").read_text())["resources"]["jobs"]["capability_guides_databricks_apps"]
GUIDE = ROOT / "guides" / "databricks-apps"


def test_job_is_tagged_serverless_and_keeps_the_demo_by_default():
    assert JOB["tags"]["capability_guide_job"] == "capability_guides_databricks_apps"
    assert "job_clusters" not in JOB and not any("new_cluster" in t or "existing_cluster_id" in t for t in JOB["tasks"])
    assert {p["name"]: p["default"] for p in JOB["parameters"]}["stop_app"] == "false"


def first_markdown_cell(text):
    for cell in text.split("# COMMAND ----------"):
        if "# MAGIC %md" in cell:
            return cell
    return ""


def test_every_notebook_exists_and_its_first_markdown_cell_says_safe_to_rerun():
    paths = [(ROOT / "resources" / t["notebook_task"]["notebook_path"]).resolve() for t in JOB["tasks"]] + [GUIDE / "00_start_here.py"]
    for path in paths:
        text = path.read_text()
        assert text.startswith("# Databricks notebook source"), path
        assert "Safe to rerun" in first_markdown_cell(text), path


def test_cleanup_runs_even_after_a_failure():
    cleanup = next(t for t in JOB["tasks"] if t["task_key"] == "cleanup")
    assert cleanup["run_if"] == "ALL_DONE"


def test_notebooks_name_the_cost():
    for path in sorted(GUIDE.glob("0[0-5]_*.py")):
        if path.name.startswith(("01", "05", "00")):
            assert "0.5 DBU" in path.read_text(), path.name


def test_notebook_text_has_no_em_dash():
    for path in [*GUIDE.glob("*.py"), ROOT / "src" / "apps_lib.py"]:
        assert "—" not in path.read_text(), path.name
