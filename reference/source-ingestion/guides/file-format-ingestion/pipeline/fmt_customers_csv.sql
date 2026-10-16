-- Comma-separated file with a header row. Types come from schema hints; anything that does not
-- fit lands in _rescued_data instead of being dropped.
CREATE OR REFRESH STREAMING TABLE fmt_customers_csv
COMMENT 'Customers from a comma-separated file, ingested incrementally with Auto Loader'
AS SELECT
  *,
  _metadata.file_path AS source_file
FROM STREAM read_files(
  '${formats_path}/csv/',
  format => 'csv',
  header => true,
  schemaHints => 'customer_id INT, credit_limit DECIMAL(12,2), created_date DATE'
);
