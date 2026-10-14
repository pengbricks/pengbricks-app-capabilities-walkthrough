"""Cost tracking and chargeback: enriched usage view, breakdowns, budget check, forecast, optimization."""

from __future__ import annotations

import datetime as dt

from common import base_args, run_sql_rows, workspace_id, write_rows
from governance_lib.analysis import over_budget
from governance_lib.sqlgen import qualified

VIEW = "cost_usage_enriched"


def q(args, name: str) -> str:
    return qualified(args.catalog, args.schema, name)


def build_views(args, spark) -> None:
    """Usage x list price, scoped to this workspace. The shared system tables hold every workspace."""
    wid = workspace_id()
    spark.sql(f"""CREATE OR REPLACE VIEW {q(args, VIEW)} AS
        SELECT u.usage_date, u.sku_name, u.billing_origin_product AS product, u.usage_unit,
               u.custom_tags['capability_guide_job'] AS guide_job,
               u.custom_tags['capability_guide_use_case'] AS use_case,
               coalesce(u.identity_metadata.run_as, u.identity_metadata.created_by, u.identity_metadata.owned_by, 'unattributed') AS usage_user,
               u.usage_metadata.job_id AS job_id, u.usage_metadata.job_run_id AS job_run_id,
               u.usage_metadata.job_name AS job_name, u.usage_metadata.dlt_pipeline_id AS pipeline_id,
               u.usage_metadata.warehouse_id AS warehouse_id,
               u.usage_quantity, p.pricing.default AS list_price,
               u.usage_quantity * p.pricing.default AS cost_usd
        FROM system.billing.usage u
        LEFT JOIN system.billing.list_prices p
          ON u.sku_name = p.sku_name AND u.cloud = p.cloud AND p.currency_code = 'USD'
         AND u.usage_end_time >= p.price_start_time AND (p.price_end_time IS NULL OR u.usage_end_time < p.price_end_time)
        WHERE u.workspace_id = '{wid}' AND u.usage_date >= date_sub(current_date(), 90)""")
    row = spark.sql(f"SELECT count(*) AS n, round(sum(cost_usd), 2) AS usd, min(usage_date) AS first_day FROM {q(args, VIEW)}").first()
    print(f"{VIEW}: {row['n']} usage rows, ${row['usd']} at list price since {row['first_day']}")
    assert row["n"] > 0


def spend_breakdown(args, spark) -> None:
    window = "usage_date >= date_sub(current_date(), 30)"
    queries = {
        "cost_by_product": f"SELECT product, round(sum(cost_usd), 2) AS cost_usd FROM {q(args, VIEW)} WHERE {window} GROUP BY product ORDER BY cost_usd DESC",
        "cost_by_sku": f"SELECT product, sku_name, round(sum(usage_quantity), 2) AS usage_quantity, usage_unit, round(sum(cost_usd), 2) AS cost_usd FROM {q(args, VIEW)} WHERE {window} GROUP BY product, sku_name, usage_unit ORDER BY cost_usd DESC",
        "cost_by_tag": f"""SELECT coalesce(guide_job, '(untagged)') AS guide_job, coalesce(use_case, '(untagged)') AS use_case,
                                  round(sum(cost_usd), 2) AS cost_usd
                           FROM {q(args, VIEW)} WHERE {window} GROUP BY 1, 2 ORDER BY cost_usd DESC""",
        "cost_by_user": f"SELECT usage_user, round(sum(cost_usd), 2) AS cost_usd FROM {q(args, VIEW)} WHERE {window} GROUP BY usage_user ORDER BY cost_usd DESC",
        "cost_by_job": f"""SELECT job_id, max(job_name) AS job_name, count(DISTINCT job_run_id) AS runs, round(sum(cost_usd), 2) AS cost_usd
                           FROM {q(args, VIEW)} WHERE {window} AND job_id IS NOT NULL GROUP BY job_id ORDER BY cost_usd DESC""",
        "cost_by_pipeline": f"SELECT pipeline_id, round(sum(cost_usd), 2) AS cost_usd FROM {q(args, VIEW)} WHERE {window} AND pipeline_id IS NOT NULL GROUP BY pipeline_id ORDER BY cost_usd DESC",
        "cost_daily": f"SELECT usage_date, round(sum(cost_usd), 2) AS cost_usd FROM {q(args, VIEW)} GROUP BY usage_date ORDER BY usage_date",
    }
    for name, statement in queries.items():
        spark.sql(f"CREATE OR REPLACE TABLE {q(args, name)} AS {statement}")
        top = spark.sql(f"SELECT * FROM {q(args, name)} LIMIT 3").collect()
        print(name, [r.asDict() for r in top])
    tagged = spark.sql(f"SELECT count(*) AS n FROM {q(args, 'cost_by_tag')} WHERE guide_job <> '(untagged)'").first()["n"]
    assert tagged > 0, "no spend carries the capability_guide_job tag"


