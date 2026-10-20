from __future__ import annotations

import hashlib
import io
import sys
import zipfile
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import public_data  # noqa: E402


def test_bundle_copies_match_the_shared_source():
    source = (HERE / "public_data.py").read_text()
    copies = sorted(HERE.parent.glob("*/src/public_data.py"))
    assert copies, "No bundle uses public_data.py"
    stale = [str(path.relative_to(HERE.parent)) for path in copies if path.read_text() != source]
    assert not stale, f"Copy reference/_shared/public_data.py over: {stale}"


def test_every_source_is_pinned_and_cited():
    for source in public_data.SOURCES.values():
        assert source["url"].startswith("https://archive.ics.uci.edu/")
        assert len(source["sha256"]) == 64
        assert source["license"] == "CC BY 4.0"
        assert "doi.org/10.24432/" in source["citation"]


def test_snapshot_window_must_end_inside_the_data():
    public_data.check_snapshot_date("2011-06-01", 6, "2011-12-09")
    with pytest.raises(ValueError):
        public_data.check_snapshot_date("2011-07-01", 6, "2011-12-09")
    public_data.check_snapshot_date("2010-12-01", 12, "2011-12-09")


def test_snapshot_sql_uses_the_cut_and_window():
    sql = public_data.customer_snapshot_sql("cat.sch.tx", "2010-09-01", 6)
    assert "invoice_date < DATE'2010-09-01'" in sql
    assert "add_months(DATE'2010-09-01', 6)" in sql
    assert "AS churned" in sql


@pytest.mark.parametrize("table, cut", [("t; DROP TABLE x", "2010-09-01"), ("t", "2010-13-01")])
def test_snapshot_sql_rejects_bad_input(table, cut):
    with pytest.raises(ValueError):
        public_data.customer_snapshot_sql(table, cut, 6)


def _fake_source(monkeypatch, payload: bytes, member: str = "data.txt"):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as bundle:
        bundle.writestr(member, payload)
    archive = buffer.getvalue()
    calls = []

    def urlopen(url, timeout):  # noqa: ARG001
        calls.append(url)
        return io.BytesIO(archive)

    monkeypatch.setattr(public_data.urllib.request, "urlopen", urlopen)
    monkeypatch.setitem(
        public_data.SOURCES,
        "fake",
        {"url": "https://example.org/fake.zip", "sha256": hashlib.sha256(archive).hexdigest(), "member": member},
    )
    return calls


def test_fetch_downloads_once_and_extracts(tmp_path, monkeypatch):
    calls = _fake_source(monkeypatch, b"rows")
    path = public_data.fetch("fake", tmp_path)
    assert path.read_bytes() == b"rows"
    public_data.fetch("fake", tmp_path)
    assert len(calls) == 1


def test_fetch_rejects_a_changed_file(tmp_path, monkeypatch):
    _fake_source(monkeypatch, b"rows")
    public_data.SOURCES["fake"]["sha256"] = "0" * 64
    with pytest.raises(RuntimeError, match="does not match"):
        public_data.fetch("fake", tmp_path)
    assert not list(tmp_path.glob("*.zip*"))
