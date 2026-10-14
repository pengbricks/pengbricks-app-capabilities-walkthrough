-- Daily usage and list-price cost by SKU and product for this workspace.
CREATE OR REPLACE TABLE IDENTIFIER(:catalog || '.' || :schema || '.ops_usage_cost') AS
WITH ctx AS (
  SELECT workspace_id FROM IDENTIFIER(:catalog || '.' || :schema || '.ops_context')
),
price AS (
  SELECT sku_name, usage_unit, pricing.default AS unit_price, price_start_time,
         coalesce(price_end_time, TIMESTAMP'2999-01-01') AS price_end_time
  FROM system.billing.list_prices
)
SELECT u.usage_date, u.sku_name,
       coalesce(u.billing_origin_product, 'UNKNOWN') AS product,
       u.usage_unit,
       CAST(sum(u.usage_quantity) AS DOUBLE) AS usage_quantity,
       CAST(round(sum(u.usage_quantity * p.unit_price), 2) AS DOUBLE) AS list_cost_usd
FROM system.billing.usage u JOIN ctx USING (workspace_id)
LEFT JOIN price p
  ON u.sku_name = p.sku_name AND u.usage_unit = p.usage_unit
 AND u.usage_start_time >= p.price_start_time AND u.usage_start_time < p.price_end_time
WHERE u.usage_date >= date_sub(current_date(), CAST(:lookback_days AS INT))
GROUP BY u.usage_date, u.sku_name, coalesce(u.billing_origin_product, 'UNKNOWN'), u.usage_unit