def budget_check(args, spark) -> None:
    """Record the 7-day spend against the threshold. The same query backs the SQL alert in the bundle."""
    spend = float(spark.sql(f"""SELECT coalesce(sum(cost_usd), 0) AS s FROM {q(args, VIEW)}
                                WHERE usage_date >= date_sub(current_date(), 7)""").first()["s"])
    threshold = float(args.threshold)
    # Mechanisms: a SQL alert (resources/budget.alert.yml). Record whether the account budgets API answers.
    mechanism = "SQL alert on 7-day list-price spend"
    try:
        from databricks.sdk import WorkspaceClient

        w = WorkspaceClient()
        w.api_client.do("GET", f"/api/2.1/accounts/{w.config.account_id or 'unknown'}/budgets")
        policy_note = "account budgets API reachable"
    except Exception as exc:  # noqa: BLE001
        policy_note = f"account budgets API not reachable from the workspace ({type(exc).__name__})"
    rows = [{"checked_at": dt.datetime.now(dt.timezone.utc).replace(tzinfo=None), "spend_7d_usd": round(spend, 2),
             "threshold_usd": threshold, "breached": over_budget(spend, threshold), "mechanism": mechanism, "note": policy_note}]
    write_rows(spark, args.catalog, args.schema, "budget_status", rows,
               "checked_at timestamp, spend_7d_usd double, threshold_usd double, breached boolean, mechanism string, note string")
    print(rows[0])


def check_forecast(args, spark) -> None:
    """Read back the forecast table written by sql/cost_forecast.sql."""
    row = spark.sql(f"""SELECT count(*) AS days, min(ds) AS first_day, max(ds) AS last_day, round(sum(cost_forecast_usd), 2) AS total,
                               round(sum(cost_lower_usd), 2) AS low, round(sum(cost_upper_usd), 2) AS high,
                               (SELECT count(*) FROM {q(args, 'cost_daily')}) AS history_days
                        FROM {q(args, 'cost_forecast_30d')}""").first()
    print(row.asDict())
    assert row["days"] >= 30, row
    assert row["total"] is not None


def optimization(args, spark) -> None:
    from databricks.sdk import WorkspaceClient

    wid = workspace_id()
    settings = {w.id: w for w in WorkspaceClient().warehouses.list()}
    stats = run_sql_rows(spark, f"""
        WITH spend AS (SELECT warehouse_id, sum(cost_usd) AS cost_usd FROM {q(args, VIEW)}
                       WHERE usage_date >= date_sub(current_date(), 30) AND warehouse_id IS NOT NULL GROUP BY warehouse_id),
             queries AS (SELECT compute.warehouse_id AS warehouse_id, count(*) AS statements FROM system.query.history
                         WHERE workspace_id = '{wid}' AND start_time >= current_timestamp() - INTERVAL 30 DAYS
                           AND compute.warehouse_id IS NOT NULL GROUP BY 1)
        SELECT coalesce(s.warehouse_id, q.warehouse_id) AS warehouse_id, coalesce(s.cost_usd, 0) AS cost_usd_30d,
               coalesce(q.statements, 0) AS statements_30d
        FROM spend s FULL OUTER JOIN queries q ON s.warehouse_id = q.warehouse_id""")
    rows = []
    for r in stats:
        w = settings.get(r["warehouse_id"])
        auto_stop = w.auto_stop_mins if w else None
        usd_per_statement = round(float(r["cost_usd_30d"]) / r["statements_30d"], 4) if r["statements_30d"] else None
        flags = []
        if w and (auto_stop == 0 or (auto_stop or 0) > 10):
            flags.append("auto-stop above 10 minutes or disabled")
        if r["statements_30d"] < 100 and float(r["cost_usd_30d"]) > 0:
            flags.append("fewer than 100 statements in 30 days")
        if w is None:
            flags.append("warehouse deleted")
        rows.append({"warehouse_id": r["warehouse_id"], "warehouse_name": w.name if w else r["warehouse_id"], "cost_usd_30d": round(float(r["cost_usd_30d"]), 2),
                     "statements_30d": int(r["statements_30d"]), "usd_per_statement": usd_per_statement,
                     "auto_stop_minutes": auto_stop, "flags": "; ".join(flags) or "none"})
    write_rows(spark, args.catalog, args.schema, "opt_idle_warehouses", rows,
               "warehouse_id string, warehouse_name string, cost_usd_30d double, statements_30d long, "
               "usd_per_statement double, auto_stop_minutes int, flags string")

    spark.sql(f"""CREATE OR REPLACE TABLE {q(args, 'opt_costly_jobs')} AS
        SELECT job_id, max(job_name) AS job_name, count(DISTINCT job_run_id) AS runs, round(sum(cost_usd), 2) AS cost_usd_30d,
               round(sum(cost_usd) / nullif(count(DISTINCT job_run_id), 0), 3) AS usd_per_run,
               round(sum(usage_quantity), 1) AS dbus
        FROM {q(args, VIEW)} WHERE usage_date >= date_sub(current_date(), 30) AND job_id IS NOT NULL
        GROUP BY job_id ORDER BY usd_per_run DESC LIMIT 20""")
    for name in ("opt_idle_warehouses", "opt_costly_jobs"):
        print(name, [r.asDict() for r in spark.sql(f"SELECT * FROM {q(args, name)} LIMIT 3").collect()])


STEPS = {"build_views": build_views, "spend_breakdown": spend_breakdown, "budget_check": budget_check,
         "check_forecast": check_forecast, "optimization": optimization}

if __name__ == "__main__":
    from databricks.sdk.runtime import spark

    arguments = base_args("threshold")
    STEPS[arguments.step](arguments, spark)
