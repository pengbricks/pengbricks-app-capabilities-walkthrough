"""Generate the sample tables from the use-case spec with the sample-data generator (`src/sample_data.py`, fixed seed, so reruns are identical).

Used by the first notebook of both genie guides."""

from __future__ import annotations


def generate_tables(spark, spec: dict, catalog: str, schema: str, recreate: bool = False) -> None:
    """Create each sample table from the spec. Existing tables are kept unless `recreate` is set.

    Recreating drops and regenerates the table, which also removes its comments and tags.
    """
    import sample_data

    for index, table in enumerate(spec["tables"]):
        full_name = f"`{catalog}`.`{schema}`.`{table['name']}`"
        exists = spark.catalog.tableExists(f"{catalog}.{schema}.{table['name']}")
        if exists and not recreate:
            print(f"{full_name} exists, keeping it")
            continue
        spark.sql(f"DROP TABLE IF EXISTS {full_name}")
        frame = sample_data.generate(
            spark,
            table["columns"],
            int(table["rows"]),
            int(spec["seed"]) + index,
            f"{spec['name']}_{table['name']}",
            partitions=4,
        )
        frame.write.format("delta").saveAsTable(f"{catalog}.{schema}.{table['name']}")
        print(f"Created {full_name} with {table['rows']} rows")
