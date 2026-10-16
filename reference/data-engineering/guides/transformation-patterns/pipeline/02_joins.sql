-- Inner, left, and full joins of orders to customers.
-- Orders for unknown customers only appear in the left and full joins;
-- customers with no orders only appear in the full join.
CREATE OR REFRESH MATERIALIZED VIEW tp_join_inner AS
SELECT o.order_id, o.customer_id, c.segment, o.category, o.status
FROM de_orders o
INNER JOIN de_customers c ON o.customer_id = c.customer_id;

CREATE OR REFRESH MATERIALIZED VIEW tp_join_left AS
SELECT o.order_id, o.customer_id, c.segment, o.category, o.status
FROM de_orders o
LEFT JOIN de_customers c ON o.customer_id = c.customer_id;

CREATE OR REFRESH MATERIALIZED VIEW tp_join_full AS
SELECT
  o.order_id,
  coalesce(o.customer_id, c.customer_id) AS customer_id,
  c.segment,
  o.category,
  o.status,
  CASE WHEN o.order_id IS NULL THEN 'customer_only'
       WHEN c.customer_id IS NULL THEN 'order_only'
       ELSE 'both' END AS match_side
FROM de_orders o
FULL OUTER JOIN de_customers c ON o.customer_id = c.customer_id;
