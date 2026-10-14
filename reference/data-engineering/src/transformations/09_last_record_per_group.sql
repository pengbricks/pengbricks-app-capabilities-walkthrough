-- Last record per group: the most recent order for each customer.
CREATE OR REFRESH MATERIALIZED VIEW tp_last_record AS
SELECT order_id, customer_id, order_ts_utc, category, status, amount, quantity
FROM tp_cast_valid
QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY order_ts_utc DESC, order_id DESC) = 1;
