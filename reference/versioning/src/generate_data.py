"""Generate deterministic sample rows for the dataset named in the use-case spec (dbldatagen)."""

from __future__ import annotations

import re

from versioning_common import fq, load_spec, parse_args


def spark_type(name: str):
    from pyspark.sql import types as T

    decimal = re.fullmatch(r"decimal\((\d+),\s*(\d+)\)", name.strip().lower())
    if decimal:
        return T.DecimalType(int(decimal.group(1)), int(decimal.group(2)))
    return {"string": T.StringType(), "date": T.DateType(), "int": T.IntegerType(),
            "bigint": T.LongType(), "double": T.DoubleType()}[name.strip().lower()]


def column_options(column: dict) -> dict:
    if "expr" in column:
        return {"expr": column["expr"], "baseColumn": "id"}
    options: dict = {"random": True}
    if "values" in column:
        options["values"] = list(column["values"])
        if "weights" in column:
            options["weights"] = list(column["weights"])
    for key, target in (("min", "minValue"), ("max", "maxValue"), ("begin", "begin"), ("end", "end"), ("interval", "interval")):
        if key in column:
            options[target] = column[key]
    return options


def main() -> None:
    args = parse_args()
    from databricks.sdk.runtime import spark
    import dbldatagen as dg
    from versioning_common import contracts_for

    spec = load_spec(args.use_case_file)
    dataset = spec["dataset"]
    contracts = contracts_for(args, spec)

    # The generated shape must match the latest nonbreaking contract the job seeds from.
    latest_v1 = max((v for v in contracts if v.startswith("1.")), key=lambda v: tuple(map(int, v.split("."))))
    expected = [c["name"] for c in contracts[latest_v1]["columns"]]
    declared = [c["name"] for c in dataset["columns"]]
    assert declared == expected, f"spec columns {declared} do not match contract v{latest_v1} {expected}"

    generator = dg.DataGenerator(
        spark, name=f"{spec['name']}_{dataset['name']}", rows=int(dataset["rows"]), partitions=2,
        randomSeedMethod="hash_fieldname", randomSeed=int(spec["seed"]),
    ).withIdOutput()  # dbldatagen drops `id` from the output unless asked
    for column in dataset["columns"]:
        generator = generator.withColumn(column["name"], spark_type(column["type"]), **column_options(column))
    df = generator.build().select(*declared)

    target = fq(args.catalog, args.schema, f"{dataset['name']}_seed")
    df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(target)
    print(f"seed={spec['seed']} rows={spark.table(target).count()} -> {target}")
    spark.table(target).show(5, truncate=False)


if __name__ == "__main__":
    main()
