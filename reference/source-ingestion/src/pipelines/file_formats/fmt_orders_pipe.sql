-- Pipe-delimited text. Some notes contain a pipe inside double quotes; the quote option keeps
-- those fields in one column.
CREATE OR REFRESH STREAMING TABLE fmt_orders_pipe
COMMENT 'Orders from a pipe-delimited file with quoted embedded delimiters'
AS SELECT
  *,
  _metadata.file_path AS source_file
FROM STREAM read_files(
  '${formats_path}/pipe/',
  format => 'csv',
  header => true,
  delimiter => '|',
  quote => '"',
  schemaHints => 'order_id INT, customer_id INT, order_date DATE, amount DECIMAL(12,2), discount_pct INT'
);
