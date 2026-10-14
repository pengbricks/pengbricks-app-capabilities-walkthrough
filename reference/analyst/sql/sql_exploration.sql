-- SQL exploration over the governed orders, customers, and products tables.
-- Parameters :catalog and :schema come from the job. Each statement saves its result so the run leaves artifacts.
USE CATALOG IDENTIFIER(:catalog);
USE SCHEMA IDENTIFIER(:schema);

-- 1. Revenue by region and segment, with each group's share of the total.
CREATE OR REPLACE TABLE sql_revenue_by_region AS
SELECT c.region,
       c.segment,
       COUNT(*) AS orders,
       SUM(o.quantity * o.unit_price) AS revenue,
       ROUND(100 * SUM(o.quantity * o.unit_price) / SUM(SUM(o.quantity * o.unit_price)) OVER (), 2) AS pct_of_total
FROM orders o JOIN customers c USING (customer_id)
WHERE o.status IN ('completed', 'shipped')
GROUP BY c.region, c.segment;

-- 2. Top 20 customers by revenue, ranked inside their region.
CREATE OR REPLACE TABLE sql_top_customers AS
WITH revenue AS (
  SELECT c.customer_id, c.region, SUM(o.quantity * o.unit_price) AS revenue
  FROM orders o JOIN customers c USING (customer_id)
  WHERE o.status IN ('completed', 'shipped')
  GROUP BY c.customer_id, c.region
)
SELECT *, RANK() OVER (PARTITION BY region ORDER BY revenue DESC) AS rank_in_region
FROM revenue
QUALIFY RANK() OVER (ORDER BY revenue DESC) <= 20;

-- 3. Monthly revenue with a running total and month-over-month change.
CREATE OR REPLACE TABLE sql_monthly_running_total AS
WITH monthly AS (
  SELECT DATE_TRUNC('MONTH', order_ts) AS month, SUM(quantity * unit_price) AS revenue
  FROM orders
  WHERE status IN ('completed', 'shipped')
  GROUP BY 1
)
SELECT month,
       revenue,
       SUM(revenue) OVER (ORDER BY month) AS running_revenue,
       ROUND(100 * (revenue - LAG(revenue) OVER (ORDER BY month)) / LAG(revenue) OVER (ORDER BY month), 2) AS mom_pct
FROM monthly;
