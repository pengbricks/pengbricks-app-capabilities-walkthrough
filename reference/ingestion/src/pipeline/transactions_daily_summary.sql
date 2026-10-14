-- Batch path: a materialized view over the framework's silver table.
CREATE OR REFRESH MATERIALIZED VIEW transactions_daily_summary
COMMENT 'Daily totals per feed and currency from the batch framework output'
AS SELECT
  source_feed,
  to_date(event_ts) AS event_date,
  currency,
  status,
  count(*) AS transactions,
  sum(amount) AS total_amount
FROM ${catalog}.${schema}.transactions_silver
GROUP BY ALL;
