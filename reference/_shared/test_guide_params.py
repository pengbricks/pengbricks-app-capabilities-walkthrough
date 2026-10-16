from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from guide_params import bundle_root, load_params  # noqa: E402


class Widgets:
    def __init__(self, values: dict[str, str]):
        self.values = dict(values)

    def text(self, name: str, default: str) -> None:
        self.values.setdefault(name, default)

    def get(self, name: str) -> str:
        return self.values[name]


def dbutils(values: dict[str, str] | None = None):
    return SimpleNamespace(widgets=Widgets(values or {}))


def client(parameters: dict[str, str]):
    job = SimpleNamespace(job_id=7, settings=SimpleNamespace(tags={"capability_guide_job": "capability_guides_demo"}))
    full = SimpleNamespace(settings=SimpleNamespace(parameters=[SimpleNamespace(name=k, default=v) for k, v in parameters.items()]))
    return lambda: SimpleNamespace(jobs=SimpleNamespace(list=lambda: [job], get=lambda job_id: full))


def test_job_parameters_win_inside_a_job():
    calls = []
    values = load_params(dbutils({"catalog": "c", "schema": "s"}), "capability_guides_demo", ["catalog", "schema"], client_factory=lambda: calls.append(1))
    assert values == {"catalog": "c", "schema": "s"}
    assert calls == []  # every widget was set, so the workspace isn't queried


def test_standalone_blanks_come_from_the_deployed_job():
    values = load_params(dbutils({"catalog": "mine"}), "capability_guides_demo", ["catalog", "schema"], client_factory=client({"catalog": "c", "schema": "s"}))
    assert values == {"catalog": "mine", "schema": "s"}


def test_fallback_defaults_and_missing_values():
    values = load_params(dbutils(), "capability_guides_demo", ["use_case"], defaults={"use_case": "general"}, client_factory=client({}))
    assert values == {"use_case": "general"}
    with pytest.raises(ValueError, match="catalog"):
        load_params(dbutils(), "capability_guides_demo", ["catalog"], client_factory=client({}))


def test_bundle_root_is_found_from_a_guide_folder(tmp_path):
    (tmp_path / "databricks.yml").write_text("bundle: {}\n")
    guide = tmp_path / "guides" / "demo"
    guide.mkdir(parents=True)
    assert bundle_root(guide) == tmp_path


def test_bundle_copies_match_the_shared_source():
    source = (HERE / "guide_params.py").read_text()
    copies = sorted(HERE.parent.glob("*/src/guide_params.py"))
    stale = [str(path.relative_to(HERE.parent)) for path in copies if path.read_text() != source]
    assert not stale, f"Copy reference/_shared/guide_params.py over: {stale}"
