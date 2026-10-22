# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Masking pattern library
# MAGIC
# MAGIC Builds one sample table, `rcs_customers`, and applies six column-mask patterns and one row filter to it with `ALTER TABLE ... SET MASK` and `SET ROW FILTER`. Then it queries the table as the job identity, shows the masked output, and checks every value against an independent Python calculation.
# MAGIC
# MAGIC | Column | Pattern | Function |
# MAGIC |---|---|---|
# MAGIC | `ssn` | Role-aware partial mask (`is_account_group_member`) | `rcs_mask_ssn` |
# MAGIC | `email` | Salted `sha2` hash | `rcs_hash_email` |
# MAGIC | `phone` | Format-preserving partial mask with `mask()` | `rcs_mask_phone` |
# MAGIC | `home_address` | Null out | `rcs_null_out` |
# MAGIC | `salary` | Type-safe rounding (stays `DECIMAL(12,2)`) | `rcs_bucket_salary` |
# MAGIC | `birth_date` | Type-safe date truncation (stays `DATE`) | `rcs_year_only` |
# MAGIC | `card_number` | Last `n` characters, with `n` passed as a constant (`USING COLUMNS (4)`) | `rcs_mask_last_n` |
# MAGIC | row filter on `region` | Group sees all rows; others see the regions in `rcs_region_access` for `current_user()` | `rcs_region_filter` |
# MAGIC
# MAGIC ## Required setup
# MAGIC
# MAGIC The hash salt should come from a secret scope. Create it once. The identity that runs the job needs READ on the scope, which the creator has.
# MAGIC
# MAGIC ```bash
# MAGIC databricks secrets create-scope rcs-demo
# MAGIC databricks secrets put-secret rcs-demo hash-salt --string-value "$(openssl rand -hex 16)"
# MAGIC ```
# MAGIC
# MAGIC Without it the notebook uses a literal demo salt, prints a warning, and records `salt_source = demo literal` in `rcs_mask_results`. A literal salt in a repo is not secret, so use the scope for anything real. Either way the salt is written into the function body, which anyone with access to the function can read with `DESCRIBE FUNCTION EXTENDED`.
# MAGIC
# MAGIC ## Account-level objects
# MAGIC
# MAGIC `abac_mode` defaults to `off`: no governed tag and no ABAC policy is created, and nothing is written at the account level. Set `abac_mode` to `governed` to create the governed tag `rcs_class` and replace the table-level mask on `card_number` with a tag-driven ABAC policy. If the job identity cannot create governed tags, the notebook says so and falls back to `off`.
# MAGIC
# MAGIC The job identity is not in the group `pii_reader_group` unless you add it, so it sees masked values. If you add it, the notebook expects the real values and all rows.
# MAGIC
# MAGIC Safe to rerun: masks, the row filter and any policy are detached first, then functions use `CREATE OR REPLACE`, both tables are replaced, and the masks and filter are attached again. A governed tag that exists is updated in place, and `rcs_mask_results` is replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(
    dbutils, "capability_guides_row_column_security",
    ['catalog', 'schema', 'pii_reader_group', 'salt_scope', 'salt_key', 'abac_mode'],
    defaults={'pii_reader_group': 'rcs-pii-readers', 'salt_scope': 'rcs-demo', 'salt_key': 'hash-salt', 'abac_mode': 'off'},
)

# COMMAND ----------

import datetime as dt
from decimal import Decimal
from types import SimpleNamespace
from common import write_rows
from governance_lib import edm, masking as mk
from governance_lib.sqlgen import qualified

