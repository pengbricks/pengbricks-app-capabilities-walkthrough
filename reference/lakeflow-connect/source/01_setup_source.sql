-- One-time source setup for the Lakeflow Connect SQL Server guide. Run as a db_owner, in sqlcmd mode:
--
--   sqlcmd -S <server> -d LakeflowDemo -U <setup_user> -P <password> -N -i 01_setup_source.sql \
--          -v IngestPassword="<ingest-password>" AppPassword="<app-password>"
--
-- Before this script: create the database, install the Databricks utility objects script
-- (utility_script.sql) in it, and on SQL Server (not Azure SQL) make sure SQL Server Agent is running,
-- because CDC capture jobs run in the Agent. In a container, start it with MSSQL_AGENT_ENABLED=true.
--
-- It creates three tables with sample rows, two logins, CDC on customers (history, SCD type 2),
-- Change Tracking on orders and products (latest row, SCD type 1), and the connector's grants.
-- Safe to rerun: existing tables, rows, and logins are kept, and change capture is enabled only where it is missing.

SET NOCOUNT ON;
GO

-- 1 · Logins. lakeflow_ingest is the connector's read login and goes in the Unity Catalog connection.
--     lakeflow_demo_app plays the application: the guide job uses it to insert, update, delete, and
--     add a column. Its password goes in a Databricks secret scope, never in code.
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'lakeflow_ingest')
BEGIN
    IF SERVERPROPERTY('EngineEdition') = 5  -- Azure SQL Database: contained users
        EXEC('CREATE USER lakeflow_ingest WITH PASSWORD = ''$(IngestPassword)''');
    ELSE
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'lakeflow_ingest')
            EXEC('CREATE LOGIN lakeflow_ingest WITH PASSWORD = ''$(IngestPassword)'', CHECK_POLICY = ON');
        CREATE USER lakeflow_ingest FOR LOGIN lakeflow_ingest;
    END
END
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'lakeflow_demo_app')
BEGIN
    IF SERVERPROPERTY('EngineEdition') = 5
        EXEC('CREATE USER lakeflow_demo_app WITH PASSWORD = ''$(AppPassword)''');
    ELSE
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'lakeflow_demo_app')
            EXEC('CREATE LOGIN lakeflow_demo_app WITH PASSWORD = ''$(AppPassword)'', CHECK_POLICY = ON');
        CREATE USER lakeflow_demo_app FOR LOGIN lakeflow_demo_app;
    END
END
GO

-- 2 · Tables. Every table has a primary key; customers needs CDC for history, the others use Change Tracking.
IF OBJECT_ID('dbo.products') IS NULL
    CREATE TABLE dbo.products (
        product_id  INT           NOT NULL PRIMARY KEY,
        name        NVARCHAR(100) NOT NULL,
        category    NVARCHAR(50)  NOT NULL,
        list_price  MONEY         NOT NULL
    );
IF OBJECT_ID('dbo.customers') IS NULL
    CREATE TABLE dbo.customers (
        customer_id INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        name        NVARCHAR(100) NOT NULL,
        email       NVARCHAR(200) NOT NULL,
        city        NVARCHAR(60)  NOT NULL,
        plan_name   NVARCHAR(20)  NOT NULL,  -- Basic, Standard, Premium
        status      NVARCHAR(20)  NOT NULL,  -- ACTIVE, CLOSED
        created_at  DATETIME2(0)  NOT NULL,
        updated_at  DATETIME2(0)  NOT NULL
    );
IF OBJECT_ID('dbo.orders') IS NULL
    CREATE TABLE dbo.orders (
        order_id    INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        customer_id INT           NOT NULL REFERENCES dbo.customers (customer_id),
        product_id  INT           NOT NULL REFERENCES dbo.products (product_id),
        quantity    INT           NOT NULL,
        amount      MONEY         NOT NULL,
        status      NVARCHAR(20)  NOT NULL,  -- NEW, SHIPPED, CANCELLED
        order_ts    DATETIME2(0)  NOT NULL,
        updated_at  DATETIME2(0)  NOT NULL
    );
GO

-- 3 · Sample rows: 12 products, 200 customers, 1,000 orders. Made up; the same on every server.
IF NOT EXISTS (SELECT 1 FROM dbo.products)
    INSERT INTO dbo.products (product_id, name, category, list_price) VALUES
        (1, 'Trail Bottle', 'Outdoor', 18.00), (2, 'Day Pack', 'Outdoor', 64.00),
        (3, 'Camp Stove', 'Outdoor', 89.00), (4, 'Desk Lamp', 'Home', 42.00),
        (5, 'Throw Blanket', 'Home', 55.00), (6, 'Pour-over Kettle', 'Home', 38.00),
        (7, 'Wireless Mouse', 'Electronics', 29.00), (8, 'USB-C Hub', 'Electronics', 49.00),
        (9, 'Noise-cancelling Headphones', 'Electronics', 199.00), (10, 'Notebook Set', 'Office', 12.00),
        (11, 'Standing Mat', 'Office', 75.00), (12, 'Monitor Arm', 'Office', 119.00);

