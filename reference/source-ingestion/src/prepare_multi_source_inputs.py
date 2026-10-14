"""Prepare the three inputs for the multi-source pipeline.

database extract -> Delta table ms_db_customers (stands in for the output of the relational extract guide)
landed files     -> CSV with the provider's own column names
API output       -> one JSON-lines file per API page, written by the authenticated pagination client
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--src-dir", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()
    sys.path.insert(0, args.src_dir)

    import requests
    from databricks.sdk.runtime import spark
    from pyspark.sql import functions as F
    from source_ingestion.api_client import TokenManager, fetch_all_pages
    from source_ingestion.datagen import entity_frame
    from source_ingestion.spec import load_spec

    spec = load_spec(args.use_case_file)
    ms = spec["multi_source"]
    ns = f"{args.catalog}.{args.schema}"
    root = f"/Volumes/{args.catalog}/{args.schema}/landing/multi_source"
    shutil.rmtree(root, ignore_errors=True)

    # 1. Database extract
    db = entity_frame(spark, spec, "customers", rows=ms["db_rows"], seed_offset=11)
    db.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{ns}.ms_db_customers")

    # 2. Landed files, with a different column naming than the database
    files = entity_frame(spark, spec, "customers", rows=ms["file_rows"], seed_offset=22).select(
        F.col("customer_id").alias("cust_no"),
        F.concat_ws(" ", "first_name", "last_name").alias("name"),
        F.col("email").alias("mail"),
        F.col("city").alias("town"),
        F.col("country").alias("nation"),
        F.col("created_date").alias("signup_date"),
    )
    os.makedirs(f"{root}/files", exist_ok=True)
    files.toPandas().to_csv(f"{root}/files/customers_landed.csv", index=False)

    # 3. API output: first N pages, one file per page
    api = spec["rest_api"]
    session = requests.Session()
    tokens = TokenManager(session, api["base_url"], api["username"], api["password"], refresh_after_seconds=1e9)
    page_size = api["page_size"]
    result = fetch_all_pages(session, tokens, f"{api['base_url']}{api['endpoint']}", "users", page_size)
    wanted = result.records[: ms["api_pages"] * page_size]
    os.makedirs(f"{root}/api", exist_ok=True)
    for page in range(ms["api_pages"]):
        chunk = wanted[page * page_size : (page + 1) * page_size]
        with open(f"{root}/api/page_{page + 1:04d}.json", "w", encoding="utf-8") as handle:
            handle.write("\n".join(json.dumps(r) for r in chunk) + "\n")

    print(f"db={ms['db_rows']} files={ms['file_rows']} api={len(wanted)} (api total {result.total})")


if __name__ == "__main__":
    main()
