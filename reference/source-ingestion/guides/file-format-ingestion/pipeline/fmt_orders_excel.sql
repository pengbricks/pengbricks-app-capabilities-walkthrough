-- One named sheet of a multi-sheet workbook. dataAddress picks the Orders sheet; the README and
-- Products sheets in the same file are not read. Excel files stream through Auto Loader like any other format. Hints keep dates as DATE and numbers as INT or DECIMAL
-- instead of the timestamp and bigint the sheet infers.
CREATE OR REFRESH STREAMING TABLE fmt_orders_excel
COMMENT 'Orders read from the Orders sheet of an Excel workbook'
AS SELECT
  *,
  _metadata.file_path AS source_file
FROM STREAM read_files(
  '${formats_path}/excel/',
  format => 'excel',
  headerRows => 1,
  dataAddress => '${excel_sheet}',
  schemaHints => 'order_id INT, customer_id INT, order_date DATE, amount DECIMAL(12,2), discount_pct INT',
  schemaEvolutionMode => 'none'
);
