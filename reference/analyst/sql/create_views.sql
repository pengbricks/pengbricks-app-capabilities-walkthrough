-- Two governed views. The notebook charts and the AI/BI dashboard both read them.
USE CATALOG IDENTIFIER(:catalog);
USE SCHEMA IDENTIFIER(:schema);

CREATE OR REPLACE VIEW v_revenue_by_month
COMMENT 'Revenue and order count per month for completed and shipped orders'
AS
SELECT CAST(DATE_TRUNC('MONTH', order_ts) AS DATE) AS month,
       COUNT(*) AS orders,
       CAST(SUM(quantity * unit_price) AS DECIMAL(18, 2)) AS revenue
FROM analyst_orders
WHERE status IN ('completed', 'shipped')
GROUP BY 1;

CREATE OR REPLACE VIEW v_revenue_by_region_segment
COMMENT 'Revenue and order count per customer region and segment for completed and shipped orders'
AS
SELECT c.region,
       c.segment,
       COUNT(*) AS orders,
       CAST(SUM(o.quantity * o.unit_price) AS DECIMAL(18, 2)) AS revenue
FROM analyst_orders o JOIN analyst_customers c USING (customer_id)
WHERE o.status IN ('completed', 'shipped')
GROUP BY c.region, c.segment;
