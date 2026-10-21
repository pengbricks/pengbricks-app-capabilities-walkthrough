# Databricks notebook source
# MAGIC %md
# MAGIC # 4. Query with MEASURE() and compare with hand-written SQL
# MAGIC
# MAGIC Every measure is queried with `MEASURE()` at several groupings, then recomputed with a plain aggregate over the same tables. The two answers are compared group by group and saved to `mv_results`. A measure passes when every group matches.
# MAGIC
# MAGIC The last cells show three pitfalls on the same data: averaging daily rates, averaging per-segment ratios, and adding up distinct counts. Each gives a different number than the metric view, which is the point of defining the measure as a ratio of sums.
# MAGIC
# MAGIC Safe to rerun: the step replaces its own rows in `mv_results`.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_metric_views", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]

import mv_lib as m
T = {key: m.fq(catalog, schema, name) for key, name in m.TABLES.items()}
V = {key: m.fq(catalog, schema, name) for key, name in m.VIEWS.items()}
rows = []

def run(sql):
    return [r.asDict() for r in spark.sql(sql).collect()]

def check(measure_list, keys, view_sql, hand_sql, grain, view_name):
    """Run both queries, compare each measure, and add a result row per measure."""
    view_rows, hand_rows = run(view_sql), run(hand_sql)
    for measure in measure_list:
        r = m.compare_groups(view_rows, hand_rows, keys, measure)
        rows.append({"check": f"{view_name}.{measure}", "grain": grain, "view": r["view"], "hand": r["hand"],
                     "matched": r["matched"], "checked": r["checked"], "passed": r["passed"],
                     "detail": f"{r['matched']} of {r['checked']} groups match" + (f"; largest group: {', '.join(str(x)[:10] for x in r['top'])}" if keys else "")})

# COMMAND ----------

# MAGIC %md
# MAGIC ## Orders: additive, ratio, and distinct-count measures
# MAGIC
# MAGIC Metric view query first, then the hand-written equivalent. The hand-written SQL joins the same tables and applies the same `completed` filter.

# COMMAND ----------

ORDER_MEASURES = ["order_count", "gross_revenue", "net_revenue", "active_customers", "avg_order_value", "revenue_per_active_customer", "discount_rate"]
MEASURE_SELECT = ",\n  ".join(f"MEASURE({x}) AS {x}" for x in ORDER_MEASURES)

def hand_orders(groups):
    """Hand-written aggregate. `groups` is a list of (expression, alias) pairs; an empty list gives one grand-total row."""
    select_group = "".join(f"{expr} AS {alias},\n  " for expr, alias in groups)
    group_by = "GROUP BY " + ", ".join(expr for expr, _ in groups) if groups else ""
    return f"""
SELECT {select_group}COUNT(DISTINCT o.order_id) AS order_count,
  SUM(o.quantity * o.unit_price) AS gross_revenue,
  SUM(o.quantity * o.unit_price * (1 - o.discount_pct)) AS net_revenue,
  COUNT(DISTINCT o.customer_id) AS active_customers,
  SUM(o.quantity * o.unit_price * (1 - o.discount_pct)) / COUNT(DISTINCT o.order_id) AS avg_order_value,
  SUM(o.quantity * o.unit_price * (1 - o.discount_pct)) / COUNT(DISTINCT o.customer_id) AS revenue_per_active_customer,
  1 - SUM(o.quantity * o.unit_price * (1 - o.discount_pct)) / SUM(o.quantity * o.unit_price) AS discount_rate
FROM {T['orders']} o
JOIN {T['customers']} c ON o.customer_id = c.customer_id
JOIN {T['products']} p ON o.product_id = p.product_id
WHERE o.order_status = 'completed'
{group_by}"""

SEGMENT = ("c.segment", "customer_segment")
CATEGORY = ("p.category", "product_category")
MONTH = ("DATE_TRUNC('MONTH', o.order_date)", "order_month")
REGION = ("c.region", "customer_region")
CHANNEL = ("o.channel", "sales_channel")

