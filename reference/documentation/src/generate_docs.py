"""Generate documentation for every table in a schema and apply descriptions as UC comments."""
import os
import sys
from datetime import datetime, timezone


def _import_helpers(src_dir):
    sys.path.insert(0, src_dir)
    global clean_comment, parse_ai_json, render_index, render_table_page, sql_str
    from doc_render import clean_comment, parse_ai_json, render_index, render_table_page, sql_str  # noqa: F401

LOG_TABLE = "documentation_refresh_log"


def safe(spark, query, default=None):
    """Run a query; return rows, or `default` when the system table is missing or not readable."""
    try:
        return spark.sql(query).collect()
    except Exception as e:  # noqa: BLE001
        print(f"WARN query failed ({str(e)[:120]}): {query[:80]}")
        return default if default is not None else []


def profile(spark, fq, columns):
    """Row count, per-column null rate, and uniqueness of the first id-like column."""
    exprs = ["COUNT(*) AS n"] + [f"AVG(CASE WHEN `{c}` IS NULL THEN 1.0 ELSE 0.0 END) AS nr_{i}"
                                 for i, c in enumerate(columns)]
    key = next((c for c in columns if c.lower().endswith("id") or c.lower() == "id"), columns[0])
    exprs.append(f"COUNT(DISTINCT `{key}`) AS key_distinct")
    r = spark.sql(f"SELECT {', '.join(exprs)} FROM {fq}").first()
    n = int(r["n"])
    return {"row_count": n, "null_rates": {c: (float(r[f"nr_{i}"]) if n else None) for i, c in enumerate(columns)},
            "key_column": key, "key_distinct": int(r["key_distinct"]),
            "key_unique": n > 0 and int(r["key_distinct"]) == n}


def draft_descriptions(spark, endpoint, fq, cols, prof, upstream):
    col_lines = "\n".join(f"- {n} ({t}), null rate {prof['null_rates'][n]:.1%}" if prof["null_rates"][n] is not None
                          else f"- {n} ({t})" for n, t in cols)
    prompt = (
        f"You document Unity Catalog tables. Table: {fq}\nRows: {prof['row_count']}\n"
        f"Upstream tables: {', '.join(upstream) or 'none (source table)'}\nColumns:\n{col_lines}\n\n"
        "Return only a JSON object: {\"table\": \"one or two sentence table description\", "
        "\"columns\": {\"<column name>\": \"short column description\"}, "
        "\"usage_guidance\": \"two or three sentences on how to use this table and what to watch for\"}. "
        "Be specific and plain. No marketing language.")
    rows = safe(spark, f"SELECT ai_query('{sql_str(endpoint)}', '{sql_str(prompt)}') AS r")
    return parse_ai_json(rows[0]["r"]) if rows else {}


