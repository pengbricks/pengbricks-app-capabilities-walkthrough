-- One row per repeating <line> element.
CREATE OR REFRESH MATERIALIZED VIEW fmt_xml_order_lines
COMMENT 'One row per order line from the XML orders'
AS SELECT
  CAST(`_id` AS INT) AS order_id,
  line.`_sku` AS sku,
  CAST(line.`_qty` AS INT) AS qty
FROM fmt_orders_xml
LATERAL VIEW explode(lines.line) l AS line;
