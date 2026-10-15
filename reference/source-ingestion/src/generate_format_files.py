"""Generate one sample file per format from the use-case spec into the landing volume."""

from __future__ import annotations

import argparse
import shutil
import sys
import tempfile


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--src-dir", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()
    sys.path.insert(0, args.src_dir)

    from databricks.sdk.runtime import spark
    from source_ingestion import file_writers as fw
    from source_ingestion.datagen import entity_frame
    from source_ingestion.spec import load_spec

    spec = load_spec(args.use_case_file)
    options = spec["file_formats"]
    volume_root = f"/Volumes/{args.catalog}/{args.schema}/source_landing/formats"
    shutil.rmtree(volume_root, ignore_errors=True)  # idempotent: each run rewrites every file
    # Volumes do not support random-access writes (zip files need them), so build locally, then copy.
    root = tempfile.mkdtemp(prefix="formats_")

    customers = [r.asDict() for r in entity_frame(spark, spec, "customers").collect()]
    orders = [r.asDict() for r in entity_frame(spark, spec, "orders").collect()]

    fw.write_delimited(f"{root}/csv/customers.csv", customers)
    fw.write_delimited(f"{root}/pipe/orders.txt", orders, delimiter="|")
    fw.write_workbook(
        f"{root}/excel/orders_workbook.xlsx",
        {
            "README": [{"note": "Only the Orders sheet is ingested."}],
            options["excel_sheet"]: orders,
            "Products": [{"sku": f"SKU-{i:03d}", "price": 9.5 + i} for i in range(10)],
        },
    )
    json_rows = customers[: options["nested_json_rows"]]
    fw.write_nested_json(f"{root}/json/customers_nested.json", json_rows)
    xml_rows = orders[: options["xml_rows"]]
    fw.write_orders_xml(f"{root}/xml/orders.xml", xml_rows, options["xml_max_lines"], options["xml_coupon_every"])

    embedded = fw.count_delimited_with_embedded_delimiter(orders, "|")
    shutil.copytree(root, volume_root)
    print(f"customers={len(customers)} orders={len(orders)} orders_with_pipe_in_notes={embedded}")
    print(f"Files written under {volume_root}")


if __name__ == "__main__":
    main()
