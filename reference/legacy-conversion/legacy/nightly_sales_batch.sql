-- Nightly sales batch (generic T-SQL). Loads staged orders, deduplicates,
-- upserts the customer dimension, backfills the date dimension, and
-- aggregates daily sales. Each "-- STEP" marker starts one unit of work.
-- Input table dbo.stg_orders_raw is loaded by the upstream file drop.

-- STEP 01 | create_dim_customer
CREATE TABLE dbo.dim_customer (
    customer_key   INT IDENTITY(1,1) NOT NULL,
    customer_id    VARCHAR(20)   NOT NULL,
    customer_name  NVARCHAR(100) NOT NULL,
    region         VARCHAR(20)   NOT NULL,
    updated_at     DATETIME2     NOT NULL
);

-- STEP 02 | create_fact_daily_sales
CREATE TABLE dbo.fact_daily_sales (
    sales_date     DATE          NOT NULL,
    region         VARCHAR(20)   NOT NULL,
    order_count    INT           NOT NULL,
    total_amount   DECIMAL(18,2) NOT NULL
);

-- STEP 03 | create_region_summary
CREATE TABLE dbo.region_summary (
    region         VARCHAR(20)   NOT NULL,
    order_count    INT           NOT NULL,
    total_amount   DECIMAL(18,2) NOT NULL,
    loaded_at      DATETIME2     NOT NULL
);

-- STEP 04 | create_dim_date
CREATE TABLE dbo.dim_date (
    date_key       INT           NOT NULL,
    calendar_date  DATE          NOT NULL,
    day_name       VARCHAR(10)   NOT NULL
);

-- STEP 05 | create_etl_log
CREATE TABLE dbo.etl_log (
    run_at         DATETIME2     NOT NULL,
    step_name      VARCHAR(50)   NOT NULL,
    rows_loaded    INT           NOT NULL,
    message        VARCHAR(200)  NULL
);

-- STEP 06 | stage_orders
SELECT TOP (100000)
       order_id,
       customer_id,
       customer_name,
       ISNULL(region, 'UNKNOWN') AS region,
       order_ts,
       amount,
       load_ts,
       GETDATE() AS staged_at
INTO   #stg_orders
FROM   dbo.stg_orders_raw
WHERE  status <> 'CANCELLED'
ORDER  BY load_ts;

-- STEP 07 | dedupe_orders
WITH ranked AS (
    SELECT ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY load_ts DESC) AS rn
    FROM   #stg_orders
)
DELETE FROM ranked WHERE rn > 1;

-- STEP 08 | merge_dim_customer
MERGE dbo.dim_customer AS tgt
USING (
    SELECT customer_id, customer_name, region
    FROM (
        SELECT customer_id, customer_name, region,
               ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_ts DESC) AS rn
        FROM   #stg_orders
    ) x
    WHERE rn = 1
) AS src
ON tgt.customer_id = src.customer_id
WHEN MATCHED AND (tgt.customer_name <> src.customer_name OR tgt.region <> src.region) THEN
    UPDATE SET tgt.customer_name = src.customer_name,
               tgt.region        = src.region,
               tgt.updated_at    = GETDATE()
WHEN NOT MATCHED BY TARGET THEN
    INSERT (customer_id, customer_name, region, updated_at)
    VALUES (src.customer_id, src.customer_name, src.region, GETDATE());

-- STEP 09 | region_summary_cursor
DECLARE @region VARCHAR(20), @cnt INT, @total DECIMAL(18,2);
DECLARE region_cur CURSOR FOR
    SELECT DISTINCT region FROM #stg_orders;
OPEN region_cur;
FETCH NEXT FROM region_cur INTO @region;
WHILE @@FETCH_STATUS = 0
BEGIN
    SELECT @cnt = COUNT(*), @total = ISNULL(SUM(amount), 0)
    FROM   #stg_orders
    WHERE  region = @region;

    INSERT INTO dbo.region_summary (region, order_count, total_amount, loaded_at)
    VALUES (@region, @cnt, @total, GETDATE());

    FETCH NEXT FROM region_cur INTO @region;
END
CLOSE region_cur;
DEALLOCATE region_cur;

-- STEP 10 | backfill_dim_date_loop
DECLARE @d DATE = (SELECT MIN(CAST(order_ts AS DATE)) FROM #stg_orders);
DECLARE @last DATE = (SELECT MAX(CAST(order_ts AS DATE)) FROM #stg_orders);
WHILE @d <= @last
BEGIN
    INSERT INTO dbo.dim_date (date_key, calendar_date, day_name)
    VALUES (CONVERT(INT, FORMAT(@d, 'yyyyMMdd')), @d, DATENAME(weekday, @d));
    SET @d = DATEADD(day, 1, @d);
END

-- STEP 11 | aggregate_daily_sales
INSERT INTO dbo.fact_daily_sales (sales_date, region, order_count, total_amount)
SELECT CAST(order_ts AS DATE) AS sales_date,
       region,
       COUNT(*)               AS order_count,
       SUM(amount)            AS total_amount
FROM   #stg_orders
GROUP  BY CAST(order_ts AS DATE), region;

-- STEP 12 | log_success
INSERT INTO dbo.etl_log (run_at, step_name, rows_loaded, message)
SELECT GETDATE(), 'nightly_sales_batch', ISNULL(COUNT(*), 0), 'completed'
FROM   dbo.fact_daily_sales;

-- STEP 13 | error_handling_wrapper
BEGIN TRY
    EXEC dbo.usp_nightly_sales_batch_body;
END TRY
BEGIN CATCH
    INSERT INTO dbo.etl_log (run_at, step_name, rows_loaded, message)
    VALUES (GETDATE(), 'nightly_sales_batch', 0, ERROR_MESSAGE());
    THROW;
END CATCH
