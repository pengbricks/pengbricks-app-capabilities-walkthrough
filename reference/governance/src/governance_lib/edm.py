"""SQL and plan builders for the Unity Catalog and EDM guide. Pure functions, unit tested.

Notebooks run the statements; nothing here touches a workspace.
"""

from __future__ import annotations

from typing import Iterable

from .sqlgen import grant_sql, qualified, quote

CUSTOMERS, ORDERS, GOLD = "edm_customers", "edm_orders", "edm_customer_revenue_gold"
SAMPLE_TABLES = [CUSTOMERS, ORDERS, GOLD]
TAG_PII, TAG_REGION = "edm_pii", "edm_region"
CERTIFICATION_TAG = "system.certification_status"
MASK_FUNCTION, REGION_FUNCTION = "edm_mask_last4", "edm_region_visible"
MASK_POLICY, REGION_POLICY = "edm_mask_identifiers", "edm_hide_region"
HIDDEN_REGION = "LATAM"
EXTERNAL_PREFIX = "edm_external_"
SCANNER_DEFAULT = "edm-scanner"

# The EDM contract: governed tags and where they apply. Plain table tags carry stewardship context.
GOVERNED_TAGS = [
    {"key": TAG_PII, "description": "Kind of personal identifier a column holds", "values": ["id_number", "contact"]},
    {"key": TAG_REGION, "description": "Column holds the data region used for row filtering", "values": []},
]
COLUMN_TAGS = [
    {"table": CUSTOMERS, "column": "national_id", "key": TAG_PII, "value": "id_number"},
    {"table": CUSTOMERS, "column": "email", "key": TAG_PII, "value": "contact"},
    {"table": CUSTOMERS, "column": "region", "key": TAG_REGION, "value": ""},
]
TABLE_TAGS = [
    {"table": CUSTOMERS, "key": "edm_domain", "value": "customer"},
    {"table": ORDERS, "key": "edm_domain", "value": "sales"},
    {"table": GOLD, "key": "edm_domain", "value": "sales"},
    {"table": CUSTOMERS, "key": "edm_steward_group", "value": "customer-data-stewards"},
]


def _lit(text: str) -> str:
    return text.replace("'", "''")


def _tag_word(text: str) -> str:
    return "`" + text.replace("`", "``") + "`"


def plan_upsert(existing: Iterable[str], desired: Iterable[str]) -> dict[str, list[str]]:
    """Decide create or update by name: what to create, what to update in place, what is extra."""
    have, want = set(existing), list(dict.fromkeys(desired))
    return {
        "create": [n for n in want if n not in have],
        "update": [n for n in want if n in have],
        "extra": sorted(have - set(want)),
    }


def plan_removal(existing: Iterable[str], prefix: str) -> list[str]:
    """Names to delete: only those with the guide prefix. An empty list makes cleanup a no-op."""
    return sorted(n for n in set(existing) if n.startswith(prefix))


def set_tag_sql(obj_type: str, obj: str, key: str, value: str = "") -> str:
    """SET TAG ON <TABLE|COLUMN> with the documented backtick syntax. Setting it again overwrites."""
    if obj_type not in ("TABLE", "COLUMN"):
        raise ValueError(f"unsupported object type: {obj_type}")
    stmt = f"SET TAG ON {obj_type} {obj} {_tag_word(key)}"
    return f"{stmt} = {_tag_word(value)}" if value else stmt


def alter_tag_sql(table: str, key: str, value: str, column: str | None = None) -> str:
    """ALTER ... SET TAGS, the form that works for plain tags. Safe to repeat."""
    target = f"ALTER TABLE {table} ALTER COLUMN {quote(column)}" if column else f"ALTER TABLE {table}"
    return f"{target} SET TAGS ('{_lit(key)}' = '{_lit(value)}')"


def unset_tag_sql(table: str, key: str, column: str | None = None) -> str:
    target = f"ALTER TABLE {table} ALTER COLUMN {quote(column)}" if column else f"ALTER TABLE {table}"
    return f"{target} UNSET TAGS ('{_lit(key)}')"


def last4_mask_sql(function: str) -> str:
    return (f"CREATE OR REPLACE FUNCTION {function}(val STRING) RETURNS STRING "
            "RETURN concat(repeat('*', greatest(length(val) - 4, 0)), right(val, 4))")


