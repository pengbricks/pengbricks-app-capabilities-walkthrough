-- Per-group iteration. Collect each customer's orders into an array, then walk the array
-- with higher-order functions: transform for per-element math, aggregate for a fold,
-- filter for a subset.
CREATE OR REFRESH MATERIALIZED VIEW tp_group_iteration AS
WITH per_customer AS (
  SELECT
    customer_id,
    sort_array(collect_list(struct(order_ts_utc, amount * quantity AS line_total))) AS lines
  FROM tp_cast_valid
  GROUP BY customer_id
)
SELECT
  customer_id,
  size(lines)                                                    AS order_count,
  transform(lines, l -> round(l.line_total, 2))                  AS line_totals,
  round(aggregate(lines, 0D, (acc, l) -> acc + CAST(l.line_total AS DOUBLE)), 2)  AS total_spend,
  size(filter(lines, l -> l.line_total > 1000))                  AS large_orders
FROM per_customer;
