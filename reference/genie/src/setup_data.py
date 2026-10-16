"""Generate the sample tables from the use-case spec with dbldatagen (fixed seed, so reruns are identical).

Used by the first notebook of both genie guides."""

from __future__ import annotations

import re


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


def generate_tables(spark, spec: dict, catalog: str, schema: str, recreate: bool = False) -> None:
    """Create each sample table from the spec. Existing tables are kept unless `recreate` is set.

    Recreating drops and regenerates the table, which also removes its comments and tags.
    """
    import dbldatagen as dg

    for index, table in enumerate(spec["tables"]):
        full_name = f"`{catalog}`.`{schema}`.`{table['name']}`"
        exists = spark.catalog.tableExists(f"{catalog}.{schema}.{table['name']}")
        if exists and not recreate:
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
        frame.write.format("delta").saveAsTable(f"{catalog}.{schema}.{table['name']}")
        print(f"Created {full_name} with {table['rows']} rows")
