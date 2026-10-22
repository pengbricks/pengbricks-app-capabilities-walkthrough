"""SQL builders and Python mirrors for the masking pattern library. Pure functions, unit tested.

Notebooks run the statements; nothing here touches a workspace. The Python mirrors compute the
value each mask should return, so a notebook can check the SQL result against an independent
calculation.
"""

from __future__ import annotations

import hashlib
import re
from typing import Iterable

from .sqlgen import quote

TABLE = "rcs_customers"
MAPPING_TABLE = "rcs_region_access"
RESULTS_TABLE = "rcs_mask_results"
TAG_KEY = "rcs_class"
TAG_VALUE = "card"
ABAC_POLICY = "rcs_mask_card"
ABAC_MODES = ("off", "governed")
DEMO_SALT = "rcs-demo-salt-not-a-secret"
_SAFE_SALT = re.compile(r"^[A-Za-z0-9._~+/=:-]{8,128}$")

# column -> (function name, pattern label). The card column is masked by a table-level mask or by an ABAC policy.
COLUMN_MASKS = {
    "ssn": ("rcs_mask_ssn", "role-aware partial mask"),
    "email": ("rcs_hash_email", "salted hash"),
    "phone": ("rcs_mask_phone", "format-preserving partial mask"),
    "home_address": ("rcs_null_out", "null out"),
    "salary": ("rcs_bucket_salary", "type-safe rounding"),
    "birth_date": ("rcs_year_only", "type-safe date truncation"),
}
CARD_COLUMN, CARD_FUNCTION = "card_number", "rcs_mask_last_n"
FILTER_FUNCTION = "rcs_region_filter"


def _lit(text: str) -> str:
    return text.replace("\\", "\\\\").replace("'", "\\'")


def normalize_abac_mode(value: str | None) -> str:
    """The abac_mode job parameter: 'off' (default when blank) or 'governed'.

    'governed' creates an account-level governed tag and an ABAC policy, so it is opt-in.
    """
    mode = (value or "off").strip().lower()
    if mode not in ABAC_MODES:
        raise ValueError(f"abac_mode must be off or governed, not {value!r}")
    return mode


def validate_salt(salt: str) -> str:
    """A salt is written into a function body, so allow only plain characters (8 to 128)."""
    if not _SAFE_SALT.match(salt or ""):
        raise ValueError("salt must be 8 to 128 characters from A-Z a-z 0-9 . _ ~ + / = : -")
    return salt


# Function builders -------------------------------------------------------------------------------

def last_n_sql(function: str) -> str:
    """Partial reveal without regex, with the digit count as a second argument."""
    return (f"CREATE OR REPLACE FUNCTION {function}(v STRING, n INT) RETURNS STRING DETERMINISTIC "
            "COMMENT 'Show the last n characters, star the rest' "
            "RETURN concat(repeat('*', greatest(length(v) - n, 0)), right(v, n))")


def ssn_role_mask_sql(function: str, group: str) -> str:
    return (f"CREATE OR REPLACE FUNCTION {function}(v STRING) RETURNS STRING "
            f"COMMENT 'Full value for {_lit(group)}, last four for everyone else' "
            f"RETURN CASE WHEN is_account_group_member('{_lit(group)}') THEN v "
            "ELSE concat('***-**-', right(v, 4)) END")


def email_hash_sql(function: str, salt: str) -> str:
    validate_salt(salt)
    return (f"CREATE OR REPLACE FUNCTION {function}(v STRING) RETURNS STRING DETERMINISTIC "
            "COMMENT 'sha2-256 of the value plus a salt: one-way, stable across tables, so joins still work' "
            f"RETURN sha2(concat(v, '{_lit(salt)}'), 256)")


def phone_mask_sql(function: str) -> str:
    return (f"CREATE OR REPLACE FUNCTION {function}(v STRING) RETURNS STRING DETERMINISTIC "
            "COMMENT 'Star every digit except the last four, keep punctuation' "
            "RETURN concat(mask(left(v, greatest(length(v) - 4, 0)), NULL, NULL, '*', NULL), right(v, 4))")


def null_out_sql(function: str) -> str:
    return (f"CREATE OR REPLACE FUNCTION {function}(v STRING) RETURNS STRING DETERMINISTIC "
            "COMMENT 'Return NULL' RETURN CAST(NULL AS STRING)")


