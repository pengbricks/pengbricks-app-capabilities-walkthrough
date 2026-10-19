"""Generate the sample input table from the use case spec with the sample-data generator
(src/sample_data.py) and a fixed seed, so every run produces the same rows."""

from sample_data import generate as generate_columns


def generator_columns(sd):
    """Spec columns as the column dicts `sample_data.generate` takes: an `expr`, or a `range`."""
    columns = []
    for c in sd["columns"]:
        out = {"name": c["name"], "type": c["type"]}
        if "expr" in c:
            out["expr"] = c["expr"]
        elif "range" in c:
            out.update(min=c["range"]["min"], max=c["range"]["max"])
        columns.append(out)
    return columns


def generate(spark, spec):
    sd = spec["sample_data"]
    df = generate_columns(spark, generator_columns(sd), rows=sd["rows"], seed=sd["seed"],
                          name="legacy_conversion_orders", partitions=sd.get("partitions", 1))
    # `omit` columns only feed later expressions; they are not part of the table.
    keep = [c["name"] for c in sd["columns"] if not c.get("omit")]
    return df.select(*keep), "sample_data"
