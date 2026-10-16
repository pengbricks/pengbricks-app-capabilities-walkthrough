-- Source 1: database extract. A batch read of the extracted Delta table.
CREATE OR REFRESH MATERIALIZED VIEW stg_db_customers
COMMENT 'Customers extracted from the database'
AS SELECT * FROM ${catalog}.${schema}.ms_db_customers;
