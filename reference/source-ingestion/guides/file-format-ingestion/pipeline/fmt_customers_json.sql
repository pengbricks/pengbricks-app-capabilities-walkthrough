-- Nested JSON: a struct (name, address), an array of structs (contacts), and an optional struct
-- (loyalty). multiLine reads a pretty-printed array of documents.
CREATE OR REFRESH STREAMING TABLE fmt_customers_json
COMMENT 'Customers from nested JSON documents'
AS SELECT
  *,
  _metadata.file_path AS source_file
FROM STREAM read_files(
  '${formats_path}/json/',
  format => 'json',
  multiLine => true,
  schemaHints => 'customer_id INT, credit_limit DECIMAL(12,2), created_date DATE'
);
