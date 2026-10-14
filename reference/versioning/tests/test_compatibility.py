from __future__ import annotations

import copy
import sys
from pathlib import Path

import pytest

BUNDLE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BUNDLE_ROOT / "src"))

from compatibility import (  # noqa: E402
    BREAKING, NONBREAKING, CompatibilityError, assert_compatible, check_contracts,
    compat_view_select, diff_contracts, evolve_sql, is_widening, load_contracts,
    migrate_select, with_version,
)

CONTRACTS = load_contracts(BUNDLE_ROOT / "contracts" / "customers")
V1, V11, V2 = CONTRACTS


def base():
    return {
        "dataset": "t", "version": "1.0.0", "comment": "c",
        "columns": [
            {"name": "a", "type": "string", "nullable": False},
            {"name": "b", "type": "int", "nullable": True},
        ],
    }


def bump(contract, version, mutate):
    new = copy.deepcopy(contract)
    new["version"] = version
    mutate(new)
    return new


def kinds(old, new):
    return {c.kind: c.classification for c in diff_contracts(old, new)}


def test_shipped_contracts_are_ordered_and_valid():
    assert [c["version"] for c in CONTRACTS] == ["1.0.0", "1.1.0", "2.0.0"]
    assert check_contracts(V1, V11).ok
    assert check_contracts(V11, V2).ok


def test_add_nullable_column_is_nonbreaking():
    new = bump(base(), "1.1.0", lambda c: c["columns"].append({"name": "c", "type": "string"}))
    assert kinds(base(), new) == {"add_nullable_column": NONBREAKING}


def test_add_required_column_is_breaking():
    new = bump(base(), "2.0.0", lambda c: c["columns"].append({"name": "c", "type": "string", "nullable": False}))
    assert kinds(base(), new) == {"add_required_column": BREAKING}


def test_comment_change_is_nonbreaking():
    new = bump(base(), "1.1.0", lambda c: c["columns"][0].update(comment="key"))
    assert kinds(base(), new) == {"change_comment": NONBREAKING}


def test_drop_column_is_breaking():
    new = bump(base(), "2.0.0", lambda c: c["columns"].pop())
    assert kinds(base(), new) == {"drop_column": BREAKING}


def test_rename_is_breaking_and_not_reported_as_drop_plus_add():
    new = bump(base(), "2.0.0", lambda c: c["columns"][0].update(name="z", renamed_from="a"))
    assert kinds(base(), new) == {"rename_column": BREAKING}


def test_type_widening_and_narrowing():
    assert is_widening("int", "bigint")
    assert is_widening("decimal(10,2)", "decimal(18,2)")
    assert is_widening("int", "decimal(12,0)")
    assert not is_widening("bigint", "int")
    assert not is_widening("bigint", "decimal(18,2)")
    assert not is_widening("string", "int")
    wide = bump(base(), "1.1.0", lambda c: c["columns"][1].update(type="bigint"))
    assert kinds(base(), wide) == {"widen_type": NONBREAKING}
    narrow = bump(wide, "2.0.0", lambda c: c["columns"][1].update(type="int"))
    assert kinds(wide, narrow) == {"narrow_type": BREAKING}


def test_nullability_tightening_is_breaking_and_relaxing_is_not():
    tight = bump(base(), "2.0.0", lambda c: c["columns"][1].update(nullable=False))
    assert kinds(base(), tight) == {"tighten_nullability": BREAKING}
    loose = bump(base(), "1.1.0", lambda c: c["columns"][0].update(nullable=True))
    assert kinds(base(), loose) == {"relax_nullability": NONBREAKING}


def test_gate_rejects_breaking_change_with_minor_bump():
    mislabeled = with_version(V2, "1.2.0")
    with pytest.raises(CompatibilityError, match="needs a major bump"):
        assert_compatible(V11, mislabeled)


def test_gate_rejects_nonbreaking_change_with_major_bump():
    with pytest.raises(CompatibilityError, match="needs a minor bump"):
        assert_compatible(V1, with_version(V11, "2.0.0"))


def test_gate_rejects_unchanged_or_lower_version():
    with pytest.raises(CompatibilityError):
        assert_compatible(V1, with_version(V11, "1.0.0"))


def test_major_bump_must_reset_minor():
    with pytest.raises(CompatibilityError, match="resets minor"):
        assert_compatible(V11, with_version(V2, "2.1.0"))


def test_v2_changes_cover_rename_and_type():
    found = {(c.kind, c.column) for c in diff_contracts(V11, V2)}
    assert ("rename_column", "full_name") in found
    assert ("rename_column", "lifetime_value") in found
    assert ("narrow_type", "lifetime_value") in found


def test_evolve_sql_adds_column_in_place_and_refuses_breaking():
    statements = evolve_sql(V1, V11, "t")
    assert any(s.startswith("ALTER TABLE t ADD COLUMN `loyalty_tier` string") for s in statements)
    with pytest.raises(CompatibilityError):
        evolve_sql(V11, V2, "t")


def test_compat_view_restores_old_names_and_types():
    select = compat_view_select(V11, V2)
    assert "CAST(`display_name` AS string) AS `full_name`" in select
    assert "CAST(`lifetime_value_usd` AS bigint) AS `lifetime_value`" in select
    assert len(select) == len(V11["columns"])


def test_migrate_select_renames_and_casts():
    select = migrate_select(V11, V2)
    assert "CAST(`full_name` AS string) AS `display_name`" in select
    assert "CAST(`lifetime_value` AS decimal(18,2)) AS `lifetime_value_usd`" in select