def region_filter_sql(function: str, hidden: str = HIDDEN_REGION) -> str:
    return (f"CREATE OR REPLACE FUNCTION {function}(region STRING) RETURNS BOOLEAN "
            f"RETURN region IS NULL OR region <> '{_lit(hidden)}'")


def mask_policy_sql(name: str, table: str, function: str, principal: str, tag: str, value: str) -> str:
    return (f"CREATE POLICY {quote(name)}\n  ON TABLE {table}\n  COLUMN MASK {function}\n  TO {quote(principal)}\n"
            f"  FOR TABLES\n  MATCH COLUMNS has_tag_value('{_lit(tag)}', '{_lit(value)}') AS id_col\n  ON COLUMN id_col")


def row_filter_policy_sql(name: str, table: str, function: str, principal: str, tag: str) -> str:
    return (f"CREATE POLICY {quote(name)}\n  ON TABLE {table}\n  ROW FILTER {function}\n  TO {quote(principal)}\n"
            f"  FOR TABLES\n  MATCH COLUMNS has_tag('{_lit(tag)}') AS region\n  USING COLUMNS (region)")


def drop_policy_sql(name: str, table: str) -> str:
    return f"DROP POLICY IF EXISTS {quote(name)} ON TABLE {table}"


def scanner_grants(scanner: str, catalog: str, schema: str, tables: Iterable[str] = SAMPLE_TABLES) -> list[str]:
    """Least-privilege GRANT statements for a read-only EDM scanner. Printed, never run by the guide."""
    stmts = [
        grant_sql(["USE_CATALOG"], "CATALOG", qualified(catalog), scanner),
        grant_sql(["USE_SCHEMA"], "SCHEMA", qualified(catalog, schema), scanner),
    ]
    stmts += [grant_sql(["SELECT"], "TABLE", qualified(catalog, schema, t), scanner) for t in tables]
    stmts += [
        grant_sql(["USE_CATALOG"], "CATALOG", qualified("system"), scanner),
        grant_sql(["USE_SCHEMA"], "SCHEMA", qualified("system", "access"), scanner),
        grant_sql(["SELECT"], "TABLE", qualified("system", "access", "table_lineage"), scanner),
        grant_sql(["SELECT"], "TABLE", qualified("system", "access", "column_lineage"), scanner),
    ]
    return stmts


def _in_list(tables: Iterable[str]) -> str:
    return ", ".join(f"'{_lit(t)}'" for t in tables)


def feed_queries(catalog: str, schema: str, tables: Iterable[str] = SAMPLE_TABLES, days: int = 30) -> dict[str, str]:
    """SELECT statements for the edm_metadata_feed_* tables, keyed by table name."""
    names = _in_list(tables)
    info = f"{qualified(catalog)}.information_schema"
    scope = f"table_catalog = '{_lit(catalog)}' AND table_schema = '{_lit(schema)}' AND table_name IN ({names})"
    tag_scope = f"catalog_name = '{_lit(catalog)}' AND schema_name = '{_lit(schema)}' AND table_name IN ({names})"
    full = lambda col: f"concat('{_lit(catalog)}.{_lit(schema)}.', {col})"  # noqa: E731
    sys_scope = lambda col: f"{col} IN ({', '.join(repr(catalog + '.' + schema + '.' + t) for t in tables)})"  # noqa: E731
    window = f"event_time >= current_timestamp() - INTERVAL {int(days)} DAYS"
    return {
        "edm_metadata_feed_tables": f"SELECT table_catalog, table_schema, table_name, table_type, table_owner, comment, created, last_altered, current_timestamp() AS exported_at FROM {info}.tables WHERE {scope}",
        "edm_metadata_feed_columns": f"SELECT table_catalog, table_schema, table_name, column_name, ordinal_position, data_type, is_nullable, comment, current_timestamp() AS exported_at FROM {info}.columns WHERE {scope}",
        "edm_metadata_feed_tags": (
            f"SELECT 'table' AS object_level, table_name, CAST(NULL AS STRING) AS column_name, tag_name, tag_value, current_timestamp() AS exported_at FROM {info}.table_tags WHERE {tag_scope} "
            f"UNION ALL SELECT 'column', table_name, column_name, tag_name, tag_value, current_timestamp() FROM {info}.column_tags WHERE {tag_scope}"),
        "edm_metadata_feed_privileges": f"SELECT grantor, grantee, table_catalog, table_schema, table_name, privilege_type, is_grantable, inherited_from, current_timestamp() AS exported_at FROM {info}.table_privileges WHERE {scope}",
        "edm_metadata_feed_table_lineage": (
            "SELECT source_table_full_name, target_table_full_name, source_type, target_type, event_time, created_by, current_timestamp() AS exported_at "
            f"FROM system.access.table_lineage WHERE {window} AND ({sys_scope('source_table_full_name')} OR {sys_scope('target_table_full_name')})"),
        "edm_metadata_feed_column_lineage": (
            "SELECT source_table_full_name, source_column_name, target_table_full_name, target_column_name, event_time, created_by, current_timestamp() AS exported_at "
            f"FROM system.access.column_lineage WHERE {window} AND ({sys_scope('source_table_full_name')} OR {sys_scope('target_table_full_name')})"),
    }


