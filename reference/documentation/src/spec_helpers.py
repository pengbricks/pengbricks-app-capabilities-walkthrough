"""Pure helpers that turn a use-case spec into dbldatagen arguments or a seeded Python generator."""
import datetime as dt
import random


def load_spec(path):
    import yaml
    with open(path) as f:
        return yaml.safe_load(f)


def column_kwargs(col: dict) -> dict:
    """Translate one column spec into dbldatagen `withColumn` keyword arguments."""
    kind = col["kind"]
    kw = {"colType": col["type"]}
    if col.get("null_pct"):
        kw["percentNulls"] = col["null_pct"]
    if kind == "int_range":
        kw.update(minValue=col["min"], maxValue=col["max"], random=True)
    elif kind == "float_range":
        kw.update(minValue=col["min"], maxValue=col["max"], random=True, step=10 ** -col.get("round", 2))
    elif kind == "choice":
        kw.update(values=col["values"], random=True)
        if col.get("weights"):
            kw["weights"] = col["weights"]
    elif kind == "date_range":
        kw.update(begin=col["begin"], end=col["end"], interval="1 day", random=True)
    elif kind == "sequence":
        kw.update(minValue=col.get("min", 1), uniqueValues=col.get("unique"))
    else:
        raise ValueError(f"unknown column kind: {kind}")
    return kw


def python_rows(table: dict, seed: int):
    """Seeded pure-Python fallback: returns (rows, schema_ddl). Same spec, deterministic output."""
    rng = random.Random(f"{seed}:{table['name']}")
    rows = []
    for i in range(table["rows"]):
        row = []
        for c in table["columns"]:
            if c.get("null_pct") and rng.random() < c["null_pct"]:
                row.append(None)
                continue
            k = c["kind"]
            if k == "int_range":
                row.append(rng.randint(c["min"], c["max"]))
            elif k == "float_range":
                row.append(round(rng.uniform(c["min"], c["max"]), c.get("round", 2)))
            elif k == "choice":
                row.append(rng.choices(c["values"], weights=c.get("weights"))[0])
            elif k == "date_range":
                b, e = dt.date.fromisoformat(str(c["begin"])), dt.date.fromisoformat(str(c["end"]))
                row.append(b + dt.timedelta(days=rng.randint(0, (e - b).days)))
            elif k == "sequence":
                row.append(c.get("min", 1) + i)
            else:
                raise ValueError(f"unknown column kind: {k}")
        rows.append(tuple(row))
    return rows, ", ".join(f"{c['name']} {c['type']}" for c in table["columns"])


def render_sql(sql: str, fq: dict) -> str:
    """Replace {table_name} placeholders with fully qualified, backticked names."""
    return sql.format(**fq)
