-- Flatten the repeating contacts array: one row per contact.
CREATE OR REFRESH MATERIALIZED VIEW fmt_json_contacts
COMMENT 'One row per contact from the nested JSON customers'
AS SELECT
  customer_id,
  contact.type AS contact_type,
  contact.value AS contact_value
FROM fmt_customers_json
LATERAL VIEW explode(contacts) c AS contact;
