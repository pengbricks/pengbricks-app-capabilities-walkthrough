"""Create the sample orders table (named by the spec, agent_orders), the PII mask, and the Unity Catalog function that agents call as a tool.

Idempotent: reruns overwrite the table and replace the function and mask.
"""

import argparse
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
args = p.parse_args()
sys.path.insert(0, args.src_dir)

import agents_common as ac
from databricks.sdk.runtime import dbutils, spark


def build_orders(spec: dict):
    """Generate the orders with dbldatagen. The same spec and seed give the same rows."""
    import dbldatagen as dg

    data = spec["data"]
    gen = dg.DataGenerator(
        spark, name="orders", rows=data["rows"], partitions=2, randomSeed=spec["seed"], randomSeedMethod="hash_fieldname"
    ).withIdOutput()
    for col in data["columns"]:
        if col["kind"] == "values":
            gen = gen.withColumn(col["name"], "string", values=col["values"], weights=col["weights"], random=True)
        elif col["kind"] == "range":
            gen = gen.withColumn(col["name"], "int", minValue=col["min"], maxValue=col["max"], random=True)
        elif col["kind"] == "template":
            gen = gen.withColumn(col["name"], "string", template=col["template"], random=True)
        else:
            raise ValueError(f"Unknown column kind: {col['kind']}")
    df = gen.build()
    return df.selectExpr(f"CAST(id + {data['id_offset']} AS BIGINT) AS order_id", *[c["name"] for c in data["columns"]])


def main() -> None:
    spec = ac.load_spec(args.spec)
    cat, sch = args.catalog, args.schema
    table = ac.qualified(cat, sch, spec["data"]["table"])
    tool = spec["tool"]
    fn = ac.qualified(cat, sch, tool["function"])
    mask = ac.qualified(cat, sch, tool["mask_function"])

    if spark.catalog.tableExists(table):
        spark.sql(f"ALTER TABLE {table} ALTER COLUMN customer_email DROP MASK")
    build_orders(spec).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
    spark.sql(
        f"""CREATE OR REPLACE FUNCTION {mask}(email STRING)
            RETURNS STRING
            COMMENT 'Shows the address only to members of {tool["pii_group"]}'
            RETURN CASE WHEN is_account_group_member('{tool["pii_group"]}') THEN email
                        ELSE concat('***@', split(email, '@')[1]) END"""
    )
    spark.sql(f"ALTER TABLE {table} ALTER COLUMN customer_email SET MASK {mask}")
    spark.sql(
        f"""CREATE OR REPLACE FUNCTION {fn}({tool["parameter"]} BIGINT COMMENT '{tool["parameter_comment"]}')
            RETURNS STRING
            COMMENT '{tool["comment"]}'
            RETURN (SELECT concat('order ', o.order_id, ': status=', o.status, ', carrier=', o.carrier,
                                  ', category=', o.category, ', days_since_order=', o.days_since_order,
                                  ', customer=', o.customer_email)
                    FROM {table} o WHERE o.order_id = {tool["parameter"]} LIMIT 1)"""
    )
    sample = spark.sql(f"SELECT {fn}({tool['sample_order_id']}) AS r").first()["r"]
    rows = spark.table(table).count()
    print(f"table={table} rows={rows}\nfunction={fn}\nsample call: {sample}")
    dbutils.jobs.taskValues.set(key="function", value=fn)
    dbutils.jobs.taskValues.set(key="rows", value=rows)


main()
