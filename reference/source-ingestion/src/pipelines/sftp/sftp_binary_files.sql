-- Binary files (images) are cataloged by path, size, and modification time; the bytes stay in the volume.
CREATE OR REFRESH STREAMING TABLE sftp_binary_files
COMMENT 'Binary files copied from the SFTP server, one row per file without the content'
AS SELECT
  path,
  length AS file_size,
  modificationTime AS file_modified_at,
  current_timestamp() AS ingested_at
FROM STREAM read_files(
  '${sftp_path}/',
  format => 'binaryFile',
  pathGlobFilter => '*.png'
);
