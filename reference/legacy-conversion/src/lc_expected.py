"""Independent pure-Python reference implementation. Builds expected results
from the generated input rows using the declarative `expected` block of the spec.
Rows are lists of dicts (values as returned by Spark: Decimal, datetime, str)."""
from datetime import timedelta
from decimal import Decimal


def _day(v):
    return v.date() if hasattr(v, "date") else v


def build_dataset(rows, cfg):
    out = list(rows)
    if "filter_not_in" in cfg:
        for col, vals in cfg["filter_not_in"].items():
            out = [r for r in out if r[col] not in vals]
    if "coalesce" in cfg:
        out = [{**r, **{c: (r[c] if r[c] is not None else d) for c, d in cfg["coalesce"].items()}} for r in out]
    if "latest_per" in cfg:
        out = latest_per(out, cfg["latest_per"])
    return out


def latest_per(rows, cfg):
    best = {}
    for r in rows:
        k = tuple(r[c] for c in cfg["key"])
        if k not in best or r[cfg["order_by"]] > best[k][cfg["order_by"]]:
            best[k] = r
    return list(best.values())


def build_table(rows, cfg):
    if "group_by" in cfg:
        groups = {}
        for r in rows:
            key = tuple(
                _day(r[spec["date_of"]]) if isinstance(spec, dict) else r[spec]
                for spec in cfg["group_by"].values()
            )
            groups.setdefault(key, []).append(r)
        out = []
        for key, grp in groups.items():
            row = dict(zip(cfg["group_by"].keys(), key))
            for name, agg in cfg["aggregates"].items():
                row[name] = len(grp) if agg == "count" else sum((Decimal(g[agg["sum"]]) for g in grp), Decimal(0))
            out.append(row)
        return out
    if "date_range" in cfg:
        dr = cfg["date_range"]
        days = [_day(r[dr["column"]]) for r in rows]
        if not days:
            return []
        lo, hi = min(days), max(days)
        return [{dr["output"]: lo + timedelta(days=i)} for i in range((hi - lo).days + 1)]
    if "latest_per" in cfg:
        rows = latest_per(rows, cfg["latest_per"])
    cols = cfg.get("columns")
    return [{c: r[c] for c in cols} if cols else dict(r) for r in rows]


def build_expected(source_rows, expected_cfg):
    datasets = {"source": source_rows}
    for name, cfg in expected_cfg["datasets"].items():
        datasets[name] = build_dataset(datasets[cfg["from"]], cfg)
    return {name: build_table(datasets[cfg["from"]], cfg) for name, cfg in expected_cfg["tables"].items()}


def _norm(v):
    if isinstance(v, Decimal):
        return str(v.quantize(Decimal("0.01")))
    return str(v)


def reconcile_table(name, expected_rows, actual_rows, cfg):
    """Return a list of check dicts: row count, key set, content, checksums."""
    checks = []

    def add(check_type, expected, actual):
        checks.append({"check_name": f"{name}.{check_type}", "table_name": name, "check_type": check_type,
                       "expected": str(expected), "actual": str(actual), "passed": expected == actual})

    add("row_count", len(expected_rows), len(actual_rows))
    keys = cfg.get("key_columns", [])
    if keys:
        ek = sorted(tuple(_norm(r[k]) for k in keys) for r in expected_rows)
        ak = sorted(tuple(_norm(r[k]) for k in keys) for r in actual_rows)
        checks.append({"check_name": f"{name}.key_set", "table_name": name, "check_type": "key_set",
                       "expected": f"{len(ek)} keys", "actual": f"{len(ak)} keys",
                       "passed": ek == ak})
    for col in cfg.get("compare_columns", []):
        ev = sorted((tuple(_norm(r[k]) for k in keys), _norm(r[col])) for r in expected_rows)
        av = sorted((tuple(_norm(r[k]) for k in keys), _norm(r[col])) for r in actual_rows)
        checks.append({"check_name": f"{name}.values.{col}", "table_name": name, "check_type": "column_values",
                       "expected": f"{len(ev)} values", "actual": f"{len(av)} values", "passed": ev == av})
    for col in cfg.get("sum_columns", []):
        e = sum((Decimal(str(r[col])) for r in expected_rows), Decimal(0))
        a = sum((Decimal(str(r[col])) for r in actual_rows), Decimal(0))
        checks.append({"check_name": f"{name}.checksum.{col}", "table_name": name, "check_type": "checksum",
                       "expected": str(e), "actual": str(a), "passed": e == a})
    return checks
