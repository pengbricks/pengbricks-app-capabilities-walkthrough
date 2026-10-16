-- Source 2: landed CSV files, picked up incrementally by Auto Loader.
CREATE OR REFRESH STREAMING TABLE stg_files_customers
COMMENT 'Customers from landed CSV files'
AS SELECT
  *,
  _metadata.file_path AS source_file
FROM STREAM read_files(
  '${landing_path}/files/',
  format => 'csv',
  header => true,
  schemaHints => 'cust_no INT, signup_date DATE'
);
