-- The same steps a Lakeflow Designer flow performs in the UI: browse, filter, join, rename, derive, save.
USE CATALOG IDENTIFIER(:catalog);
USE SCHEMA IDENTIFIER(:schema);

CREATE OR REPLACE TABLE prep_flow_output AS
SELECT o.order_id                                        AS order_number,
       o.customer_id                                     AS customer_id,
       c.region                                          AS sales_region,
       c.segment                                         AS customer_segment,
       DATE(o.order_ts)                                  AS order_date,
       o.quantity,
       o.unit_price,
       CAST(o.quantity * o.unit_price AS DECIMAL(12, 2)) AS order_total,
       CASE WHEN o.quantity * o.unit_price >= 1000 THEN 'large' ELSE 'standard' END AS order_size
FROM analyst_orders o
JOIN analyst_customers c ON o.customer_id = c.customer_id
WHERE o.status = 'completed'
  AND o.order_ts >= '2026-01-01';

CREATE OR REPLACE TABLE prep_flow_summary AS
SELECT COUNT(*) AS output_rows, SUM(order_total) AS output_total, COUNT(DISTINCT customer_id) AS customers
FROM prep_flow_output;
