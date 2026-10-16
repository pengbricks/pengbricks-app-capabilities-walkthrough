-- 30-day spend forecast with ai_forecast. Runs as a SQL task on the warehouse.
-- Parameters: :catalog, :schema.
CREATE OR REPLACE TABLE IDENTIFIER(:catalog || '.' || :schema || '.cost_forecast_30d') AS
SELECT CAST(ds AS DATE) AS ds,
       y_forecast AS cost_forecast_usd,
       y_lower AS cost_lower_usd,
       y_upper AS cost_upper_usd
FROM ai_forecast(
  TABLE(SELECT usage_date AS ds, cost_usd AS y FROM IDENTIFIER(:catalog || '.' || :schema || '.cost_daily')),
  horizon => CAST(date_add(current_date(), 31) AS STRING),
  time_col => 'ds',
  value_col => 'y',
  frequency => 'day');

CREATE OR REPLACE TABLE IDENTIFIER(:catalog || '.' || :schema || '.cost_actual_vs_forecast') AS
SELECT usage_date AS ds, 'actual' AS series, cost_usd
FROM IDENTIFIER(:catalog || '.' || :schema || '.cost_daily')
UNION ALL
SELECT ds, 'forecast' AS series, round(cost_forecast_usd, 2) AS cost_usd
FROM IDENTIFIER(:catalog || '.' || :schema || '.cost_forecast_30d');