def main(catalog, schema, endpoint, volume_path, src_dir):
    _import_helpers(src_dir)
    from pyspark.sql import SparkSession
    spark = SparkSession.builder.getOrCreate()
    started = datetime.now(timezone.utc)
    stamp = started.strftime("%Y-%m-%d %H:%M UTC")
    p = f"`{catalog}`.`{schema}`"
    spark.sql(f"""CREATE TABLE IF NOT EXISTS {p}.{LOG_TABLE} (
        refresh_ts TIMESTAMP, tables_documented INT, comments_applied INT, ai_failures INT,
        model_endpoint STRING, volume_path STRING, status STRING, run_user STRING)""")

    tables = spark.sql(f"""SELECT table_name, table_owner FROM `{catalog}`.information_schema.tables
        WHERE table_schema = '{sql_str(schema)}' AND table_name <> '{LOG_TABLE}' AND table_type IN ('MANAGED','EXTERNAL')
        ORDER BY table_name""").collect()
    os.makedirs(volume_path, exist_ok=True)

    summaries, applied, ai_fail = [], 0, 0
    for tr in tables:
        name, fq_plain = tr["table_name"], f"{catalog}.{schema}.{tr['table_name']}"
        fq = f"{p}.`{name}`"
        cols = [(r["column_name"], r["data_type"]) for r in spark.sql(
            f"""SELECT column_name, data_type FROM `{catalog}`.information_schema.columns
                WHERE table_schema='{sql_str(schema)}' AND table_name='{sql_str(name)}' ORDER BY ordinal_position""").collect()]
        tags = [(r["tag_name"], r["tag_value"]) for r in safe(spark, f"""SELECT tag_name, tag_value
            FROM `{catalog}`.information_schema.table_tags
            WHERE schema_name='{sql_str(schema)}' AND table_name='{sql_str(name)}'""")]
        prof = profile(spark, fq, [c for c, _ in cols])

        up = [r[0] for r in safe(spark, f"""SELECT DISTINCT source_table_full_name FROM system.access.table_lineage
            WHERE target_table_full_name='{sql_str(fq_plain)}' AND source_table_full_name IS NOT NULL
            ORDER BY 1""")]
        down = [r[0] for r in safe(spark, f"""SELECT DISTINCT target_table_full_name FROM system.access.table_lineage
            WHERE source_table_full_name='{sql_str(fq_plain)}' AND target_table_full_name IS NOT NULL
            ORDER BY 1""")]
        readers = [(r["who"], r["n"], str(r["last"])[:19]) for r in safe(spark, f"""
            SELECT created_by AS who, COUNT(*) AS n, MAX(event_time) AS last FROM system.access.table_lineage
            WHERE source_table_full_name='{sql_str(fq_plain)}' AND event_time >= current_timestamp() - INTERVAL 30 DAYS
            GROUP BY created_by ORDER BY n DESC LIMIT 5""")]
        queries = [r[0] for r in safe(spark, f"""SELECT statement_text FROM system.query.history
            WHERE start_time >= current_timestamp() - INTERVAL 30 DAYS AND statement_text ILIKE '%{sql_str(name)}%'
              AND statement_text NOT ILIKE '%ai_query%' AND statement_text NOT ILIKE '%information_schema%'
            ORDER BY start_time DESC LIMIT 3""")]

        ai = draft_descriptions(spark, endpoint, fq_plain, cols, prof, up)
        if not ai:
            ai_fail += 1
        col_desc = ai.get("columns", {}) if isinstance(ai.get("columns"), dict) else {}
        table_desc = clean_comment(ai.get("table", ""))

        if table_desc:
            spark.sql(f"COMMENT ON TABLE {fq} IS '{sql_str(table_desc)}'")
            applied += 1
        for c, _ in cols:
            d = clean_comment(col_desc.get(c, ""), 250)
            if d:
                spark.sql(f"ALTER TABLE {fq} ALTER COLUMN `{c}` COMMENT '{sql_str(d)}'")
                applied += 1

        page = render_table_page({
            "full_name": fq_plain, "description": table_desc, "owner": tr["table_owner"], "tags": tags,
            "columns": [{"name": c, "type": t, "null_rate": prof["null_rates"][c],
                         "description": clean_comment(col_desc.get(c, ""), 250)} for c, t in cols],
            "upstream": up, "downstream": down, "row_count": prof["row_count"], "key_column": prof["key_column"],
            "key_unique": prof["key_unique"], "key_distinct": prof["key_distinct"], "readers": readers,
            "queries": queries, "usage_guidance": ai.get("usage_guidance", ""), "generated_at": stamp, "model": endpoint})
        with open(os.path.join(volume_path, f"{name}.md"), "w") as f:
            f.write(page)
        summaries.append({"name": name, "owner": tr["table_owner"], "row_count": prof["row_count"], "summary": table_desc})
        print(f"documented {fq_plain}")

    with open(os.path.join(volume_path, "index.md"), "w") as f:
        f.write(render_index(summaries, stamp))

    user = spark.sql("SELECT current_user()").first()[0]
    status = "SUCCESS" if ai_fail == 0 else f"PARTIAL ({ai_fail} tables without AI descriptions)"
    spark.sql(f"""INSERT INTO {p}.{LOG_TABLE} VALUES (current_timestamp(), {len(summaries)}, {applied}, {ai_fail},
        '{sql_str(endpoint)}', '{sql_str(volume_path)}', '{sql_str(status)}', '{sql_str(user)}')""")
    print(f"done: {len(summaries)} tables, {applied} comments, status {status}")


if __name__ == "__main__":
    main(*sys.argv[1:6])
