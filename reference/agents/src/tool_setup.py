"""Create the sample orders table, the PII mask, and the Unity Catalog function that agents call as a tool.

Shared by both agent guides. Idempotent: reruns overwrite the table and replace the function and mask.
"""

from __future__ import annotations

import agents_common as ac


def template_expression(template: str, seed: int) -> str:
    """SQL expression for a template where each `\\w` is a random lowercase letter. Fixed by seed and id."""
    parts = template.split("\\w")
    pieces = ["'" + parts[0].replace("'", "''") + "'"]
    for index, tail in enumerate(parts[1:]):
        pieces.append(f"substring('abcdefghijklmnopqrstuvwxyz', pmod(xxhash64(id, {int(seed)}, {index}), 26) + 1, 1)")
        pieces.append("'" + tail.replace("'", "''") + "'")
    return "concat(" + ", ".join(pieces) + ")"


def build_orders(spark, spec: dict):
    """Generate the orders with the sample-data generator. The same spec and seed give the same rows."""
    import sample_data

    data = spec["data"]
    columns = []
    for col in data["columns"]:
        if col["kind"] == "values":
            columns.append({"name": col["name"], "type": "string", "values": col["values"], "weights": col["weights"]})
        elif col["kind"] == "range":
            columns.append({"name": col["name"], "type": "int", "min": col["min"], "max": col["max"]})
        elif col["kind"] == "template":
            # The generator has no template option, so each \w becomes a letter drawn from a hash of the row id.
            columns.append({"name": col["name"], "type": "string", "expr": template_expression(col["template"], spec["seed"])})
        else:
            raise ValueError(f"Unknown column kind: {col['kind']}")
    df = sample_data.generate(spark, columns, data["rows"], spec["seed"], "orders", partitions=2, keep_id=True)
    return df.selectExpr(f"CAST(id + {data['id_offset']} AS BIGINT) AS order_id", *[c["name"] for c in data["columns"]])


def prepare_tool(spark, spec: dict, catalog: str, schema: str) -> tuple[str, int]:
    """Create the sample table, the PII mask, and the tool function. Returns (function name, row count)."""
    cat, sch = catalog, schema
    table = ac.qualified(cat, sch, spec["data"]["table"])
    tool = spec["tool"]
    fn = ac.qualified(cat, sch, tool["function"])
    mask = ac.qualified(cat, sch, tool["mask_function"])

    masked = spark.catalog.tableExists(table) and spark.sql(
        f"SELECT 1 FROM `{cat}`.information_schema.column_masks "
        f"WHERE table_schema = '{sch}' AND table_name = '{spec['data']['table']}' AND column_name = 'customer_email'"
    ).count() > 0
    if masked:  # an earlier run that stopped before SET MASK leaves none to drop
        spark.sql(f"ALTER TABLE {table} ALTER COLUMN customer_email DROP MASK")
    build_orders(spark, spec).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
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
    return fn, rows
