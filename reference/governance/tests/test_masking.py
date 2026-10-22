from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from governance_lib import masking as m  # noqa: E402


def test_abac_mode_defaults_to_off_and_rejects_unknown():
    assert m.normalize_abac_mode(None) == "off" and m.normalize_abac_mode("") == "off"
    assert m.normalize_abac_mode(" Governed ") == "governed"
    with pytest.raises(ValueError):
        m.normalize_abac_mode("plain")


def test_salt_is_validated_before_it_reaches_a_function_body():
    assert m.validate_salt(m.DEMO_SALT) == m.DEMO_SALT
    for bad in ("short", "has space in it", "quote'inject00", "back\\slash00", ""):
        with pytest.raises(ValueError):
            m.validate_salt(bad)
    with pytest.raises(ValueError):
        m.email_hash_sql("f", "x'; DROP TABLE t; --")


def test_function_sql_uses_documented_forms():
    assert "sha2(concat(v, 'abcdefgh1234'), 256)" in m.email_hash_sql("rcs_hash_email", "abcdefgh1234")
    assert "DETERMINISTIC" in m.email_hash_sql("f", m.DEMO_SALT)
    role = m.ssn_role_mask_sql("f", "rcs-pii-readers")
    assert "is_account_group_member('rcs-pii-readers')" in role and "DETERMINISTIC" not in role
    assert "mask(left(v" in m.phone_mask_sql("f") and "RETURNS STRING DETERMINISTIC" in m.phone_mask_sql("f")
    assert "RETURNS DECIMAL(12,2)" in m.salary_bucket_sql("f", "g") and "round(v, -4)" in m.salary_bucket_sql("f", "g")
    assert "make_date(year(v), 1, 1)" in m.year_only_sql("f", "g")
    assert m.null_out_sql("f").endswith("RETURN CAST(NULL AS STRING)")
    assert all(s.startswith("CREATE OR REPLACE FUNCTION") for s in [
        m.last_n_sql("f"), m.ssn_role_mask_sql("f", "g"), m.phone_mask_sql("f"), m.region_filter_sql("f", "t", "g")])


def test_row_filter_checks_group_then_mapping_table():
    sql = m.region_filter_sql("rcs_region_filter", "`c`.`s`.`rcs_region_access`", "rcs-pii-readers")
    assert sql.index("is_account_group_member") < sql.index("EXISTS")
    assert "a.principal = current_user()" in sql and "a.region = region_value)" in sql
    assert "(region_value STRING)" in sql


def test_attach_and_detach_sql():
    t = "`c`.`s`.`rcs_customers`"
    assert m.set_mask_sql(t, "ssn", "f") == f"ALTER TABLE {t} ALTER COLUMN `ssn` SET MASK f"
    assert m.set_mask_sql(t, "card_number", "f", [4]).endswith("SET MASK f USING COLUMNS (4)")
    assert m.set_mask_sql(t, "x", "f", ["_suffix"]).endswith("USING COLUMNS ('_suffix')")
    assert m.drop_mask_sql(t, "ssn").endswith("ALTER COLUMN `ssn` DROP MASK")
    assert m.set_row_filter_sql(t, "f", "region") == f"ALTER TABLE {t} SET ROW FILTER f ON (`region`)"
    assert m.drop_row_filter_sql(t) == f"ALTER TABLE {t} DROP ROW FILTER"


def test_abac_policy_matches_by_tag_and_passes_the_constant():
    sql = m.abac_mask_policy_sql("rcs_mask_card", "t", "f", "account users", "rcs_class", "card", using=[4])
    assert "COLUMN MASK f" in sql and "TO `account users`" in sql and "EXCEPT" not in sql
    assert "has_tag_value('rcs_class', 'card') AS c" in sql and sql.endswith("USING COLUMNS (4)")
    assert "EXCEPT `admins`" in m.abac_mask_policy_sql("p", "t", "f", "account users", "k", "v", except_group="admins")


def test_python_mirrors():
    assert m.last_n("4111111111111111", 4) == "************1111"
    assert m.last_n("abc", 4) == "abc" and m.last_n(None, 4) is None
    assert m.ssn_last4("123-45-6789") == "***-**-6789"
    assert m.phone_last4("+1-555-010-0001") == "+*-***-***-0001"
    assert m.salted_sha256("a@x.com", "saltsalt") == m.salted_sha256("a@x.com", "saltsalt") != m.salted_sha256("a@x.com", "other000")
    assert len(m.salted_sha256("a", "saltsalt")) == 64 and m.salted_sha256(None, "saltsalt") is None
    assert m.round_to_ten_thousand(84250) == 80000 and m.round_to_ten_thousand(84999) == 80000
    assert m.round_to_ten_thousand(85000) == 90000 and m.round_to_ten_thousand(91000) == 90000
    assert m.year_start(1988) == "1988-01-01"
