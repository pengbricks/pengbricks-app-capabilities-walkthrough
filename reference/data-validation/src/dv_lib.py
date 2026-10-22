"""Helpers for the data validation guide.

Everything here that builds SQL, evaluates a threshold, or compares slices is plain Python, so the
unit tests run without Spark. `run_check` is the one function that touches Spark and the source.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Callable

import yaml

CHECK_TYPES = ("reconciliation", "row_count", "unique", "null_rate", "referential", "freshness", "custom_sql")
SEVERITIES = ("error", "warn")
OPERATORS = {
    "eq": lambda observed, threshold: observed == threshold,
    "le": lambda observed, threshold: observed <= threshold,
    "ge": lambda observed, threshold: observed >= threshold,
    "lt": lambda observed, threshold: observed < threshold,
    "gt": lambda observed, threshold: observed > threshold,
}
OPERATOR_TEXT = {"eq": "=", "le": "<=", "ge": ">=", "lt": "<", "gt": ">"}
# Without an `op` in the spec, a check passes when the observed value is on this side of the threshold.
DEFAULT_OPERATOR = {
    "reconciliation": "le",  # mismatched slices
    "row_count": "ge",  # rows
    "unique": "le",  # duplicate keys
    "null_rate": "le",  # share of nulls
    "referential": "le",  # orphan rows
    "freshness": "le",  # hours since the newest value
    "custom_sql": "le",
}
REQUIRED_FIELDS = {
    "reconciliation": ("dataset", "source_table", "metrics"),
    "row_count": ("dataset",),
    "unique": ("dataset", "columns"),
    "null_rate": ("dataset", "column"),
    "referential": ("dataset", "column", "ref_dataset", "ref_column"),
    "freshness": ("dataset", "column"),
    "custom_sql": ("dataset", "sql"),
}
IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def load_spec(path: str | Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def ident(name: str) -> str:
    """A table or column name that is safe to put in SQL."""
    if not isinstance(name, str) or not IDENTIFIER.match(name):
        raise ValueError(f"not a plain identifier: {name!r}")
    return name


# ---------- sample source data ----------


def order_rows(spec: dict[str, Any], today: date) -> list[tuple[Any, ...]]:
    """(order_id, customer_id, order_date, status, amount). Rows that break a rule are picked by order_id."""
    d = spec["data"]
    rows = []
    for i in range(1, d["orders"] + 1):
        customer = None if i % d["missing_customer_every"] == 0 else 1 + i % d["customers"]
        amount = Decimal(10 + (i * 37) % 490) + Decimal((i * 13) % 100) / 100
        if i % d["negative_amount_every"] == 0:
            amount = -amount
        status = "UNKNOWN" if i % d["unknown_status_every"] == 0 else d["statuses"][i % len(d["statuses"])]
        rows.append((i, customer, today - timedelta(days=i % d["days"]), status, amount))
    return rows


def customer_rows(spec: dict[str, Any]) -> list[tuple[Any, ...]]:
    segments = ["consumer", "small business", "enterprise"]
    return [(i, f"Customer {i:03d}", segments[i % len(segments)]) for i in range(1, spec["data"]["customers"] + 1)]


def late_change_ids(spec: dict[str, Any]) -> list[int]:
    """Order ids that move to another day in the source after the copy is taken."""
    d = spec["data"]
    change = d["late_change"]
    ids = [i for i in range(1, d["orders"] + 1) if i % d["days"] == change["from_day_offset"]]
    return ids[: change["order_count"]]


def restore_late_change(workspace: Any, cfg: dict[str, Any], spec: dict[str, Any]) -> None:
    """Put the orders that `late_change_ids` names back on their original day, so a rerun copies the same source."""
    today = datetime.now(timezone.utc).date()
    from_day = today - timedelta(days=spec["data"]["late_change"]["from_day_offset"])
    with connect(connection_settings(workspace, cfg)) as conn, conn.cursor() as cur:
        cur.execute(f"UPDATE {ident(cfg['schema'])}.orders SET order_date = %s WHERE order_id = ANY(%s)", (from_day, late_change_ids(spec)))


SOURCE_DDL = """
CREATE SCHEMA IF NOT EXISTS {schema};
DROP TABLE IF EXISTS {schema}.orders;
DROP TABLE IF EXISTS {schema}.customers;
CREATE TABLE {schema}.customers (customer_id int PRIMARY KEY, name text, segment text);
CREATE TABLE {schema}.orders (
  order_id int PRIMARY KEY, customer_id int, order_date date, status text, amount numeric(12,2)
);
"""


# ---------- Lakebase connection (same pattern as the relational extract guide) ----------


def connection_settings(workspace: Any, cfg: dict[str, Any]) -> dict[str, Any]:
    """Host, user, database, and a short-lived OAuth token (valid for about an hour)."""
    name = f"projects/{cfg['lakebase_project']}/branches/{cfg['lakebase_branch']}/endpoints/{cfg['lakebase_endpoint']}"
    return {
        "host": workspace.postgres.get_endpoint(name=name).status.hosts.host,
        "port": 5432,
        "user": workspace.current_user.me().user_name,
        "password": workspace.postgres.generate_database_credential(endpoint=name).token,
        "dbname": cfg["lakebase_database"],
        "sslmode": "require",
    }


CREATE_PROJECT_COMMAND = (
    "databricks postgres create-project {project} --json "
    "'{{\"spec\": {{\"display_name\": \"Capability guides\", \"pg_version\": 17, \"default_endpoint_settings\": "
    "{{\"autoscaling_limit_min_cu\": 0.5, \"autoscaling_limit_max_cu\": 2, \"suspend_timeout_duration\": \"300s\"}}}}}}'"
)


def require_lakebase_project(workspace: Any, project: str) -> None:
    """Stop with the create command, before anything changes, when the Lakebase project does not exist."""
    from databricks.sdk.errors import NotFound

    try:
        workspace.postgres.get_project(name=f"projects/{project}")
    except NotFound:
        raise RuntimeError(
            f"The Lakebase project '{project}' does not exist in this workspace. Run: "
            + CREATE_PROJECT_COMMAND.format(project=project)
            + " (or set lakebase_project to an existing project). Nothing was changed."
        ) from None


def connect(settings: dict[str, Any]):
    import psycopg2

    return psycopg2.connect(**settings)


def remote_query(spark: Any, connection_name: str, database: str, sql: str) -> Any:
    """Run SQL inside the source database through a Unity Catalog connection; only the result crosses the wire."""
    quoted = " ".join(sql.split()).replace("'", "\\'")
    return spark.sql(f"SELECT * FROM remote_query('{connection_name}', database => '{database}', query => '{quoted}')")


def find_pipeline_id(workspace: Any, name_part: str) -> str:
    """Id of the one pipeline whose name contains name_part. Development mode adds a prefix to the name."""
    matches = [p for p in workspace.pipelines.list_pipelines() if name_part in (p.name or "")]
    if len(matches) != 1:
        raise ValueError(f"expected one pipeline with '{name_part}' in its name, found {[p.name for p in matches]}")
    return matches[0].pipeline_id


# ---------- one checksum, written once per SQL dialect from one column list ----------


@dataclass(frozen=True)
class Column:
    name: str
    kind: str  # text | int | decimal | date


def columns_from_spec(items: list[dict[str, str]]) -> list[Column]:
    return [Column(ident(item["name"]), item["kind"]) for item in items]


def _pg_expr(column: Column) -> str:
    if column.kind == "decimal":
        return f"to_char({column.name}, 'FM9999999990.00')"
    if column.kind == "date":
        return f"to_char({column.name}, 'YYYY-MM-DD')"
    return f"{column.name}::text"


def _spark_expr(column: Column) -> str:
    if column.kind == "decimal":
        return f"CAST(CAST({column.name} AS DECIMAL(12,2)) AS STRING)"
    if column.kind == "date":
        return f"date_format({column.name}, 'yyyy-MM-dd')"
    return f"CAST({column.name} AS STRING)"


def checksum_expr(columns: list[Column], dialect: str) -> str:
    """Sum of the first 8 hex digits of md5 over a canonical row string. Equal on both sides when the rows are equal."""
    if dialect == "postgres":
        row = " || '|' || ".join(f"coalesce({_pg_expr(c)}, '')" for c in columns)
        return f"coalesce(sum(('x' || substr(md5({row}), 1, 8))::bit(32)::bigint), 0)"
    row = ", '|', ".join(f"coalesce({_spark_expr(c)}, '')" for c in columns)
    return f"coalesce(sum(CAST(conv(substr(md5(concat({row})), 1, 8), 16, 10) AS BIGINT)), 0)"


# ---------- reconciliation: aggregate SQL for each side ----------


def metric_alias(metric: str) -> str:
    """row_count -> row_count, sum:amount -> sum_amount, distinct:order_id -> distinct_order_id."""
    if metric in ("row_count", "checksum"):
        return metric
    kind, _, column = metric.partition(":")
    if kind not in ("sum", "distinct") or not column:
        raise ValueError(f"unknown metric {metric!r}: use row_count, checksum, sum:<column>, or distinct:<column>")
    return f"{kind}_{ident(column)}"


def _metric_sql(metric: str, columns: list[Column], dialect: str) -> str:
    if metric == "row_count":
        return "count(*)"
    if metric == "checksum":
        return checksum_expr(columns, dialect)
    kind, _, column = metric.partition(":")
    if kind == "sum":
        return f"coalesce(sum({ident(column)}), 0)"
    return f"count(distinct {ident(column)})"


def aggregate_sql(dialect: str, table: str, metrics: list[str], columns: list[Column], grain: str | None = None) -> str:
    """One row per slice (or one row, 'all'), with one column per metric. The source side runs through remote_query."""
    cast_text = "text" if dialect == "postgres" else "STRING"
    slice_sql = f"CAST({ident(grain)} AS {cast_text})" if grain else "'all'"
    select = ", ".join(f"{_metric_sql(m, columns, dialect)} AS {metric_alias(m)}" for m in metrics)
    group = " GROUP BY 1" if grain else ""
    return f"SELECT {slice_sql} AS slice, {select} FROM {table}{group}"


def to_slices(rows: list[Any], metrics: list[str]) -> dict[str, dict[str, Decimal]]:
    """Rows from either side -> {slice: {metric alias: Decimal}}."""
    aliases = [metric_alias(m) for m in metrics]
    out: dict[str, dict[str, Decimal]] = {}
    for row in rows:
        values = row.asDict() if hasattr(row, "asDict") else dict(row)
        out[str(values["slice"])] = {a: Decimal(str(values[a])) for a in aliases}
    return out


def diff_slices(
    source: dict[str, dict[str, Decimal]], target: dict[str, dict[str, Decimal]], tolerance: Decimal = Decimal(0)
) -> list[dict[str, Any]]:
    """Slices whose metrics differ by more than the tolerance, or that exist on one side only."""
    mismatches = []
    for key in sorted(set(source) | set(target)):
        left, right = source.get(key), target.get(key)
        if left is None or right is None:
            mismatches.append({"slice": key, "missing": "source" if left is None else "target"})
            continue
        bad = {m: (left[m], right[m]) for m in left if abs(left[m] - right[m]) > tolerance}
        if bad:
            mismatches.append({"slice": key, "metrics": bad})
    return mismatches


def plain(value: Decimal) -> str:
    """A Decimal without trailing zeros or an exponent: 11903.600000 -> 11903.6, 5E+1 -> 50."""
    return format(value.normalize(), "f")


def describe_mismatches(mismatches: list[dict[str, Any]], limit: int = 6) -> str:
    parts = []
    for item in mismatches[:limit]:
        if "missing" in item:
            parts.append(f"{item['slice']}: missing in {item['missing']}")
        else:
            parts.append(f"{item['slice']}: " + ", ".join(f"{m} source {plain(s)} vs target {plain(t)}" for m, (s, t) in item["metrics"].items()))
    extra = len(mismatches) - limit
    return "; ".join(parts) + (f"; and {extra} more" if extra > 0 else "")


# ---------- results ----------


@dataclass
class Result:
    check_name: str
    check_type: str
    dataset: str
    severity: str
    observed: float | None
    operator: str
    expected: float
    status: str  # pass | fail | error
    details: str = ""
    extra: dict[str, Any] = field(default_factory=dict)


def passes(observed: float | None, op: str, threshold: float) -> bool:
    return observed is not None and OPERATORS[op](observed, threshold)


def blocking(results: list[Result], block_on: str) -> list[Result]:
    """Results that should stop the next task. block_on: error (default), warn (any failure), or none."""
    if block_on == "none":
        return []
    if block_on not in SEVERITIES:
        raise ValueError(f"block_on must be error, warn, or none, not {block_on!r}")
    levels = ("error",) if block_on == "error" else SEVERITIES
    return [r for r in results if r.status != "pass" and r.severity in levels]


def validate_spec(spec: dict[str, Any]) -> list[str]:
    """Problems in the checks list, so a typo fails before any check runs."""
    problems, seen = [], set()
    for position, check in enumerate(spec.get("checks", [])):
        name = check.get("name") or f"#{position}"
        if name in seen:
            problems.append(f"{name}: duplicate name")
        seen.add(name)
        kind = check.get("type")
        if kind not in CHECK_TYPES:
            problems.append(f"{name}: unknown type {kind!r}")
            continue
        if check.get("severity") not in SEVERITIES:
            problems.append(f"{name}: severity must be one of {SEVERITIES}")
        if "threshold" not in check:
            problems.append(f"{name}: missing threshold")
        if check.get("op", DEFAULT_OPERATOR[kind]) not in OPERATORS:
            problems.append(f"{name}: unknown op {check.get('op')!r}")
        for key in REQUIRED_FIELDS[kind]:
            if key not in check:
                problems.append(f"{name}: {kind} needs {key}")
        if kind == "reconciliation" and check.get("source", "live") not in ("live", "snapshot"):
            problems.append(f"{name}: source must be live or snapshot")
        if kind == "reconciliation":
            try:
                [metric_alias(m) for m in check.get("metrics", [])]
            except ValueError as exc:
                problems.append(f"{name}: {exc}")
    return problems


# ---------- running one check ----------


def single_value_sql(check: dict[str, Any], ns: str) -> str:
    """SQL that returns one `observed` value, for every type except reconciliation."""
    kind = check["type"]
    table = f"{ns}.{ident(check['dataset'])}"
    if kind == "row_count":
        return f"SELECT count(*) AS observed FROM {table}"
    if kind == "unique":
        cols = ", ".join(ident(c) for c in check["columns"])
        return f"SELECT count(*) AS observed FROM (SELECT {cols} FROM {table} GROUP BY {cols} HAVING count(*) > 1)"
    if kind == "null_rate":
        column = ident(check["column"])
        return f"SELECT coalesce(avg(CASE WHEN {column} IS NULL THEN 1.0 ELSE 0.0 END), 0) AS observed FROM {table}"
    if kind == "referential":
        column, ref_column = ident(check["column"]), ident(check["ref_column"])
        ref = f"{ns}.{ident(check['ref_dataset'])}"
        return (
            f"SELECT count(*) AS observed FROM {table} d LEFT ANTI JOIN {ref} r "
            f"ON d.{column} = r.{ref_column} WHERE d.{column} IS NOT NULL"
        )
    if kind == "freshness":
        column = ident(check["column"])
        return (
            f"SELECT (unix_timestamp(current_timestamp()) - unix_timestamp(max({column}))) / 3600.0 AS observed FROM {table}"
        )
    if kind == "custom_sql":
        return check["sql"].replace("{ns}", ns)
    raise ValueError(f"no single-value SQL for {kind}")


@dataclass
class Context:
    spark: Any
    ns: str
    source_schema: str
    checksum_columns: list[Column]
    remote: Callable[[str], Any]  # runs SQL in the source through remote_query and returns a DataFrame
    snapshot: Callable[[str], dict[str, dict[str, Decimal]]]  # source aggregates captured earlier in the run, by check name


def _reconcile(check: dict[str, Any], ctx: Context) -> tuple[float, str]:
    metrics = check["metrics"]
    grain = check.get("grain")
    target_sql = aggregate_sql("spark", f"{ctx.ns}.{ident(check['dataset'])}", metrics, ctx.checksum_columns, grain)
    target = to_slices(ctx.spark.sql(target_sql).collect(), metrics)
    if check.get("source", "live") == "snapshot":
        source = ctx.snapshot(check["name"])
        where = "snapshot"
    else:
        source_sql = aggregate_sql("postgres", f"{ctx.source_schema}.{ident(check['source_table'])}", metrics, ctx.checksum_columns, grain)
        source = to_slices(ctx.remote(source_sql).collect(), metrics)
        where = "live"
    mismatches = diff_slices(source, target, Decimal(str(check.get("tolerance", 0))))
    slices = len(set(source) | set(target))
    detail = f"{len(mismatches)} of {slices} slices differ ({where} source, grain {grain or 'whole table'})"
    if mismatches:
        detail += ". " + describe_mismatches(mismatches)
    return float(len(mismatches)), detail


def run_check(check: dict[str, Any], ctx: Context) -> Result:
    """Run one check from the spec. A check that cannot run is recorded as status `error`, not skipped."""
    kind = check["type"]
    op = check.get("op", DEFAULT_OPERATOR[kind])
    threshold = float(check["threshold"])
    base = dict(
        check_name=check["name"], check_type=kind, dataset=check["dataset"], severity=check["severity"],
        operator=OPERATOR_TEXT[op], expected=threshold,
    )
    try:
        if kind == "reconciliation":
            observed, details = _reconcile(check, ctx)
        else:
            row = ctx.spark.sql(single_value_sql(check, ctx.ns)).first()
            observed = None if row["observed"] is None else float(row["observed"])
            details = "no values to measure" if observed is None else f"observed {observed:g}, expected {OPERATOR_TEXT[op]} {threshold:g}"
    except Exception as exc:  # recorded, so one broken check does not hide the others
        return Result(observed=None, status="error", details=f"{type(exc).__name__}: {str(exc).splitlines()[0][:300]}", **base)
    status = "pass" if passes(observed, op, threshold) else "fail"
    return Result(observed=observed, status=status, details=details, **base)


def require_ready(spark: Any, ns: str, stage: str, run_id: str, spec: dict[str, Any] | None = None) -> None:
    """Stop with a plain message, before anything changes, when an earlier task has not left its output.

    stage is run_validations, publish_metric_view, or read_lineage.
    """
    exists = lambda name: spark.catalog.tableExists(f"{ns}.{name}")  # noqa: E731
    problems = []
    if stage == "run_validations":
        problems += [f"{t} is missing (run 03_load_target and the pipeline)" for t in ("dv_orders_landed", "dv_customers_landed", "dv_orders_silver") if not exists(t)]
        wanted = [c["name"] for c in (spec or {}).get("checks", []) if c.get("type") == "reconciliation" and c.get("source") == "snapshot"]
        if wanted:
            have = set()
            if exists("dv_source_snapshot"):
                have = {r[0] for r in spark.sql(f"SELECT DISTINCT check_name FROM {ns}.dv_source_snapshot WHERE run_id = '{run_id}'").collect()}
            problems += [f"no source snapshot for {n} in run {run_id} (run 04_snapshot_source with the same run_id)" for n in wanted if n not in have]
    else:
        if not exists("dv_orders_silver"):
            problems.append("dv_orders_silver is missing (run the pipeline)")
        if not exists("dv_check_results") or spark.sql(f"SELECT count(*) FROM {ns}.dv_check_results WHERE run_id = '{run_id}'").first()[0] == 0:
            problems.append(f"no check results for run {run_id} (run 06_run_validations with the same run_id)")
    if problems:
        raise RuntimeError("An earlier task has not run: " + "; ".join(problems) + ". Nothing was changed.")
