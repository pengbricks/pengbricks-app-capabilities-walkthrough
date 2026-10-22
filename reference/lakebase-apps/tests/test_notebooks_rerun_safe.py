"""Static checks that every guide notebook can run twice. They read the notebook source only."""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
GUIDE = ROOT / "guides" / "lakebase-apps"
NOTEBOOKS = sorted(GUIDE.glob("0*.py"))


def source(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def code_of(path: Path) -> str:
    """The notebook with markdown cells removed."""
    return "\n".join(line for line in source(path).splitlines() if not line.startswith("# MAGIC"))


def test_one_notebook_per_task_plus_start_here():
    job = yaml.safe_load((ROOT / "resources" / "lakebase_apps.job.yml").read_text())["resources"]["jobs"]["capability_guides_lakebase_apps"]
    paths = {t["notebook_task"]["notebook_path"].split("/")[-1] for t in job["tasks"]}
    assert paths == {p.name for p in NOTEBOOKS if p.name != "00_start_here.py"}
    assert job["tags"]["capability_guide_job"] == "capability_guides_lakebase_apps"


def test_job_parameters_are_the_widgets_the_notebooks_read():
    job = yaml.safe_load((ROOT / "resources" / "lakebase_apps.job.yml").read_text())["resources"]["jobs"]["capability_guides_lakebase_apps"]
    names = {p["name"] for p in job["parameters"]}
    for path in NOTEBOOKS:
        for match in re.finditer(r"load_params\(dbutils, \"[a-z_]+\", \[([^\]]*)\]", code_of(path)):
            for widget in re.findall(r"'(\w+)'", match.group(1)):
                assert widget in names, f"{path.name} reads {widget}, which is not a job parameter"


@pytest.mark.parametrize("path", NOTEBOOKS, ids=lambda p: p.name)
def test_first_markdown_cell_says_safe_to_rerun(path):
    first_md = source(path).split("# COMMAND ----------")
    text = "\n".join(l for chunk in first_md for l in chunk.splitlines() if l.startswith("# MAGIC") and "%pip" not in l)
    assert "Safe to rerun" in text.split("# MAGIC # ", 1)[-1][:2500]


@pytest.mark.parametrize("path", NOTEBOOKS, ids=lambda p: p.name)
def test_notebook_is_valid_python(path):
    ast.parse(source(path))


@pytest.mark.parametrize("path", NOTEBOOKS, ids=lambda p: p.name)
def test_ddl_and_inserts_are_repeatable(path):
    code = code_of(path)
    for match in re.finditer(r"CREATE\s+(TABLE|SCHEMA|EXTENSION|INDEX)\b(?!\s+IF\s+NOT\s+EXISTS)", code, re.I):
        context = code[max(0, match.start() - 12): match.end() + 4]
        assert "OR REPLACE" in context.upper(), f"{path.name}: {match.group(0)!r} needs IF NOT EXISTS or OR REPLACE"
    assert not re.search(r"\bINSERT\s+INTO\b", code, re.I), f"{path.name}: use the upsert helpers or INSERT OVERWRITE"


def test_library_sql_is_repeatable():
    import sys

    sys.path.insert(0, str(ROOT / "src"))
    import lakebase_lib as lb

    statements = [*lb.app_schema_sql("a"), *lb.vector_schema_sql("v"), *lb.delta_source_sql("c.s.t")]
    for statement in statements:
        if re.match(r"\s*(CREATE|ALTER)", statement):
            assert re.search(r"IF NOT EXISTS|REPLICA IDENTITY|SET TBLPROPERTIES", statement), statement
    for sql in (lb.upsert_orders_sql("a"), lb.upsert_docs_sql("v")):
        assert "ON CONFLICT" in sql and "DO UPDATE" in sql


def test_cleanup_defaults_to_keep_and_checks_before_deleting():
    code = code_of(GUIDE / "07_cleanup.py")
    assert "'cleanup': 'keep'" in code
    assert "DROP TABLE IF EXISTS" in code and "DROP SCHEMA IF EXISTS" in code
    job = yaml.safe_load((ROOT / "resources" / "lakebase_apps.job.yml").read_text())["resources"]["jobs"]["capability_guides_lakebase_apps"]
    assert next(p for p in job["parameters"] if p["name"] == "cleanup")["default"] == "keep"


def test_job_is_serverless_only():
    text = (ROOT / "resources" / "lakebase_apps.job.yml").read_text()
    for forbidden in ("new_cluster", "existing_cluster_id", "job_clusters", "spark_version", "node_type_id"):
        assert forbidden not in text


def test_bundle_declares_project_and_branch_with_scale_to_zero():
    resources = yaml.safe_load((ROOT / "resources" / "lakebase.postgres.yml").read_text())["resources"]
    project = next(iter(resources["postgres_projects"].values()))
    assert project["default_endpoint_settings"]["suspend_timeout_duration"] == "300s"
    assert "ttl" in next(iter(resources["postgres_branches"].values()))
    # Each branch gets its primary endpoint from the project's default settings; declaring it again fails.
    assert "postgres_endpoints" not in resources
