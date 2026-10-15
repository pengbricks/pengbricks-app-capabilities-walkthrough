-- Casting with a reject path. try_cast returns NULL instead of failing.
-- Rows where a non-null raw value fails to cast go to the reject table with the reason.
CREATE OR REFRESH MATERIALIZED VIEW tp_cast_valid AS
SELECT
  order_id,
  customer_id,
  order_ts_utc,
  CAST(order_ts_utc AS DATE)        AS order_date,
  category,
  status,
  try_cast(amount_raw AS DECIMAL(12,2)) AS amount,
  try_cast(quantity_raw AS INT)         AS quantity
FROM de_orders
WHERE try_cast(amount_raw AS DECIMAL(12,2)) IS NOT NULL
  AND try_cast(quantity_raw AS INT) IS NOT NULL;

CREATE OR REFRESH MATERIALIZED VIEW tp_cast_rejects AS
SELECT
  order_id,
  amount_raw,
  quantity_raw,
  concat_ws('; ',
    CASE WHEN try_cast(amount_raw AS DECIMAL(12,2)) IS NULL THEN 'amount not numeric' END,
    CASE WHEN try_cast(quantity_raw AS INT) IS NULL THEN 'quantity not an integer' END
  ) AS reject_reason
FROM de_orders
WHERE try_cast(amount_raw AS DECIMAL(12,2)) IS NULL
   OR try_cast(quantity_raw AS INT) IS NULL;
