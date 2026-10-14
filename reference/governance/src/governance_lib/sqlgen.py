"""SQL builders for grants, masks, and row filters. Pure functions, unit tested."""

from __future__ import annotations

import re
from typing import Iterable

PRIVILEGES = {
    "USE_CATALOG", "USE_SCHEMA", "SELECT", "MODIFY", "CREATE_TABLE", "CREATE_VOLUME",
    "CREATE_FUNCTION", "EXECUTE", "READ_VOLUME", "WRITE_VOLUME", "BROWSE", "ALL_PRIVILEGES",
}
_IDENT = re.compile(r"^[A-Za-z0-9_.\- ]+$")


class IndividualGrantError(ValueError):
    """Raised when a grant would go to a person instead of a group."""


def quote(identifier: str) -> str:
    if not _IDENT.match(identifier):
        raise ValueError(f"unsafe identifier: {identifier!r}")
    return "`" + identifier.replace("`", "``") + "`"


def qualified(*parts: str) -> str:
    return ".".join(quote(part) for part in parts)


def principal_kind(principal: str) -> str:
    """Return 'user' for an email, 'service_principal' for a UUID, otherwise 'group'."""
    if "@" in principal:
        return "user"
    if re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", principal):
        return "service_principal"
    return "group"


def grant_sql(privileges: Iterable[str], securable_type: str, securable: str, principal: str) -> str:
    """Build a GRANT statement. Refuses individual users: access goes through groups."""
    if principal_kind(principal) == "user":
        raise IndividualGrantError(f"grant to a group, not to {principal}")
    privs = list(privileges)
    unknown = [p for p in privs if p not in PRIVILEGES]
    if unknown:
        raise ValueError(f"unknown privileges: {unknown}")
    return f"GRANT {', '.join(p.replace('_', ' ') for p in privs)} ON {securable_type} {securable} TO {quote(principal)}"


def mask_expression(kind: str, value: str) -> str:
    """The unmasked-for-nobody rendering of a value, per mask kind."""
    if kind == "email":
        return f"concat(left({value}, 1), '***@', split_part({value}, '@', 2))"
    if kind == "national_id":
        return f"concat('***-**-', right({value}, 4))"
    raise ValueError(f"unknown mask kind: {kind}")


def _lit(text: str) -> str:
    return text.replace("'", "''")


def mask_body(kind: str, value: str, restricted_role: str, admin_group: str,
              session: str = "session_user()", member: str | None = None) -> str:
    """CASE expression for a mask. Branches on session_user() first, then is_member().

    An assumed role inherits none of the person's memberships, and a group is not a member of
    itself, so is_member() cannot detect the restricted role. session_user() returns the role name
    while a role is assumed. `session` and `member` can be swapped for literals to evaluate the
    same logic for another identity.
    """
    member = member or f"is_member('{_lit(admin_group)}')"
    return (
        f"CASE WHEN {session} = '{_lit(restricted_role)}' THEN NULL "
        f"WHEN {member} THEN {value} "
        f"ELSE {mask_expression(kind, value)} END"
    )


def attribute_filter_body(value: str, hidden_value: str, admin_group: str, member: str | None = None) -> str:
    member = member or f"is_member('{_lit(admin_group)}')"
    return f"({member} OR {value} <> '{_lit(hidden_value)}')"


def dynamic_filter_body(value: str, mapping_table: str, restricted_role: str, admin_group: str,
                        session: str = "session_user()", member: str | None = None) -> str:
    """Row filter keyed on session_user() through a mapping table (principal -> region)."""
    member = member or f"is_member('{_lit(admin_group)}')"
    role = _lit(restricted_role)
    return (
        f"CASE WHEN {session} = '{role}' THEN {value} IN (SELECT region FROM {mapping_table} WHERE principal = '{role}') "
        f"WHEN {member} THEN true "
        f"ELSE {value} IN (SELECT region FROM {mapping_table} WHERE principal = {session}) END"
    )


def mask_function_sql(function: str, kind: str, restricted_role: str, admin_group: str) -> str:
    return (
        f"CREATE OR REPLACE FUNCTION {function}(v STRING) RETURNS STRING "
        f"COMMENT 'Mask: NULL for the restricted role, full value for {_lit(admin_group)}, partial for everyone else' "
        f"RETURN {mask_body(kind, 'v', restricted_role, admin_group)}"
    )


def attribute_filter_sql(function: str, hidden_value: str, admin_group: str) -> str:
    return (
        f"CREATE OR REPLACE FUNCTION {function}(v STRING) RETURNS BOOLEAN "
        f"COMMENT 'Row filter on an attribute: hide {_lit(hidden_value)} rows from everyone but {_lit(admin_group)}' "
        f"RETURN {attribute_filter_body('v', hidden_value, admin_group)}"
    )


def dynamic_filter_sql(function: str, mapping_table: str, restricted_role: str, admin_group: str) -> str:
    return (
        f"CREATE OR REPLACE FUNCTION {function}(v STRING) RETURNS BOOLEAN "
        f"COMMENT 'Row filter: regions come from the mapping table, keyed on session_user()' "
        f"RETURN {dynamic_filter_body('v', mapping_table, restricted_role, admin_group)}"
    )