def external_objects(catalog: str, schema: str) -> dict:
    """The external source and BI report the guide registers, and how they relate to Unity Catalog tables.

    URLs use example.com, so nothing points at a real system.
    """
    customers, gold = f"{catalog}.{schema}.{CUSTOMERS}", f"{catalog}.{schema}.{GOLD}"
    return {
        "metadata": [
            {"name": f"{EXTERNAL_PREFIX}crm_customers", "system_type": "POSTGRESQL", "entity_type": "table",
             "url": "postgresql://crm.example.com:5432/crm", "description": "CRM customer table that feeds edm_customers",
             "columns": ["customer_id", "customer_name", "email", "national_id", "region"],
             "properties": {"owner_team": "crm-platform"}},
            {"name": f"{EXTERNAL_PREFIX}revenue_report", "system_type": "POWER_BI", "entity_type": "report",
             "url": "https://bi.example.com/reports/customer-revenue", "description": "BI report that reads the gold table",
             "columns": [], "properties": {"owner_team": "finance-bi"}},
        ],
        "relationships": [
            {"source": {"external": f"{EXTERNAL_PREFIX}crm_customers"}, "target": {"table": customers},
             "columns": [{"source": "customer_id", "target": "customer_id"}, {"source": "email", "target": "email"}]},
            {"source": {"table": gold}, "target": {"external": f"{EXTERNAL_PREFIX}revenue_report"}, "columns": []},
        ],
    }


def certification_sql(table: str) -> str:
    return set_tag_sql("TABLE", table, CERTIFICATION_TAG, "certified")


TABLE_COMMENTS = {
    CUSTOMERS: "EDM guide sample: customers with personal identifiers. Steward group: customer-data-stewards.",
    ORDERS: "EDM guide sample: one row per order.",
    GOLD: "EDM guide sample, gold: revenue per customer. Built from edm_customers and edm_orders.",
}
COLUMN_COMMENTS = {
    (CUSTOMERS, "customer_id"): "Business key for a customer",
    (CUSTOMERS, "email"): "Contact email address (personal data)",
    (CUSTOMERS, "national_id"): "Government identifier (personal data, masked by policy)",
    (CUSTOMERS, "region"): "Sales region; row filter key",
    (ORDERS, "order_id"): "Business key for an order",
    (ORDERS, "amount"): "Order value in USD",
    (GOLD, "revenue_usd"): "Sum of order amounts for the customer",
}


def comment_sql(table: str, comment: str, column: str | None = None) -> str:
    """COMMENT ON TABLE or COLUMN. Setting the same comment again is a no-op."""
    kind = f"COLUMN {table}.{quote(column)}" if column else f"TABLE {table}"
    return f"COMMENT ON {kind} IS '{_lit(comment)}'"


def contract_mode(rows: Iterable[dict]) -> str:
    """'governed' when every column tag in the contract was applied as a governed tag, otherwise 'plain'."""
    columns = [r for r in rows if r.get("column_name")]
    ok = bool(columns) and all(r.get("tag_kind") == "governed" and r.get("applied") for r in columns)
    return "governed" if ok else "plain"


def normalize_tag_mode(value: str | None) -> str:
    """The tag_mode job parameter: 'governed' (default when blank) or 'plain'."""
    mode = (value or "governed").strip().lower()
    if mode not in ("governed", "plain"):
        raise ValueError(f"tag_mode must be governed or plain, not {value!r}")
    return mode
