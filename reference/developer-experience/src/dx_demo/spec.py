"""Loads a use-case spec and builds sample data from it. No domain names live here."""
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List

import yaml

_DDL = {"string": "string", "double": "double", "int": "int", "bigint": "bigint", "timestamp": "timestamp"}


def load_spec(path) -> Dict[str, Any]:
    return yaml.safe_load(Path(path).read_text())


def ddl_schema(spec: Dict[str, Any]) -> str:
    return ", ".join(f"{c['name']} {_DDL[c['type']]}" for c in spec["columns"])


def expected_clean_count(spec: Dict[str, Any]) -> int:
    """Rows that must survive cleaning: duplicates collapse, bad rows are dropped."""
    e = spec.get("edge_cases", {})
    n = spec["rows"]
    bad = sum(int(n * e.get(k, 0)) for k in ("null_key_fraction", "blank_key_fraction", "negative_value_fraction"))
    return n - bad


def _parse_ts(text: str) -> datetime:
    return datetime.strptime(text, "%Y-%m-%d %H:%M:%S")


def generate_base_rows(spec: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Seeded pure-Python generator. Fallback when Spark is not available."""
    rng = random.Random(spec["seed"])
    rows = []
    for i in range(spec["rows"]):
        row: Dict[str, Any] = {}
        for c in spec["columns"]:
            if "prefix" in c:
                row[c["name"]] = f"{c['prefix']}{i:0{c.get('width', 5)}d}"
            elif "values" in c:
                row[c["name"]] = rng.choice(c["values"])
            elif c["type"] == "timestamp":
                lo, hi = _parse_ts(c["begin"]), _parse_ts(c["end"])
                row[c["name"]] = lo + timedelta(seconds=rng.randrange(int((hi - lo).total_seconds())))
            else:
                row[c["name"]] = rng.uniform(c["min"], c["max"])
        rows.append(row)
    return rows


def spark_columns(spec: Dict[str, Any]) -> List[Dict[str, Any]]:
    """The spec columns in the form sample_data.generate takes: a `prefix` column becomes an expression."""
    out = []
    for c in spec["columns"]:
        if "prefix" in c:
            expr = f"concat('{c['prefix']}', lpad(cast(id as string), {c.get('width', 5)}, '0'))"
            out.append({"name": c["name"], "type": c["type"], "expr": expr})
        elif c["type"] == "timestamp":
            out.append({**c, "interval": "1 second"})
        else:
            out.append(dict(c))
    return out


def generate_base_rows_spark(spark, spec: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Same spec through the sample-data generator (src/sample_data.py). Rows are returned sorted by key."""
    from sample_data import generate

    df = generate(spark, spark_columns(spec), rows=spec["rows"], seed=spec["seed"], name=spec["name"], partitions=1)
    return [r.asDict() for r in df.orderBy(spec["key_column"]).collect()]


def inject_edge_cases(rows: List[Dict[str, Any]], spec: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Deterministically add the edge cases named in the spec. Row order is stable."""
    e = spec.get("edge_cases", {})
    key, val, ts = spec["key_column"], spec["value_column"], spec["timestamp_column"]
    rng = random.Random(spec["seed"] + 1)
    n = len(rows)
    counts = {k: int(n * e.get(k, 0)) for k in (
        "null_key_fraction", "blank_key_fraction", "negative_value_fraction",
        "duplicate_fraction", "null_timestamp_duplicate_fraction")}
    picks = rng.sample(range(n), sum(counts.values()))
    groups, start = {}, 0
    for k, c in counts.items():
        groups[k], start = picks[start:start + c], start + c

    out = [dict(r) for r in rows]
    for i in groups["null_key_fraction"]:
        out[i][key] = None
    for i in groups["blank_key_fraction"]:
        out[i][key] = "   "
    for i in groups["negative_value_fraction"]:
        out[i][val] = -abs(out[i][val])
    extra = []
    for i in groups["duplicate_fraction"]:
        d = dict(out[i])
        d[key] = f" {d[key].lower()} "
        d[ts] = d[ts] + timedelta(days=1)
        d[val] = d[val] * 1.1
        extra.append(d)
    for i in groups["null_timestamp_duplicate_fraction"]:
        d = dict(out[i])
        d[ts] = None
        d[val] = d[val] * 2
        extra.append(d)
    for r in out + extra:
        if isinstance(r.get(val), float):
            r[val] = round(r[val], 2)
    return out + extra
