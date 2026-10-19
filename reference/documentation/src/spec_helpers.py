"""Helpers that turn a use-case spec into generated sample tables (src/sample_data.py)."""


def load_spec(path):
    import yaml
    with open(path) as f:
        return yaml.safe_load(f)


def generator_columns(table: dict) -> list[dict]:
    """Translate a table's column specs into the column dicts `sample_data.generate` takes."""
    columns = []
    for col in table["columns"]:
        kind = col["kind"]
        out = {"name": col["name"], "type": col["type"]}
        if kind in ("int_range", "float_range"):
            out.update(min=col["min"], max=col["max"])
        elif kind == "choice":
            out["values"] = col["values"]
            if col.get("weights"):
                out["weights"] = col["weights"]
        elif kind == "date_range":
            out.update(begin=str(col["begin"]), end=str(col["end"]), interval="1 day")
        elif kind == "sequence":
            out["expr"] = f"{col.get('min', 1)} + id"
        else:
            raise ValueError(f"unknown column kind: {kind}")
        columns.append(out)
    return columns


def table_frame(spark, table: dict, seed: int):
    """The table as a Spark DataFrame. The same spec and seed give the same rows."""
    from pyspark.sql import functions as F

    from sample_data import generate

    df = generate(spark, generator_columns(table), rows=table["rows"], seed=seed, name=table["name"],
                  partitions=4, keep_id=True)
    for col in table["columns"]:
        if col["kind"] == "float_range":
            df = df.withColumn(col["name"], F.round(F.col(col["name"]), col.get("round", 2)))
        if col.get("null_pct"):
            # Hash of the seed, column, and id, so the same rows are null on every run.
            draw = F.pmod(F.xxhash64(F.lit(int(seed)), F.lit(table["name"]), F.lit(col["name"] + "_null"), F.col("id")),
                          F.lit(1_000_000)) / F.lit(1_000_000.0)
            df = df.withColumn(col["name"], F.when(draw < F.lit(float(col["null_pct"])), F.lit(None)).otherwise(F.col(col["name"])))
    return df.select(*[col["name"] for col in table["columns"]])


def render_sql(sql: str, fq: dict) -> str:
    """Replace {table_name} placeholders with fully qualified, backticked names."""
    return sql.format(**fq)
