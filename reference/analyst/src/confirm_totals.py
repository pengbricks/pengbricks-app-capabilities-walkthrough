"""Run the published dashboard's own dataset queries and compare their totals to the notebook's totals."""

from __future__ import annotations

import argparse
import json
import sys


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--src", required=True)
    parser.add_argument("--warehouse-id", required=True)
    parser.add_argument("--dashboard-id", required=True)
    parser.add_argument("--dashboard-file", required=True)
    parser.add_argument("--run-id", default="manual")
    args = parser.parse_args()
    sys.path.insert(0, args.src)

    from databricks.sdk import WorkspaceClient
    from databricks.sdk.runtime import spark
    from analyst_common.helpers import totals_match

    w = WorkspaceClient()
    published = w.lakeview.get_published(args.dashboard_id)
    print(f"Dashboard published, warehouse {published.warehouse_id}")

    with open(args.dashboard_file, encoding="utf-8") as handle:
        datasets = {d["name"]: " ".join(d["queryLines"]) for d in json.load(handle)["datasets"]}

    def scalar(query: str) -> str:
        result = w.statement_execution.execute_statement(
            statement=query, warehouse_id=args.warehouse_id, catalog=args.catalog, schema=args.schema, wait_timeout="50s"
        )
        if result.status.state.value != "SUCCEEDED":
            raise RuntimeError(f"Query failed: {result.status}")
        return result.result.data_array[0][0]

    fq = f"{args.catalog}.{args.schema}"
    notebook = {r["view_name"]: r["total_revenue"] for r in spark.table(f"{fq}.chart_totals").collect()}
    rows = []
    for dataset, view in (("ds_monthly", "v_revenue_by_month"), ("ds_region_segment", "v_revenue_by_region_segment")):
        dashboard_total = scalar(f"SELECT SUM(revenue) FROM ({datasets[dataset]}) t")
        view_total = scalar(f"SELECT SUM(revenue) FROM {view}")
        chart_total = notebook[view]
        ok = totals_match(dashboard_total, view_total) and totals_match(dashboard_total, chart_total)
        print(f"{view}: dashboard {dashboard_total}, view {view_total}, notebook chart {chart_total}, match {ok}")
        rows.append((view, str(dashboard_total), str(view_total), str(chart_total), ok, args.run_id))

    spark.createDataFrame(
        rows, "view_name STRING, dashboard_total STRING, view_total STRING, notebook_total STRING, totals_match BOOLEAN, run_id STRING"
    ).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{fq}.totals_check")
    if not all(r[4] for r in rows):
        raise RuntimeError("Dashboard and notebook totals differ")


if __name__ == "__main__":
    main()
