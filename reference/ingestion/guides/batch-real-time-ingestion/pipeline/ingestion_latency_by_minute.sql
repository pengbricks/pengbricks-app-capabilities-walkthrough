-- Latency and throughput per minute of ingestion, recomputed on each update.
CREATE OR REFRESH MATERIALIZED VIEW ingestion_latency_by_minute
COMMENT 'Events per minute and p50/p95/max ingestion latency'
AS SELECT
  date_trunc('MINUTE', ingested_at) AS ingested_minute,
  count(*) AS events,
  percentile_approx(latency_seconds, 0.5) AS p50_latency_seconds,
  percentile_approx(latency_seconds, 0.95) AS p95_latency_seconds,
  max(latency_seconds) AS max_latency_seconds
FROM events_silver
GROUP BY ALL;
