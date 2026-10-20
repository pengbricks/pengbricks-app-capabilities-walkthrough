-- Silver over the Lakeflow Connect bronze tables (lfc_customers, lfc_orders, lfc_products).
-- Unqualified names resolve to the pipeline's catalog and schema.

-- Current customers. SELECT * keeps new source columns, such as loyalty_tier, without a code change.
CREATE OR REFRESH MATERIALIZED VIEW lfc_silver_customers
COMMENT 'Current version of each SQL Server customer.'
AS SELECT * EXCEPT (__START_AT, __END_AT)
FROM lfc_customers
WHERE __END_AT IS NULL;

-- Every plan each customer has had, and when it was true. Only possible because customers is SCD type 2.
CREATE OR REFRESH MATERIALIZED VIEW lfc_silver_plan_history
COMMENT 'Customer plan and status over time, from SCD type 2 bronze.'
AS SELECT customer_id, plan_name, status,
          __START_AT AS valid_from, __END_AT AS valid_to, __END_AT IS NULL AS is_current
FROM lfc_customers;

-- Orders with the customer's current plan and the product. MONEY lands as DECIMAL(19,4); silver uses cents.
CREATE OR REFRESH MATERIALIZED VIEW lfc_silver_orders (
  CONSTRAINT known_product EXPECT (product_name IS NOT NULL),
  CONSTRAINT non_negative_amount EXPECT (amount >= 0) ON VIOLATION DROP ROW
)
COMMENT 'SQL Server orders joined to current customer and product.'
AS SELECT o.order_id, o.order_ts, o.status, o.quantity,
          CAST(o.amount AS DECIMAL(19, 2)) AS amount,
          o.customer_id, c.name AS customer_name, c.city, c.plan_name,
          o.product_id, p.name AS product_name, p.category
FROM lfc_orders o
LEFT JOIN lfc_silver_customers c ON c.customer_id = o.customer_id
LEFT JOIN lfc_products p ON p.product_id = o.product_id;
