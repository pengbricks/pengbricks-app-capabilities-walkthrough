-- XML with a repeating <line> node and an optional <coupon> node. rowTag makes each <order> a row;
-- attributes arrive with the _ prefix. Orders without a coupon get NULL.
CREATE OR REFRESH STREAMING TABLE fmt_orders_xml
COMMENT 'Orders from XML with repeating and optional nodes'
AS SELECT
  *,
  _metadata.file_path AS source_file
FROM STREAM read_files(
  '${formats_path}/xml/',
  format => 'xml',
  rowTag => 'order'
);
