"""Compare two data-contract versions and enforce that the semantic version bump matches.

Pure Python (plus PyYAML for loading): no Spark, so it runs in unit tests, in CI, and in the job.

Nonbreaking: add a nullable column, widen a type, add or change a comment, relax nullability.
Breaking:    drop a column, rename a column, narrow or change a type, tighten nullability,
             add a required (NOT NULL) column.
Required bump: breaking -> major, nonbreaking -> minor, no change -> patch.
"""

from __future__ import annotations

import copy
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

NONBREAKING = "nonbreaking"
BREAKING = "breaking"

_INT_DIGITS = {"tinyint": 3, "smallint": 5, "int": 10, "bigint": 19}
_INT_ORDER = ["tinyint", "smallint", "int", "bigint"]
_FLOAT_ORDER = ["float", "double"]


class CompatibilityError(Exception):
    """Raised when a contract change is mislabeled by its version bump."""


@dataclass(frozen=True)
class Change:
    kind: str
    classification: str
    column: str  # column name in the OLD contract (or the new name for added columns)
    detail: str
    new_column: str | None = None


@dataclass
class GateResult:
    old_version: str
    new_version: str
    changes: list[Change]
    required_bump: str
    errors: list[str] = field(default_factory=list)

    @property
    def classification(self) -> str:
        if any(c.classification == BREAKING for c in self.changes):
            return BREAKING
        return NONBREAKING

    @property
    def ok(self) -> bool:
        return not self.errors


# ---------------------------------------------------------------- loading

def load_contract(path: str | Path) -> dict[str, Any]:
    import yaml

    with open(path) as handle:
        return yaml.safe_load(handle)


def load_contracts(directory: str | Path) -> list[dict[str, Any]]:
    """Load every vX.Y.Z.yml in a directory, ordered by version. File name must match `version`."""
    contracts = []
    for path in Path(directory).glob("v*.yml"):
        contract = load_contract(path)
        if f"v{contract['version']}" != path.stem:
            raise CompatibilityError(f"{path.name}: file name does not match version {contract['version']}")
        contracts.append(contract)
    return sorted(contracts, key=lambda c: parse_version(c["version"]))


def parse_version(version: str) -> tuple[int, int, int]:
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", str(version).strip())
    if not match:
        raise CompatibilityError(f"not a semantic version: {version!r}")
    return int(match.group(1)), int(match.group(2)), int(match.group(3))


# ---------------------------------------------------------------- types

def _decimal(type_name: str) -> tuple[int, int] | None:
    match = re.fullmatch(r"decimal\((\d+),\s*(\d+)\)", type_name.strip().lower())
    return (int(match.group(1)), int(match.group(2))) if match else None


def is_widening(old: str, new: str) -> bool:
    """True when every value of `old` fits in `new` (equal types count as widening)."""
    old, new = old.strip().lower(), new.strip().lower()
    if old == new:
        return True
    if old in _INT_ORDER and new in _INT_ORDER:
        return _INT_ORDER.index(new) > _INT_ORDER.index(old)
    if old in _FLOAT_ORDER and new in _FLOAT_ORDER:
        return _FLOAT_ORDER.index(new) > _FLOAT_ORDER.index(old)
    new_dec = _decimal(new)
    if old in _INT_DIGITS and new_dec:
        return new_dec[0] - new_dec[1] >= _INT_DIGITS[old]
    old_dec = _decimal(old)
    if old_dec and new_dec:
        return new_dec[1] >= old_dec[1] and new_dec[0] - new_dec[1] >= old_dec[0] - old_dec[1]
    return old == "date" and new == "timestamp"


def _nullable(column: dict[str, Any]) -> bool:
    return bool(column.get("nullable", True))


# ---------------------------------------------------------------- diff

def _compare(old: dict[str, Any], new: dict[str, Any]) -> list[Change]:
    changes = []
    label = old["name"] if old["name"] == new["name"] else f"{old['name']} -> {new['name']}"
    if old["type"].strip().lower() != new["type"].strip().lower():
        widening = is_widening(old["type"], new["type"])
        changes.append(Change(
            "widen_type" if widening else "narrow_type",
            NONBREAKING if widening else BREAKING,
            old["name"], f"{label}: {old['type']} -> {new['type']}", new["name"]))
    if _nullable(old) and not _nullable(new):
        changes.append(Change("tighten_nullability", BREAKING, old["name"], f"{label}: nullable -> NOT NULL", new["name"]))
    elif not _nullable(old) and _nullable(new):
        changes.append(Change("relax_nullability", NONBREAKING, old["name"], f"{label}: NOT NULL -> nullable", new["name"]))
    if (old.get("comment") or "") != (new.get("comment") or ""):
        changes.append(Change("change_comment", NONBREAKING, old["name"], f"{label}: comment updated", new["name"]))
    return changes


def diff_contracts(old: dict[str, Any], new: dict[str, Any]) -> list[Change]:
    old_cols = {c["name"]: c for c in old["columns"]}
    changes: list[Change] = []
    claimed: set[str] = set()
    for column in new["columns"]:
        previous = column.get("renamed_from")
        if previous and previous in old_cols:
            claimed.add(previous)
            changes.append(Change("rename_column", BREAKING, previous, f"{previous} -> {column['name']}", column["name"]))
            changes.extend(_compare(old_cols[previous], column))
        elif column["name"] in old_cols:
            claimed.add(column["name"])
            changes.extend(_compare(old_cols[column["name"]], column))
        elif _nullable(column):
            changes.append(Change("add_nullable_column", NONBREAKING, column["name"], f"{column['name']} {column['type']} (nullable)", column["name"]))
        else:
            changes.append(Change("add_required_column", BREAKING, column["name"], f"{column['name']} {column['type']} NOT NULL", column["name"]))
    for name in old_cols:
        if name not in claimed:
            changes.append(Change("drop_column", BREAKING, name, f"{name} removed"))
    if (old.get("comment") or "") != (new.get("comment") or ""):
        changes.append(Change("change_table_comment", NONBREAKING, "", "table comment updated"))
    return changes


