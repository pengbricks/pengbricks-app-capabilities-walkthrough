"""Environment layout checks that need no Spark or workspace, so pytest can cover them.

The audit notebook gathers facts about one catalog (isolation mode, bindings, owner, grants, schemas) and
hands them to `build_findings`. Each finding is a pass, a warn, or an info line about the layout.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

ENVIRONMENTS = ("dev", "test", "stage", "prod")
WRITE_PRIVILEGES = {"ALL_PRIVILEGES", "MODIFY", "CREATE_TABLE", "CREATE_VOLUME", "WRITE_VOLUME", "CREATE_SCHEMA", "MANAGE"}
_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)

LAYOUT_NAMES = {
    "a": "a catalog per environment (dev, test, stage, prod) with domain schemas",
    "b": "a catalog per environment and domain (dev_sales ... prod_sales)",
    "c": "one catalog with environment schemas",
    "unknown": "no environment names found in the catalog or its schemas",
}


@dataclass(frozen=True)
class Finding:
    check: str
    status: str  # pass, warn, or info
    finding: str
    detail: str = ""


@dataclass
class Facts:
    environment: str
    catalog: str
    schema: str
    schema_names: list[str]
    user_name: str
    isolation_mode: str | None = None
    owner: str | None = None
    has_managed_location: bool = False
    # (workspace_id, binding_type) pairs, or None when this identity may not read them
    bindings: list[tuple[int, str]] | None = None
    workspace_id: int | None = None
    schema_tag: str | None = None
    # principal -> privileges on the environment schema, or None when unreadable
    schema_grants: dict[str, list[str]] | None = None
    schema_owner: str | None = None
    extra: dict = field(default_factory=dict)


def environment_of(name: str) -> str | None:
    """The environment a catalog or schema name stands for: its first or last word, if that is dev/test/stage/prod."""
    words = [w for w in re.split(r"[_\-]", name.lower()) if w]
    if not words:
        return None
    if words[0] in ENVIRONMENTS:
        return words[0]
    return words[-1] if words[-1] in ENVIRONMENTS else None


def short_name(user_name: str) -> str:
    """The prefix development mode puts on personal schemas: the part of the email before @, as snake_case."""
    return re.sub(r"[^a-z0-9]+", "_", user_name.split("@")[0].lower()).strip("_")


def principal_kind(principal: str) -> str:
    if "@" in principal:
        return "user"
    if _UUID.match(principal):
        return "service principal"
    return "group"


def classify_layout(catalog: str, schema_names: list[str]) -> str:
    """'a' when the catalog is named for an environment, 'b' when it is <env>_<domain>, 'c' when its schemas are."""
    if catalog.lower() in ENVIRONMENTS:
        return "a"
    if environment_of(catalog):
        return "b"
    if any(environment_of(s) for s in schema_names if s != "information_schema"):
        return "c"
    return "unknown"


def three_level_name(layout: str, env: str, table: str = "daily_revenue", domain: str = "sales") -> str:
    """The catalog.schema.table a sales table gets in each layout."""
    if layout == "a":
        return f"{env}.{domain}.{table}"
    if layout == "b":
        return f"{env}_{domain}.reporting.{table}"
    if layout == "c":
        return f"analytics.{env}_{domain}.{table}"
    raise ValueError(f"unknown layout {layout!r}")


def build_findings(f: Facts) -> list[Finding]:
    layout = classify_layout(f.catalog, f.schema_names)
    out = [Finding("layout", "info", f"Layout ({layout}): {LAYOUT_NAMES[layout]}.")]

    # Which environments exist at all
    if layout == "c":
        present = sorted({e for s in f.schema_names if (e := environment_of(s))}, key=ENVIRONMENTS.index)
        kind = "schemas"
    else:
        present = [f.environment] if environment_of(f.catalog) else []
        kind = "catalogs"
    missing = [e for e in ENVIRONMENTS if e not in present]
    if layout == "unknown":
        out.append(Finding("environments", "warn", "No environment names in the catalog or its schemas."))
    elif missing:
        out.append(Finding("environments", "info", f"Environment {kind} here: {', '.join(present)}. Missing: {', '.join(missing)}."))
    else:
        out.append(Finding("environments", "pass", f"All four environment {kind} exist: {', '.join(present)}."))

    # Personal sandbox in dev
    if f.environment == "dev":
        mine = f"dev_{short_name(f.user_name)}_"
        if f.schema.startswith(mine):
            out.append(Finding("sandbox", "pass", f"Dev schema {f.schema} is a personal sandbox for {short_name(f.user_name)}."))
        else:
            out.append(Finding("sandbox", "warn", f"Dev schema {f.schema} is shared. Development mode gives each user a dev_<user>_ schema."))

    # Isolation and bindings
    if f.isolation_mode == "ISOLATED":
        out.append(Finding("isolation", "pass", "Catalog is ISOLATED: only bound workspaces can see it."))
    else:
        out.append(Finding("isolation", "warn", f"Catalog isolation mode is {f.isolation_mode or 'unknown'}: every workspace on the metastore can see it."))
    if f.isolation_mode != "ISOLATED":
        out.append(Finding("bindings", "info", "Workspace bindings are only consulted once the catalog is ISOLATED."))
    elif f.bindings is None:
        out.append(Finding("bindings", "info", "This identity cannot read the catalog's workspace bindings."))
    else:
        modes = ", ".join(f"{wid} ({'read-only' if 'READ_ONLY' in kind_ else 'read-write'})" for wid, kind_ in f.bindings) or "none"
        bound_here = any(wid == f.workspace_id for wid, _ in f.bindings)
        text = f"{len(f.bindings)} workspace binding(s): {modes}. This workspace is {'bound' if bound_here else 'not bound'}."
        out.append(Finding("bindings", "pass" if f.bindings else "warn", text))

    # What a catalog boundary buys in this layout
    if layout == "c":
        extra = ""
        if f.bindings and len(f.bindings) > 1:
            extra = f" {len(f.bindings)} workspaces are bound, so each sees every environment's schemas."
        out.append(
            Finding(
                "boundary",
                "warn",
                "Environments share one catalog. A binding cannot keep dev away from prod inside it, and they share one managed location." + extra,
                "Grants on schemas are the only boundary. Layout (a) or (b) gives each environment a catalog to bind and its own storage.",
            )
        )
    elif layout in ("a", "b"):
        out.append(Finding("boundary", "pass", "This environment has its own catalog, so it can have its own binding and managed location."))

    # Ownership and storage
    if f.owner:
        kind = principal_kind(f.owner)
        if kind == "user":
            out.append(Finding("owner", "warn", "Catalog is owned by a person. Move ownership to the environment's service principal or a group.", f"owner kind: {kind}"))
        else:
            out.append(Finding("owner", "pass", f"Catalog is owned by a {kind}, not a person.", f"owner kind: {kind}"))
    out.append(
        Finding(
            "storage",
            "pass" if f.has_managed_location else "warn",
            "Catalog has its own managed storage location." if f.has_managed_location else "Catalog uses the metastore's default storage, so its data is not separated by location.",
        )
    )

    # Tag and grants on this environment's schema
    if f.schema_tag == f.environment:
        out.append(Finding("tag", "pass", f"Schema is tagged environment={f.environment}."))
    else:
        out.append(
            Finding(
                "tag",
                "warn",
                f"Schema tag environment is {f.schema_tag!r}, expected {f.environment!r}.",
                "A governed tag policy on environment can restrict the allowed values.",
            )
        )
    if f.schema_owner:
        owner_kind = principal_kind(f.schema_owner)
        if owner_kind == "user" and f.environment == "prod":
            out.append(Finding("schema_owner", "warn", "The prod schema is owned by a person. The environment's service principal should own it.", f"owner kind: {owner_kind}"))
        elif owner_kind == "user":
            out.append(Finding("schema_owner", "info", f"The {f.environment} schema is owned by a person, which is fine outside prod.", f"owner kind: {owner_kind}"))
        else:
            out.append(Finding("schema_owner", "pass", f"The {f.environment} schema is owned by a {owner_kind}.", f"owner kind: {owner_kind}"))
    if f.schema_grants is None:
        out.append(Finding("grants", "info", "This identity cannot read grants on the environment schema."))
    else:
        people = sorted(p for p, privs in f.schema_grants.items() if principal_kind(p) == "user" and WRITE_PRIVILEGES & set(privs))
        if f.environment == "prod" and people:
            out.append(Finding("grants", "warn", f"{len(people)} person(s) can write to the prod schema. People should have read-only access in prod."))
        elif f.environment == "prod":
            out.append(Finding("grants", "pass", "No person has write access to the prod schema."))
        else:
            out.append(Finding("grants", "info", f"{len(f.schema_grants)} principal(s) hold grants on the {f.environment} schema."))
    return out
