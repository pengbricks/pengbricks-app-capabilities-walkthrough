-- Every column mask and row filter in the catalog, from information_schema. Replace <catalog>.
SELECT table_schema, table_name, column_name, mask_name, using_columns
FROM <catalog>.information_schema.column_masks
ORDER BY table_schema, table_name, column_name;

SELECT table_schema, table_name, filter_name, target_columns
FROM <catalog>.information_schema.row_filters
ORDER BY table_schema, table_name;