def salary_bucket_sql(function: str, group: str) -> str:
    return (f"CREATE OR REPLACE FUNCTION {function}(v DECIMAL(12,2)) RETURNS DECIMAL(12,2) "
            f"COMMENT 'Round to the nearest 10000 for everyone but {_lit(group)}; type stays DECIMAL(12,2)' "
            f"RETURN IF(is_account_group_member('{_lit(group)}'), v, round(v, -4))")


def year_only_sql(function: str, group: str) -> str:
    return (f"CREATE OR REPLACE FUNCTION {function}(v DATE) RETURNS DATE "
            f"COMMENT 'Keep the year, set month and day to January 1 for everyone but {_lit(group)}' "
            f"RETURN IF(is_account_group_member('{_lit(group)}'), v, make_date(year(v), 1, 1))")


def region_filter_sql(function: str, mapping_table: str, group: str) -> str:
    """Row filter: the group sees every row; others see the regions mapped to current_user()."""
    return (f"CREATE OR REPLACE FUNCTION {function}(region_value STRING) RETURNS BOOLEAN "
            f"COMMENT 'Group members see all rows; others see the regions mapped to them in the mapping table. The parameter is not named region, because an unqualified region inside the subquery would resolve to the mapping table column' "
            f"RETURN is_account_group_member('{_lit(group)}') "
            f"OR EXISTS (SELECT 1 FROM {mapping_table} a WHERE a.principal = current_user() AND a.region = region_value)")


# Attach and detach -------------------------------------------------------------------------------

def set_mask_sql(table: str, column: str, function: str, using: Iterable[str | int] | None = None) -> str:
    """ALTER TABLE ... ALTER COLUMN ... SET MASK, optionally USING COLUMNS with constant literals."""
    stmt = f"ALTER TABLE {table} ALTER COLUMN {quote(column)} SET MASK {function}"
    if using:
        args = ", ".join(str(a) if isinstance(a, int) else f"'{_lit(a)}'" for a in using)
        stmt += f" USING COLUMNS ({args})"
    return stmt


def drop_mask_sql(table: str, column: str) -> str:
    return f"ALTER TABLE {table} ALTER COLUMN {quote(column)} DROP MASK"


def set_row_filter_sql(table: str, function: str, column: str) -> str:
    return f"ALTER TABLE {table} SET ROW FILTER {function} ON ({quote(column)})"


def drop_row_filter_sql(table: str) -> str:
    return f"ALTER TABLE {table} DROP ROW FILTER"


def abac_mask_policy_sql(name: str, table: str, function: str, principal: str, tag: str, value: str,
                         using: Iterable[int | str] | None = None, except_group: str | None = None) -> str:
    """CREATE POLICY ... COLUMN MASK on a table, matching columns by governed tag."""
    to = f"TO {quote(principal)}" + (f" EXCEPT {quote(except_group)}" if except_group else "")
    stmt = (f"CREATE POLICY {quote(name)}\n  ON TABLE {table}\n  COLUMN MASK {function}\n  {to}\n"
            f"  FOR TABLES\n  MATCH COLUMNS has_tag_value('{_lit(tag)}', '{_lit(value)}') AS c\n  ON COLUMN c")
    if using:
        args = ", ".join(str(a) if isinstance(a, int) else f"'{_lit(a)}'" for a in using)
        stmt += f"\n  USING COLUMNS ({args})"
    return stmt


# Python mirrors ----------------------------------------------------------------------------------

def last_n(value: str | None, n: int) -> str | None:
    if value is None:
        return None
    return "*" * max(len(value) - n, 0) + (value[-n:] if n > 0 else "")


def ssn_last4(value: str | None) -> str | None:
    return None if value is None else "***-**-" + value[-4:]


def salted_sha256(value: str | None, salt: str) -> str | None:
    if value is None:
        return None
    return hashlib.sha256((value + salt).encode("utf-8")).hexdigest()


def phone_last4(value: str | None) -> str | None:
    """Digits before the last four become '*'; other characters stay."""
    if value is None:
        return None
    head, tail = value[: max(len(value) - 4, 0)], value[-4:]
    return "".join("*" if c.isdigit() else c for c in head) + tail


def round_to_ten_thousand(value: int | float) -> int:
    """Round half up to the nearest 10,000, the way SQL round(v, -4) does on a decimal."""
    return int((value + 5000) // 10000 * 10000)


def year_start(year: int) -> str:
    return f"{year:04d}-01-01"