# ---------------------------------------------------------------- version gate

def required_bump(changes: list[Change]) -> str:
    if any(c.classification == BREAKING for c in changes):
        return "major"
    return "minor" if changes else "patch"


def actual_bump(old_version: str, new_version: str) -> str:
    old, new = parse_version(old_version), parse_version(new_version)
    if new <= old:
        return "none"
    if new[0] > old[0]:
        return "major"
    if new[1] > old[1]:
        return "minor"
    return "patch"


def check_contracts(old: dict[str, Any], new: dict[str, Any]) -> GateResult:
    """Classify the change between two contracts and check the version bump matches."""
    changes = diff_contracts(old, new)
    need = required_bump(changes)
    result = GateResult(str(old["version"]), str(new["version"]), changes, need)
    have = actual_bump(result.old_version, result.new_version)
    if have != need:
        kinds = ", ".join(sorted({c.kind for c in changes})) or "no schema change"
        result.errors.append(
            f"{old['dataset']} {result.old_version} -> {result.new_version}: {result.classification} change "
            f"({kinds}) needs a {need} bump but the version is a {have} bump")
    elif need == "major":
        major, minor, patch = parse_version(result.new_version)
        if (minor, patch) != (0, 0):
            result.errors.append(f"{result.new_version}: a major release resets minor and patch to 0")
    return result


def assert_compatible(old: dict[str, Any], new: dict[str, Any]) -> GateResult:
    result = check_contracts(old, new)
    if not result.ok:
        raise CompatibilityError("; ".join(result.errors))
    return result


def with_version(contract: dict[str, Any], version: str) -> dict[str, Any]:
    """Copy of a contract under a different version label (used to dry-run a mislabeled release)."""
    clone = copy.deepcopy(contract)
    clone["version"] = version
    return clone


# ---------------------------------------------------------------- SQL generation

def _q(text: str) -> str:
    return text.replace("\\", "\\\\").replace("'", "\\'")


def column_ddl(column: dict[str, Any]) -> str:
    parts = [f"`{column['name']}`", column["type"]]
    if not _nullable(column):
        parts.append("NOT NULL")
    if column.get("comment"):
        parts.append(f"COMMENT '{_q(column['comment'])}'")
    return " ".join(parts)


def create_table_sql(contract: dict[str, Any], table: str) -> str:
    cols = ",\n  ".join(column_ddl(c) for c in contract["columns"])
    comment = f"\nCOMMENT '{_q(contract['comment'])}'" if contract.get("comment") else ""
    return f"CREATE TABLE {table} (\n  {cols}\n){comment}"


def evolve_sql(old: dict[str, Any], new: dict[str, Any], table: str) -> list[str]:
    """ALTER statements that move a table from `old` to `new` in place. Nonbreaking changes only."""
    result = assert_compatible(old, new)
    if result.classification == BREAKING:
        raise CompatibilityError("breaking changes cannot be applied in place; publish a new table")
    new_cols = {c["name"]: c for c in new["columns"]}
    statements = []
    for change in result.changes:
        column = new_cols.get(change.new_column or change.column)
        if change.kind == "add_nullable_column":
            statements.append(f"ALTER TABLE {table} ADD COLUMN {column_ddl(column)}")
        elif change.kind == "change_comment":
            statements.append(f"ALTER TABLE {table} ALTER COLUMN `{column['name']}` COMMENT '{_q(column.get('comment') or '')}'")
        elif change.kind == "relax_nullability":
            statements.append(f"ALTER TABLE {table} ALTER COLUMN `{column['name']}` DROP NOT NULL")
        elif change.kind == "widen_type":
            statements.append(f"ALTER TABLE {table} ALTER COLUMN `{column['name']}` TYPE {column['type']}")
    return statements


def migrate_select(old: dict[str, Any], new: dict[str, Any]) -> list[str]:
    """SELECT expressions that build the new shape from a table in the old shape."""
    old_cols = {c["name"]: c for c in old["columns"]}
    expressions = []
    for column in new["columns"]:
        source = column.get("renamed_from") or column["name"]
        if source in old_cols:
            expressions.append(f"CAST(`{source}` AS {column['type']}) AS `{column['name']}`")
        else:
            expressions.append(f"CAST(NULL AS {column['type']}) AS `{column['name']}`")
    return expressions


def compat_view_select(old: dict[str, Any], new: dict[str, Any]) -> list[str]:
    """SELECT expressions that expose the OLD shape over a table in the NEW shape."""
    new_by_name = {c["name"]: c for c in new["columns"]}
    new_by_previous = {c["renamed_from"]: c for c in new["columns"] if c.get("renamed_from")}
    expressions = []
    for column in old["columns"]:
        source = new_by_previous.get(column["name"]) or new_by_name.get(column["name"])
        if source:
            expressions.append(f"CAST(`{source['name']}` AS {column['type']}) AS `{column['name']}`")
        else:
            expressions.append(f"CAST(NULL AS {column['type']}) AS `{column['name']}`")
    return expressions
