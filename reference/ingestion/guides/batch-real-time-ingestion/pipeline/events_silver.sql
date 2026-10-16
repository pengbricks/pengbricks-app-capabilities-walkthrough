-- Expectations record quality metrics in the pipeline event log on every update.
CREATE OR REFRESH STREAMING TABLE events_silver (
  CONSTRAINT event_id_present EXPECT (event_id IS NOT NULL) ON VIOLATION DROP ROW,
  CONSTRAINT amount_non_negative EXPECT (amount >= 0) ON VIOLATION DROP ROW,
  CONSTRAINT currency_supported EXPECT (currency IN ('USD', 'EUR', 'GBP'))
)
COMMENT 'Validated events with end-to-end ingestion latency per row'
AS SELECT
  event_id,
  account_id,
  to_timestamp(event_ts) AS event_ts,
  CAST(amount AS DECIMAL(18, 2)) AS amount,
  currency,
  status,
  ingested_at,
  (unix_millis(ingested_at) - unix_millis(to_timestamp(event_ts))) / 1000.0 AS latency_seconds
FROM STREAM(events_bronze);