IF NOT EXISTS (SELECT 1 FROM dbo.customers)
BEGIN
    ;WITH n AS (SELECT TOP (200) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS i FROM sys.all_objects)
    INSERT INTO dbo.customers (name, email, city, plan_name, status, created_at, updated_at)
    SELECT CONCAT('Customer ', FORMAT(i, '0000')),
           CONCAT('customer', FORMAT(i, '0000'), '@example.com'),
           CHOOSE(i % 6 + 1, 'Denver', 'Phoenix', 'Austin', 'Portland', 'Columbus', 'Raleigh'),
           CHOOSE(i % 3 + 1, 'Basic', 'Standard', 'Premium'),
           CASE WHEN i % 25 = 0 THEN 'CLOSED' ELSE 'ACTIVE' END,
           DATEADD(DAY, -(i * 7), '2026-09-30'),
           DATEADD(DAY, -(i * 7), '2026-09-30')
    FROM n;
END

IF NOT EXISTS (SELECT 1 FROM dbo.orders)
BEGIN
    ;WITH n AS (SELECT TOP (1000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS i
               FROM sys.all_objects a CROSS JOIN sys.all_objects b)
    INSERT INTO dbo.orders (customer_id, product_id, quantity, amount, status, order_ts, updated_at)
    SELECT i % 200 + 1, i % 12 + 1, i % 4 + 1, (i % 4 + 1) * p.list_price,
           CASE WHEN i % 20 = 0 THEN 'CANCELLED' WHEN i % 3 = 0 THEN 'NEW' ELSE 'SHIPPED' END,
           DATEADD(MINUTE, -(i * 97), '2026-09-30T12:00:00'),
           DATEADD(MINUTE, -(i * 97), '2026-09-30T12:00:00')
    FROM n JOIN dbo.products p ON p.product_id = n.i % 12 + 1;
END
GO

-- 4 · Change capture, per table. CDC for the history table, Change Tracking for the rest.
--     Never enable both on one table: with both on, the connector uses Change Tracking and history is lost.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID('dbo.customers') AND is_tracked_by_cdc = 1) EXEC dbo.lakeflowSetupChangeDataCapture @Tables = 'dbo.customers', @User = 'lakeflow_ingest';
IF (SELECT COUNT(*) FROM sys.change_tracking_tables WHERE object_id IN (OBJECT_ID('dbo.orders'), OBJECT_ID('dbo.products'))) < 2 EXEC dbo.lakeflowSetupChangeTracking
     @Tables = 'dbo.orders,dbo.products',
     @User = 'lakeflow_ingest',
     @Retention = '3 DAYS',
     @CreateDdlSupportingObjects = 1;  -- captures DDL so new columns flow through
EXEC dbo.lakeflowFixPermissions @User = 'lakeflow_ingest', @Tables = 'SCHEMAS:dbo';
GO

-- CDC cleanup retention, in minutes (20160 = 14 days). Size it to the longest gateway outage you can absorb.
IF SERVERPROPERTY('EngineEdition') <> 5
    EXEC sys.sp_cdc_change_job @job_type = N'cleanup', @retention = 20160;
GO

-- 5 · The application login: change rows, and add a column to customers for the schema-change step.
ALTER ROLE db_datareader ADD MEMBER lakeflow_demo_app;
ALTER ROLE db_datawriter ADD MEMBER lakeflow_demo_app;
GRANT ALTER ON OBJECT::dbo.customers TO lakeflow_demo_app;
GRANT EXECUTE ON OBJECT::dbo.lakeflowUtilityVersion TO lakeflow_demo_app;
GO

-- Check: utility version, platform, and which capture each table uses.
SELECT dbo.lakeflowUtilityVersion() AS utility_version, dbo.lakeflowDetectPlatform() AS platform;
SELECT t.name AS table_name, t.is_tracked_by_cdc AS cdc_on,
       CASE WHEN ct.object_id IS NULL THEN 0 ELSE 1 END AS change_tracking_on
FROM sys.tables t LEFT JOIN sys.change_tracking_tables ct ON ct.object_id = t.object_id
WHERE t.name IN ('customers', 'orders', 'products')
ORDER BY t.name;
GO
