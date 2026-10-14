-- One conformed table. Each branch maps its source's columns to the same names and tags the rows.
CREATE OR REFRESH MATERIALIZED VIEW customers_conformed (
  CONSTRAINT source_system_present EXPECT (source_system IS NOT NULL) ON VIOLATION FAIL UPDATE,
  CONSTRAINT source_id_present EXPECT (source_id IS NOT NULL) ON VIOLATION FAIL UPDATE
)
COMMENT 'Customers from the database, landed files, and API in one shape'
AS
SELECT 'database' AS source_system, CAST(customer_id AS STRING) AS source_id,
       concat_ws(' ', first_name, last_name) AS full_name, email, city, country, created_date
FROM stg_db_customers
UNION ALL
SELECT 'files', CAST(cust_no AS STRING), name, mail, town, nation, signup_date
FROM stg_files_customers
UNION ALL
SELECT 'api', CAST(id AS STRING), concat_ws(' ', firstName, lastName), email, address.city, address.country,
       CAST(NULL AS DATE)
FROM stg_api_users;
