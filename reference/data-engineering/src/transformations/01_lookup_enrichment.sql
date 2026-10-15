-- Lookup enrichment: attach region name and time zone from a small reference table.
-- Unmatched codes stay in the output and are flagged, so the lookup never drops rows.
CREATE OR REFRESH MATERIALIZED VIEW tp_lookup_enrichment AS
SELECT
  c.customer_id,
  c.region_code,
  r.region_name,
  r.time_zone,
  CASE WHEN c.region_code IS NULL THEN 'missing_code'
       WHEN r.region_code IS NULL THEN 'unmatched_code'
       ELSE 'matched' END AS lookup_status
FROM de_customers c
LEFT JOIN regions r ON c.region_code = r.region_code;
