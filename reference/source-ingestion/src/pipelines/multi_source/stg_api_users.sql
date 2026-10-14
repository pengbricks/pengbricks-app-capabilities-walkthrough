-- Source 3: API pages landed as JSON lines.
CREATE OR REFRESH STREAMING TABLE stg_api_users
COMMENT 'Users from landed API pages'
AS SELECT
  *,
  _metadata.file_path AS source_file
FROM STREAM read_files(
  '${landing_path}/api/',
  format => 'json',
  schemaHints => 'id INT'
);
