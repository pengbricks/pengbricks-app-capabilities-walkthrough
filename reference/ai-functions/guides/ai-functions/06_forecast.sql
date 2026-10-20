-- Databricks notebook source
-- MAGIC %md
-- MAGIC # 6. Forecast daily orders
-- MAGIC
-- MAGIC `ai_forecast` is a SQL table function that runs on the compute that submits it, with no separate model charge. This task runs on a SQL warehouse: in the reference workspace, serverless notebook compute rejected it with "ai_forecast is in preview and currently disabled in this environment", and the warehouse ran it.
-- MAGIC
-- MAGIC The backtest hides September 2026, forecasts it from the months before, and compares the forecast with the real orders (mean absolute percentage error). The forward forecast uses all the data. The dates here match the `forecast` block of `use_cases/general.yml`; a test checks that they agree.
-- MAGIC
-- MAGIC The job passes `catalog`, `schema`, and `run_id` as named parameters (`:catalog`). Run by hand: attach a SQL warehouse and fill in the parameter boxes that appear for each marker.

-- COMMAND ----------

CREATE OR REPLACE TABLE IDENTIFIER(:catalog || '.' || :schema || '.aif_forecast_backtest') AS
SELECT fc.order_date, fc.region, fc.orders_forecast, fc.orders_lower, fc.orders_upper, o.orders
FROM ai_forecast(
  observed => TABLE(
    SELECT order_date, region, orders
    FROM IDENTIFIER(:catalog || '.' || :schema || '.aif_daily_orders')
    WHERE order_date < DATE'2026-09-01'),
  horizon => DATE'2026-09-30',
  time_col => 'order_date',
  value_col => 'orders',
  group_col => 'region'
) fc
JOIN IDENTIFIER(:catalog || '.' || :schema || '.aif_daily_orders') o
  ON o.order_date = fc.order_date AND o.region = fc.region;

-- COMMAND ----------

CREATE OR REPLACE TABLE IDENTIFIER(:catalog || '.' || :schema || '.aif_order_forecast') AS
SELECT *
FROM ai_forecast(
  observed => TABLE(SELECT order_date, region, orders FROM IDENTIFIER(:catalog || '.' || :schema || '.aif_daily_orders')),
  horizon => DATE'2026-10-31',
  time_col => 'order_date',
  value_col => 'orders',
  group_col => 'region'
);

-- COMMAND ----------

-- Replace this step's rows in the results table, so a rerun does not add a second set.
CREATE TABLE IF NOT EXISTS IDENTIFIER(:catalog || '.' || :schema || '.aif_results')
  (step string, metric string, value double, detail string, run_id string, recorded_at timestamp);
DELETE FROM IDENTIFIER(:catalog || '.' || :schema || '.aif_results') WHERE step = 'forecast';
INSERT INTO IDENTIFIER(:catalog || '.' || :schema || '.aif_results')
SELECT 'forecast', 'backtest_mape_' || region, avg(abs(orders_forecast - orders) / orders),
       count(*) || ' days in September 2026', :run_id, current_timestamp()
FROM IDENTIFIER(:catalog || '.' || :schema || '.aif_forecast_backtest')
GROUP BY region
UNION ALL
SELECT 'forecast', 'forecast_rows', count(*), 'days to 2026-10-31 x regions', :run_id, current_timestamp()
FROM IDENTIFIER(:catalog || '.' || :schema || '.aif_order_forecast');

-- COMMAND ----------

SELECT metric, round(value, 4) AS value, detail
FROM IDENTIFIER(:catalog || '.' || :schema || '.aif_results')
WHERE step = 'forecast'
ORDER BY metric;
