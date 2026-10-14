"""Create the source schema, tables, and database function in Lakebase Postgres and load sample rows."""

from __future__ import annotations

import argparse
import sys


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src-dir", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()
    sys.path.insert(0, args.src_dir)

    from databricks.sdk import WorkspaceClient
    from databricks.sdk.runtime import spark
    from psycopg2.extras import execute_values
    from source_ingestion import lakebase
    from source_ingestion.datagen import entity_frame
    from source_ingestion.relational_sql import DDL, SCHEMA
    from source_ingestion.spec import load_spec

    spec = load_spec(args.use_case_file)
    cfg = spec["relational"]
    settings = lakebase.connection_settings(
        WorkspaceClient(), cfg["lakebase_project"], cfg["lakebase_branch"], cfg["lakebase_endpoint"], cfg["lakebase_database"]
    )

    customers = entity_frame(spark, spec, "customers").collect()
    orders = entity_frame(spark, spec, "orders").collect()

    with lakebase.connect(settings) as conn, conn.cursor() as cur:
        cur.execute(DDL)
        execute_values(
            cur,
            f"INSERT INTO {SCHEMA}.customers (customer_id, first_name, last_name, email, city, country, segment, created_date, credit_limit) VALUES %s",
            [(r.customer_id, r.first_name, r.last_name, r.email, r.city, r.country, r.segment, r.created_date, r.credit_limit) for r in customers],
        )
        execute_values(
            cur,
            f"INSERT INTO {SCHEMA}.orders (order_id, customer_id, order_date, status, amount, discount_pct, notes) VALUES %s",
            [(r.order_id, r.customer_id, r.order_date, r.status, r.amount, r.discount_pct, r.notes) for r in orders],
        )
        cur.execute(f"SELECT (SELECT count(*) FROM {SCHEMA}.customers), (SELECT count(*) FROM {SCHEMA}.orders)")
        print(f"Source loaded in {cfg['lakebase_project']}/{cfg['lakebase_branch']}: customers, orders = {cur.fetchone()}")


if __name__ == "__main__":
    main()
