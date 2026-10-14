-- Hand-remediated Databricks SQL for the legacy steps that sqlglot cannot
-- convert. {cs} is replaced with <catalog>.<schema> at run time.
-- Each "-- STEP" block replaces the legacy step with the same number.

-- STEP 07 | dedupe_orders
-- Legacy: DELETE FROM a CTE. Delta does not allow DML against a CTE, so delete
-- every row that has a later load for the same order_id.
DELETE FROM {cs}.tmp_stg_orders t
WHERE EXISTS (
    SELECT 1 FROM {cs}.tmp_stg_orders o
    WHERE o.order_id = t.order_id AND o.load_ts > t.load_ts
);

-- STEP 09 | region_summary_cursor
-- Legacy: cursor over regions with one INSERT per row. Set-based rewrite.
INSERT INTO {cs}.region_summary (region, order_count, total_amount, loaded_at)
SELECT region, COUNT(*), COALESCE(SUM(amount), 0), current_timestamp()
FROM {cs}.tmp_stg_orders
GROUP BY region;

-- STEP 10 | backfill_dim_date_loop
-- Legacy: WHILE loop adding one date per iteration. Generate the range with sequence().
INSERT INTO {cs}.dim_date (date_key, calendar_date, day_name)
SELECT CAST(date_format(d, 'yyyyMMdd') AS INT), d, date_format(d, 'EEEE')
FROM (
    SELECT explode(sequence(MIN(CAST(order_ts AS DATE)), MAX(CAST(order_ts AS DATE)), INTERVAL 1 DAY)) AS d
    FROM {cs}.tmp_stg_orders
);

-- STEP 13 | error_handling_wrapper
-- Legacy: TRY/CATCH writing the error to etl_log, then re-throwing.
-- Databricks: a failed task fails the Lakeflow Job run (retries and failure
-- notifications are job settings). The record task writes the outcome to etl_log.
-- No SQL to execute.