args = SimpleNamespace(
    catalog=params["catalog"], schema=params["schema"], group=params["pii_reader_group"],
    salt_scope=params["salt_scope"], salt_key=params["salt_key"], abac_mode=mk.normalize_abac_mode(params["abac_mode"]),
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## The step

# COMMAND ----------

ROWS = [
    ("C001", "NA", "alice@example.com", "123-45-6789", "+1-555-010-0001", "1 Main St, Austin", Decimal("84250.00"), dt.date(1988, 3, 14), "4111111111111111"),
    ("C002", "EMEA", "bruno@example.com", "234-56-7890", "+44-20-7946-0002", "2 High St, Leeds", Decimal("61000.00"), dt.date(1975, 11, 2), "5500000000000004"),
    ("C003", "APAC", "chen@example.com", "345-67-8901", "+81-3-5550-0003", "3 Ginza, Tokyo", Decimal("97500.00"), dt.date(1992, 7, 30), "340000000000009"),
    ("C004", "NA", "dana@example.com", "456-78-9012", "+1-555-010-0004", "4 Oak Ave, Denver", Decimal("52500.00"), dt.date(1969, 1, 9), "6011000000000004"),
    ("C005", "EMEA", "elif@example.com", "567-89-0123", "+90-212-555-0005", "5 Istiklal, Istanbul", Decimal("73400.00"), dt.date(2001, 5, 21), "3530111333300000"),
    ("C006", "LATAM", "fabio@example.com", "678-90-1234", "+55-11-5550-0006", "6 Paulista, Sao Paulo", Decimal("45100.00"), dt.date(1984, 12, 25), "4000000000000002"),
]
DDL = ("customer_id string, region string, email string, ssn string, phone string, home_address string, "
       "salary decimal(12,2), birth_date date, card_number string")
RESULT_DDL = "pattern string, column_name string, expected string, actual string, passed boolean, detail string"


def resolve_salt(args) -> tuple[str, str]:
    """Salt from the secret scope, or a clearly marked demo literal when the scope is missing."""
    try:
        return mk.validate_salt(dbutils.secrets.get(args.salt_scope, args.salt_key)), "secret scope"
    except Exception as exc:  # noqa: BLE001 - no scope, no key, or no READ: the fallback is the same
        print(f"WARNING: no salt in secret scope {args.salt_scope}/{args.salt_key} ({type(exc).__name__}).")
        print("WARNING: using the literal demo salt. Create the scope (see Required setup) for anything real.")
        return mk.DEMO_SALT, "demo literal"


def try_sql(spark, statement: str) -> bool:
    try:
        spark.sql(statement)
        return True
    except Exception:  # noqa: BLE001 - nothing attached yet, or the table is new
        return False


def detach(spark, table: str) -> None:
    """Remove the policy, filter and masks from an earlier run, so the functions can be replaced."""
    if not spark.catalog.tableExists(table):
        return
    try_sql(spark, edm.drop_policy_sql(mk.ABAC_POLICY, table))
    try_sql(spark, mk.drop_row_filter_sql(table))
    for column in [*mk.COLUMN_MASKS, mk.CARD_COLUMN]:
        try_sql(spark, mk.drop_mask_sql(table, column))


def ensure_governed_tag(w) -> tuple[bool, str]:
    """Create the governed tag rcs_class, or update it in place. Returns (available, reason)."""
    from databricks.sdk.errors import AlreadyExists, ResourceAlreadyExists
    from databricks.sdk.service.tags import TagPolicy, Value

    existing = {p.tag_key for p in w.tag_policies.list_tag_policies()}
    policy = TagPolicy(tag_key=mk.TAG_KEY, description="Masking pattern guide: kind of value a column holds", values=[Value(name=mk.TAG_VALUE)])
    try:
        if mk.TAG_KEY in existing:
            w.tag_policies.update_tag_policy(mk.TAG_KEY, policy, update_mask="description,values")
            print(f"governed tag {mk.TAG_KEY}: exists, updated in place")
        else:
            w.tag_policies.create_tag_policy(policy)
            print(f"governed tag {mk.TAG_KEY}: created")
    except (AlreadyExists, ResourceAlreadyExists):
        print(f"governed tag {mk.TAG_KEY}: already exists")
    except Exception as exc:  # noqa: BLE001
        return False, f"{type(exc).__name__}: {str(exc)[:200]}"
    return True, ""


def build(args, spark, salt: str) -> tuple[str, str]:
    """Create the data and the functions, attach the masks and filter. Returns (table, how the card column is masked)."""
    q = lambda name: qualified(args.catalog, args.schema, name)  # noqa: E731
    table, mapping = q(mk.TABLE), q(mk.MAPPING_TABLE)
    detach(spark, table)

    me = spark.sql("SELECT current_user() AS u").first()["u"]
    spark.sql(f"CREATE OR REPLACE TABLE {mapping} (principal STRING, region STRING)")
    spark.createDataFrame([(me, "NA")], "principal string, region string").write.mode("append").saveAsTable(mapping)
    spark.sql(f"CREATE OR REPLACE TABLE {table} ({DDL})")
    spark.createDataFrame(ROWS, DDL).write.mode("append").saveAsTable(table)

    fns = {name: q(name) for name in [*(f for f, _ in mk.COLUMN_MASKS.values()), mk.CARD_FUNCTION, mk.FILTER_FUNCTION]}
    spark.sql(mk.ssn_role_mask_sql(fns["rcs_mask_ssn"], args.group))
    spark.sql(mk.email_hash_sql(fns["rcs_hash_email"], salt))
    spark.sql(mk.phone_mask_sql(fns["rcs_mask_phone"]))
    spark.sql(mk.null_out_sql(fns["rcs_null_out"]))
    spark.sql(mk.salary_bucket_sql(fns["rcs_bucket_salary"], args.group))
    spark.sql(mk.year_only_sql(fns["rcs_year_only"], args.group))
    spark.sql(mk.last_n_sql(fns[mk.CARD_FUNCTION]))
    spark.sql(mk.region_filter_sql(fns[mk.FILTER_FUNCTION], mapping, args.group))

    for column, (function, label) in mk.COLUMN_MASKS.items():
        spark.sql(mk.set_mask_sql(table, column, fns[function]))
        print(f"{label}: {function} on {column}")
    spark.sql(mk.set_row_filter_sql(table, fns[mk.FILTER_FUNCTION], "region"))
    print(f"row filter: {mk.FILTER_FUNCTION} on region")

    how = "table-level mask"
    if args.abac_mode == "governed":
        from databricks.sdk import WorkspaceClient

        ok, reason = ensure_governed_tag(WorkspaceClient())
        if ok:
            try:
                spark.sql(edm.set_tag_sql("COLUMN", f"{table}.{qualified(mk.CARD_COLUMN)}", mk.TAG_KEY, mk.TAG_VALUE))
                spark.sql(mk.abac_mask_policy_sql(mk.ABAC_POLICY, table, fns[mk.CARD_FUNCTION], "account users",
                                                  mk.TAG_KEY, mk.TAG_VALUE, using=[4]))
                how = "ABAC policy"
            except Exception as exc:  # noqa: BLE001
                reason = f"{type(exc).__name__}: {str(exc)[:200]}"
        if how != "ABAC policy":
            print(f"MODE off (fallback): could not use governed tags or ABAC ({reason}). Using a table-level mask.")
    else:
        print("MODE off: no governed tag or ABAC policy is created, so nothing is written at the account level.")
    if how == "table-level mask":
        spark.sql(mk.set_mask_sql(table, mk.CARD_COLUMN, fns[mk.CARD_FUNCTION], [4]))
    print(f"card_number masked by: {how}")
    return table, how


def expected_row(salt: str, in_group: bool) -> dict:
    """What customer C001 should look like to the job identity, computed in Python."""
    r = ROWS[0]
    if in_group:
        return {"ssn": r[3], "email": mk.salted_sha256(r[2], salt), "phone": mk.phone_last4(r[4]), "home_address": None,
                "salary": str(r[6]), "birth_date": str(r[7]), "card_number": mk.last_n(r[8], 4)}
    return {"ssn": mk.ssn_last4(r[3]), "email": mk.salted_sha256(r[2], salt), "phone": mk.phone_last4(r[4]),
            "home_address": None, "salary": f"{mk.round_to_ten_thousand(r[6])}.00", "birth_date": mk.year_start(r[7].year),
            "card_number": mk.last_n(r[8], 4)}


def masking_patterns(args, spark) -> None:
    salt, salt_source = resolve_salt(args)
    table, how = build(args, spark, salt)
    in_group = bool(spark.sql(f"SELECT is_account_group_member('{args.group}')").first()[0])
    print(f"job identity in {args.group}: {in_group}")

    show = spark.sql(f"SELECT customer_id, region, ssn, email, phone, home_address, salary, birth_date, card_number FROM {table} ORDER BY customer_id")
    show.show(truncate=False)
    c001 = spark.sql(f"SELECT * FROM {table} WHERE customer_id = 'C001'").first().asDict()
    regions = sorted(r["region"] for r in spark.sql(f"SELECT DISTINCT region FROM {table}").collect())

    want = expected_row(salt, in_group)
    results = []
    labels = {c: label for c, (_, label) in mk.COLUMN_MASKS.items()}
    labels[mk.CARD_COLUMN] = f"last n via {how}"
    for column, expected in want.items():
        actual = None if c001[column] is None else str(c001[column])
        results.append({"pattern": labels[column], "column_name": column, "expected": str(expected), "actual": str(actual),
                        "passed": actual == expected, "detail": f"salt_source = {salt_source}" if column == "email" else ""})
    want_regions = sorted({r[1] for r in ROWS}) if in_group else ["NA"]
    results.append({"pattern": "row filter via mapping table", "column_name": "region", "expected": ",".join(want_regions),
                    "actual": ",".join(regions), "passed": regions == want_regions, "detail": f"in {args.group}: {in_group}"})

    info = f"{qualified(args.catalog)}.information_schema"
    masks = spark.sql(f"SELECT column_name FROM {info}.column_masks WHERE table_schema = '{args.schema}' AND table_name = '{mk.TABLE}'").collect()
    filters = spark.sql(f"SELECT filter_name FROM {info}.row_filters WHERE table_schema = '{args.schema}' AND table_name = '{mk.TABLE}'").collect()
    want_masks = len(mk.COLUMN_MASKS) + (1 if how == "table-level mask" else 0)
    results.append({"pattern": "inventory", "column_name": "-", "expected": f"{want_masks} masks, 1 filter",
                    "actual": f"{len(masks)} masks, {len(filters)} filter", "passed": (len(masks) == want_masks if how == "table-level mask" else len(masks) >= want_masks) and len(filters) == 1,
                    "detail": "card_number is covered by the ABAC policy" if how == "ABAC policy" else ""})

    write_rows(spark, args.catalog, args.schema, mk.RESULTS_TABLE, results, RESULT_DDL)
    for row in results:
        print("PASS" if row["passed"] else "FAIL", row["pattern"], row["column_name"], "expected", row["expected"], "actual", row["actual"])
    assert all(r["passed"] for r in results), [r for r in results if not r["passed"]]

# COMMAND ----------

masking_patterns(args, spark)
