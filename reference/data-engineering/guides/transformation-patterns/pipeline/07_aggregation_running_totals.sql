-- Aggregation with running totals. Daily sales per category, then a running sum
-- that restarts for each category.
CREATE OR REFRESH MATERIALIZED VIEW tp_running_totals AS
WITH daily AS (
  SELECT category, order_date, count(*) AS orders, sum(amount * quantity) AS daily_sales
  FROM tp_cast_valid
  GROUP BY category, order_date
)
SELECT
  category,
  order_date,
  orders,
  daily_sales,
  sum(daily_sales) OVER (PARTITION BY category ORDER BY order_date
                         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_sales
FROM daily;
