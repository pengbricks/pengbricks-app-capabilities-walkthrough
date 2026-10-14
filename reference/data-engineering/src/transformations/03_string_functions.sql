-- String functions: trim, case, split, replace, pad, substring, length, concat.
CREATE OR REFRESH MATERIALIZED VIEW tp_string_functions AS
SELECT
  customer_id,
  concat_ws(', ', upper(trim(last_name)), initcap(trim(first_name))) AS display_name,
  lower(split(email, '@')[1])                                        AS email_domain,
  regexp_replace(email, '[0-9]+', '#')                               AS email_masked,
  regexp_extract(email, 'user([0-9]+)@', 1)                          AS email_number,
  lpad(substring(customer_id, 3), 8, '0')                            AS padded_id,
  length(trim(last_name))                                            AS last_name_length,
  replace(trim(last_name), '''', '')                                 AS last_name_no_quote,
  instr(email, '@')                                                  AS at_position
FROM customers;
