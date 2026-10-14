-- Text files copied from SFTP. Auto Loader remembers which files it has read, so a rerun ingests
-- only files that arrived since the last update.
CREATE OR REFRESH STREAMING TABLE sftp_text_files
COMMENT 'Text files copied from the SFTP server, one row per file'
AS SELECT
  value AS content,
  _metadata.file_path AS source_file,
  _metadata.file_size AS file_size,
  _metadata.file_modification_time AS file_modified_at,
  current_timestamp() AS ingested_at
FROM STREAM read_files(
  '${sftp_path}/',
  format => 'text',
  wholeText => true,
  pathGlobFilter => '*.txt'
);
