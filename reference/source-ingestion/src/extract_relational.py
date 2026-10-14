"""Land the source with Lakehouse Federation: full table extracts and a custom SQL result.

Both go through remote_query on the Unity Catalog connection, so the SQL runs inside Postgres: a
plain SELECT for the full extracts, and for the custom query the join, aggregate, window function,
and database function all execute at the source.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--src-dir", required=True)
    parser.add_argument("--use-case-file", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    sys.path.insert(0, args.src_dir)

    from databricks.sdk.runtime import spark
    from source_ingestion.relational_sql import CUSTOM_QUERY
    from source_ingestion.spec import load_spec

    cfg = load_spec(args.use_case_file)["relational"]
    ns = f"{args.catalog}.{args.schema}"
    log = []

    def remote(sql: str):
        """Run SQL inside Postgres through the Unity Catalog connection; only the result crosses the wire."""
        quoted = " ".join(sql.split()).replace("'", "\\'")
        return spark.sql(
            f"SELECT * FROM remote_query('{cfg['connection_name']}', database => '{cfg['lakebase_database']}', query => '{quoted}')"
        )


    def record(target: str, how: str, rows: int) -> None:
        log.append((args.run_id, datetime.now(timezone.utc), target, how, rows))
        print(f"{target}: {rows} rows via {how}")

    for table in ("customers", "orders"):
        df = remote(f"SELECT * FROM {cfg['source_schema']}.{table}")
        df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{ns}.rel_{table}")
        record(f"rel_{table}", "remote_query full table", spark.table(f"{ns}.rel_{table}").count())

    remote(CUSTOM_QUERY).selectExpr(
        "CAST(customer_id AS INT) AS customer_id",
        "country",
        "segment",
        "CAST(order_count AS INT) AS order_count",
        "CAST(net_revenue AS DECIMAL(14,2)) AS net_revenue",
        "CAST(country_rank AS INT) AS country_rank",
    ).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{ns}.rel_customer_revenue")
    record("rel_customer_revenue", "remote_query (custom SQL)", spark.table(f"{ns}.rel_customer_revenue").count())

    spark.createDataFrame(
        log, "run_id string, loaded_at timestamp, target_table string, method string, row_count bigint"
    ).write.mode("append").saveAsTable(f"{ns}.relational_extract_log")


if __name__ == "__main__":
    main()
