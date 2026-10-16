"""Add the semantic layer from the spec: table and column comments, tags, and the Unity Catalog metric view.

Used by the semantics notebook of both genie guides."""

from __future__ import annotations

from genie_lib import metric_view_yaml, sql_str


def tag_clause(tags: dict[str, str]) -> str:
    return ", ".join(f"{sql_str(key)} = {sql_str(str(value))}" for key, value in tags.items())


def apply_semantics(spark, spec: dict, catalog: str, schema: str) -> str:
    """Comment and tag the tables and columns, then create the metric view. Returns the metric view YAML."""
    base = f"`{catalog}`.`{schema}`"
    for table in spec["tables"]:
        full = f"{base}.`{table['name']}`"
        spark.sql(f"COMMENT ON TABLE {full} IS {sql_str(table['comment'])}")
        if table.get("tags"):
            spark.sql(f"ALTER TABLE {full} SET TAGS ({tag_clause(table['tags'])})")
        for column, comment in table.get("column_comments", {}).items():
            spark.sql(f"ALTER TABLE {full} ALTER COLUMN `{column}` COMMENT {sql_str(comment)}")
        for column, tags in table.get("column_tags", {}).items():
            spark.sql(f"ALTER TABLE {full} ALTER COLUMN `{column}` SET TAGS ({tag_clause(tags)})")
        print(f"Annotated {full}")

    view = spec["metric_view"]
    definition = metric_view_yaml(spec, catalog, schema)
    spark.sql(f"CREATE OR REPLACE VIEW {base}.`{view['name']}` WITH METRICS LANGUAGE YAML AS $$\n{definition}$$")
    print(f"Created metric view {base}.`{view['name']}`")
    return definition
