-- Real-time path: Auto Loader incrementally picks up only new event files.
CREATE OR REFRESH STREAMING TABLE events_bronze
COMMENT 'Raw events landed by the streaming generator, ingested incrementally with Auto Loader'
AS SELECT
  *,
  _metadata.file_path AS source_file,
  current_timestamp() AS ingested_at
FROM STREAM read_files(
  '${landing_events_path}',
  format => 'json',
  schemaHints => 'event_id STRING, account_id STRING, event_ts STRING, amount DOUBLE, currency STRING, status STRING'
);
