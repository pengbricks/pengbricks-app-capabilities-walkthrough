"""Build the sample table chain from a use-case spec so Unity Catalog records lineage.

Args: catalog schema spec_path src_dir
Generation uses dbldatagen with a fixed seed; if that fails, falls back to a seeded Python generator.
"""
import sys


def generate_dbldatagen(spark, table, seed):
    import dbldatagen as dg
    from spec_helpers import column_kwargs
    gen = dg.DataGenerator(spark, name=table["name"], rows=table["rows"], seedMethod="hash_fieldname",
                           seed=seed, partitions=4)
    for col in table["columns"]:
        gen = gen.withColumn(col["name"], **column_kwargs(col))
    return gen.build()


def main(catalog, schema, spec_path, src_dir):
    sys.path.insert(0, src_dir)
    from pyspark.sql import SparkSession
    from spec_helpers import load_spec, python_rows, render_sql

    spark = SparkSession.builder.getOrCreate()
    spec = load_spec(spec_path)
    seed = spec["seed"]
    fq = {t["name"]: f"`{catalog}`.`{schema}`.`{t['name']}`" for t in spec["tables"]}

    for t in spec["tables"]:
        target = fq[t["name"]]
        if t["kind"] == "generate":
            try:
                df = generate_dbldatagen(spark, t, seed)
                method = "dbldatagen"
            except Exception as e:  # noqa: BLE001
                print(f"WARN dbldatagen failed ({str(e)[:200]}); using seeded Python fallback")
                rows, ddl = python_rows(t, seed)
                df = spark.createDataFrame(rows, ddl)
                method = "python-fallback"
            df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(target)
            print(f"{t['name']}: generated {t['rows']} rows via {method}, seed {seed}")
        elif t["kind"] == "sql":
            spark.sql(f"CREATE OR REPLACE TABLE {target} AS {render_sql(t['sql'], fq)}")
            print(f"{t['name']}: built from SQL")
        else:
            raise ValueError(f"unknown table kind {t['kind']}")
        for k, v in (spec.get("tags") or {}).items():
            spark.sql(f"ALTER TABLE {target} SET TAGS ('{k}' = '{v}')")
        if t.get("comment_hint"):
            spark.sql(f"ALTER TABLE {target} SET TBLPROPERTIES ('doc_hint' = '{t['comment_hint'].replace(chr(39), '')}')")


if __name__ == "__main__":
    main(*sys.argv[1:5])
