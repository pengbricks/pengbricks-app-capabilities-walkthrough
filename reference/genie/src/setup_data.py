"""Generate the sample tables from the use-case spec with dbldatagen (fixed seed, so reruns are identical)."""

from __future__ import annotations

import argparse
import re

from genie_lib import load_spec


def spark_type(name: str):
    from pyspark.sql import types as T

    decimal = re.fullmatch(r"decimal\((\d+),\s*(\d+)\)", name.strip().lower())
    if decimal:
        return T.DecimalType(int(decimal.group(1)), int(decimal.group(2)))
    return {"string": T.StringType(), "date": T.DateType(), "int": T.IntegerType(), "double": T.DoubleType()}[name.strip().lower()]


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
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    parser.add_argument("--recreate", action="store_true", help="drop and regenerate tables, which also removes comments and tags")
    args = parser.parse_args()

    import dbldatagen as dg
    from databricks.sdk.runtime import spark

    spec = load_spec(args.use_case_file)
    for index, table in enumerate(spec["tables"]):
        full_name = f"`{args.catalog}`.`{args.schema}`.`{table['name']}`"
        exists = spark.catalog.tableExists(f"{args.catalog}.{args.schema}.{table['name']}")
        if exists and not args.recreate:
            print(f"{full_name} exists, keeping it")
            continue
        spark.sql(f"DROP TABLE IF EXISTS {full_name}")
        generator = dg.DataGenerator(
            spark,
            name=f"{spec['name']}_{table['name']}",
            rows=int(table["rows"]),
            partitions=4,
            randomSeedMethod="hash_fieldname",
            randomSeed=int(spec["seed"]) + index,
        ).withIdOutput()
        for column in table["columns"]:
            generator = generator.withColumn(column["name"], spark_type(column["type"]), **column_options(column))
        frame = generator.build().drop("id")
        frame.write.format("delta").saveAsTable(f"{args.catalog}.{args.schema}.{table['name']}")
        print(f"Created {full_name} with {table['rows']} rows")


if __name__ == "__main__":
    main()