for groups in [[], [SEGMENT], [CATEGORY], [MONTH], [REGION, CHANNEL]]:
    keys = [alias for _, alias in groups]
    group_cols = ", ".join(keys)
    view_sql = f"SELECT {group_cols + ', ' if keys else ''}{MEASURE_SELECT}\nFROM {V['orders']}\n{'GROUP BY ' + group_cols if keys else ''}"
    check(ORDER_MEASURES, keys, view_sql, hand_orders(groups), group_cols or "total", "mv_orders_metrics")

print(view_sql)
print(hand_orders([REGION, CHANNEL]))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Orders: window measures
# MAGIC
# MAGIC The hand-written versions use SQL window functions over monthly totals: `LAG` for the prior month, a three-row frame for the rolling total, and an unbounded frame for the running total. The second grouping adds the customer segment, so each segment gets its own window.

# COMMAND ----------

WINDOW_MEASURES = ["net_revenue_prior_month", "net_revenue_mom_growth", "net_revenue_trailing_3_months", "cumulative_net_revenue"]
WSELECT = ",\n  ".join(f"MEASURE({x}) AS {x}" for x in WINDOW_MEASURES)

def hand_window(by_segment):
    part = "PARTITION BY customer_segment " if by_segment else ""
    extra = "customer_segment, " if by_segment else ""
    seg_select = "c.segment AS customer_segment, " if by_segment else ""
    return f"""
WITH monthly AS (
  SELECT DATE_TRUNC('MONTH', o.order_date) AS order_month, {seg_select}
         SUM(o.quantity * o.unit_price * (1 - o.discount_pct)) AS net_revenue
  FROM {T['orders']} o JOIN {T['customers']} c ON o.customer_id = c.customer_id
  WHERE o.order_status = 'completed'
  GROUP BY ALL
)
SELECT order_month, {extra}net_revenue,
  LAG(net_revenue, 1) OVER ({part}ORDER BY order_month) AS net_revenue_prior_month,
  (net_revenue - LAG(net_revenue, 1) OVER ({part}ORDER BY order_month))
    / NULLIF(LAG(net_revenue, 1) OVER ({part}ORDER BY order_month), 0) AS net_revenue_mom_growth,
  SUM(net_revenue) OVER ({part}ORDER BY order_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS net_revenue_trailing_3_months,
  SUM(net_revenue) OVER ({part}ORDER BY order_month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_net_revenue
FROM monthly"""

check(WINDOW_MEASURES, ["order_month"],
      f"SELECT order_month, {WSELECT}\nFROM {V['orders']}\nGROUP BY order_month",
      hand_window(False), "order_month", "mv_orders_metrics")
check(WINDOW_MEASURES, ["order_month", "customer_segment"],
      f"SELECT order_month, customer_segment, {WSELECT}\nFROM {V['orders']}\nGROUP BY order_month, customer_segment",
      hand_window(True), "order_month, customer_segment", "mv_orders_metrics")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Funnel: ratio and filtered distinct-count measures

# COMMAND ----------

FUNNEL_MEASURES = ["sessions", "converted_sessions", "conversion_rate", "visitors", "converting_visitors", "visitor_conversion_rate"]
FSELECT = ",\n  ".join(f"MEASURE({x}) AS {x}" for x in FUNNEL_MEASURES)

def hand_funnel(group_expr, alias):
    select_group = f"{group_expr} AS {alias},\n  " if group_expr else ""
    group_by = f"GROUP BY {group_expr}" if group_expr else ""
    return f"""
SELECT {select_group}COUNT(DISTINCT s.session_id) AS sessions,
  COUNT(DISTINCT s.session_id) FILTER (WHERE s.converted) AS converted_sessions,
  COUNT(DISTINCT s.session_id) FILTER (WHERE s.converted) / COUNT(DISTINCT s.session_id) AS conversion_rate,
  COUNT(DISTINCT s.customer_id) AS visitors,
  COUNT(DISTINCT s.customer_id) FILTER (WHERE s.converted) AS converting_visitors,
  COUNT(DISTINCT s.customer_id) FILTER (WHERE s.converted) / COUNT(DISTINCT s.customer_id) AS visitor_conversion_rate
FROM {T['sessions']} s JOIN {T['customers']} c ON s.customer_id = c.customer_id
{group_by}"""

