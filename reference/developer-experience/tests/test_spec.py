from pathlib import Path

from dx_demo.rules import normalize_key
from dx_demo.spec import expected_clean_count, generate_base_rows, inject_edge_cases, load_spec

SPEC = load_spec(Path(__file__).resolve().parents[1] / "use_cases" / "general.yml")


def _rows():
    return inject_edge_cases(generate_base_rows(SPEC), SPEC)


def test_generation_is_deterministic():
    assert _rows() == _rows()


def test_edge_cases_are_present():
    key, val = SPEC["key_column"], SPEC["value_column"]
    rows = _rows()
    assert any(r[key] is None for r in rows)
    assert any(r[key] is not None and r[key].strip() == "" for r in rows)
    assert any(r[val] < 0 for r in rows)
    keys = [normalize_key(r[key]) for r in rows if normalize_key(r[key])]
    assert len(keys) > len(set(keys))  # duplicates exist once keys are normalized


def test_expected_clean_count_matches_plain_python_cleaning():
    key, val = SPEC["key_column"], SPEC["value_column"]
    survivors = {normalize_key(r[key]) for r in _rows() if normalize_key(r[key]) and r[val] >= 0}
    assert len(survivors) == expected_clean_count(SPEC)
