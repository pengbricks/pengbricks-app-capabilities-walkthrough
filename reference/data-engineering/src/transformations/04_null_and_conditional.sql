-- Null detection and conditional logic.
CREATE OR REFRESH MATERIALIZED VIEW tp_null_conditional AS
SELECT
  customer_id,
  coalesce(segment, 'unassigned')                    AS segment_filled,
  nullif(region_code, 'XX')                          AS region_known,
  region_code IS NULL                                AS region_is_null,
  segment IS NULL                                    AS segment_is_null,
  nvl2(region_code, 'has_region', 'no_region')       AS region_flag,
  CASE WHEN segment = 'enterprise' THEN 'high_touch'
       WHEN segment = 'smb'        THEN 'standard'
       WHEN segment = 'consumer'   THEN 'self_serve'
       ELSE 'review' END                             AS service_level,
  if(region_code IS NULL AND segment IS NULL, 'incomplete', 'ok') AS profile_status
FROM de_customers;