for grain, key, expr in [("total", None, ""), ("session_channel", "session_channel", "s.channel"),
                         ("session_month", "session_month", "DATE_TRUNC('MONTH', s.session_date)"),
                         ("customer_segment", "customer_segment", "c.segment")]:
    keys = [key] if key else []
    check(FUNNEL_MEASURES, keys,
          f"SELECT {key + ', ' if key else ''}{FSELECT}\nFROM {V['funnel']}\n{'GROUP BY ' + key if key else ''}",
          hand_funnel(expr, key), grain, "mv_funnel_metrics")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Three pitfalls, same data
# MAGIC
# MAGIC Each row below compares the metric view's value with a plausible-looking hand-written alternative. The alternatives are wrong on purpose.

# COMMAND ----------

# 1. Average of daily conversion rates vs conversion rate of all sessions.
view_rate = run(f"SELECT MEASURE(conversion_rate) AS v FROM {V['funnel']}")[0]["v"]
avg_daily = run(f"""
    SELECT AVG(rate) AS v FROM (
      SELECT session_date, COUNT(*) FILTER (WHERE converted) / COUNT(*) AS rate FROM {T['sessions']} GROUP BY session_date)""")[0]["v"]
rows.append({"check": "pitfall: average of daily conversion rates", "grain": "total", "view": view_rate, "hand": avg_daily,
             "matched": 0, "checked": 1, "passed": not m.close(view_rate, avg_daily, rel=1e-3),
             "detail": "passed means the two differ, as the guide says they should: the average gives a quiet day the same weight as a busy one"})

# 2. Average of per-segment average order values vs average order value overall.
view_aov = run(f"SELECT MEASURE(avg_order_value) AS v FROM {V['orders']}")[0]["v"]
avg_seg = run(f"SELECT AVG(aov) AS v FROM (SELECT customer_segment, MEASURE(avg_order_value) AS aov FROM {V['orders']} GROUP BY customer_segment)")[0]["v"]
rows.append({"check": "pitfall: average of per-segment average order values", "grain": "total", "view": view_aov, "hand": avg_seg,
             "matched": 0, "checked": 1, "passed": not m.close(view_aov, avg_seg, rel=1e-4),
             "detail": "passed means the two differ: a small segment counts as much as a large one"})

# 3. Active customers added up by month vs distinct active customers overall.
view_total = run(f"SELECT MEASURE(active_customers) AS v FROM {V['orders']}")[0]["v"]
summed = run(f"SELECT SUM(n) AS v FROM (SELECT order_month, MEASURE(active_customers) AS n FROM {V['orders']} GROUP BY order_month)")[0]["v"]
rows.append({"check": "pitfall: sum of monthly active customers", "grain": "total", "view": view_total, "hand": summed,
             "matched": 0, "checked": 1, "passed": not m.close(view_total, summed),
             "detail": "passed means the two differ: a customer who orders in several months is counted once per month"})

# COMMAND ----------

m.write_results(spark, T["results"], "verify", rows, params["run_id"])
display(spark.table(T["results"]).where("step = 'verify'").orderBy("check_name", "grain"))

# COMMAND ----------

measure_rows = [r for r in rows if not r["check"].startswith("pitfall")]
failed = [r for r in measure_rows if not r["passed"]]
print(f"{len(measure_rows) - len(failed)} of {len(measure_rows)} measure checks match the hand-written SQL")
assert not failed, f"Mismatches: {[(r['check'], r['grain'], r['detail']) for r in failed]}"
