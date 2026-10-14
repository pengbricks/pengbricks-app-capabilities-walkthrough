import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from doc_render import clean_comment, md_table, parse_ai_json, pct, render_index, render_table_page, sql_str


def test_sql_str_escapes_quotes():
    assert sql_str("it's") == "it''s"


def test_parse_ai_json_handles_fences_and_garbage():
    assert parse_ai_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_ai_json("no json") == {}
    assert parse_ai_json("{bad") == {}
    assert parse_ai_json("") == {}


def test_clean_comment_truncates_and_flattens():
    assert clean_comment("a\n b") == "a b"
    assert len(clean_comment("x" * 1000, 50)) == 50


def test_pct_and_md_table():
    assert pct(None) == "n/a" and pct(0.5) == "50.0%"
    assert md_table(["a"], []) == ""
    assert "a\\|b" in md_table(["h"], [("a|b",)])


def _table():
    return {"full_name": "c.s.t", "name": "t", "description": "Orders.", "owner": "me", "tags": [("k", "v")],
            "columns": [{"name": "id", "type": "bigint", "null_rate": 0.0, "description": "Key"}],
            "upstream": ["c.s.u"], "downstream": [], "row_count": 1200, "key_column": "id", "key_unique": True,
            "key_distinct": 1200, "readers": [], "queries": [], "generated_at": "now", "model": "m"}


def test_render_table_page_sections():
    page = render_table_page(_table())
    for s in ("# c.s.t", "## Ownership", "## Schema", "## Quality", "## Lineage", "## Usage guidance"):
        assert s in page
    assert "`c.s.u`" in page and "1,200" in page and "unique" in page
    assert "No recent readers" in page


def test_render_index_links():
    idx = render_index([{"name": "t", "owner": "me", "row_count": 3, "summary": "s"}], "now")
    assert "[t](t.md)" in idx


def test_spec_helpers():
    import yaml
    from spec_helpers import column_kwargs, python_rows, render_sql
    spec = yaml.safe_load(open(os.path.join(os.path.dirname(__file__), "..", "use_cases", "general.yml")))
    t = spec["tables"][0]
    a, _ = python_rows(t, spec["seed"])
    b, _ = python_rows(t, spec["seed"])
    assert a == b and len(a) == t["rows"]
    assert column_kwargs(t["columns"][2])["weights"] == [6, 3, 1]
    assert "`c`.`s`.`t`" in render_sql("select * from {x}", {"x": "`c`.`s`.`t`"})
