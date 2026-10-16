CREATE OR REFRESH MATERIALIZED VIEW customers_by_source
COMMENT 'Row counts and distinct countries per source system'
AS SELECT source_system, count(*) AS customers, count(DISTINCT country) AS countries
FROM customers_conformed
GROUP BY source_system;
