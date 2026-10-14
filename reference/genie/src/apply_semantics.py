"""Add the semantic layer from the spec: table and column comments, tags, and the Unity Catalog metric view."""

from __future__ import annotations

import argparse

from genie_lib import load_spec, metric_view_yaml, sql_str


def tag_clause(tags: dict[str, str]) -> str:
    return ", ".join(f"{sql_str(key)} = {sql_str(str(value))}" for key, value in tags.items())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    spec = load_spec(args.use_case_file)
    base = f"`{args.catalog}`.`{args.schema}`"
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
    definition = metric_view_yaml(spec, args.catalog, args.schema)
    spark.sql(f"CREATE OR REPLACE VIEW {base}.`{view['name']}` WITH METRICS LANGUAGE YAML AS $$\n{definition}$$")
    print(f"Created metric view {base}.`{view['name']}`")
    print(definition)


if __name__ == "__main__":
    main()
