-- Layout (a): one catalog per environment, each with its own managed storage location.
-- Run as a metastore admin in any workspace attached to the metastore. Not executed by this repo:
-- replace the <placeholders>. The storage credentials (dev_storage ... prod_storage) come from
-- 02_credentials_and_bindings.sh and each one points at a different cloud role.

-- One external location per environment, on that environment's own bucket or container.
CREATE EXTERNAL LOCATION IF NOT EXISTS dev_managed   URL 's3://<dev-bucket>/unity'   WITH (STORAGE CREDENTIAL dev_storage);
CREATE EXTERNAL LOCATION IF NOT EXISTS test_managed  URL 's3://<test-bucket>/unity'  WITH (STORAGE CREDENTIAL test_storage);
CREATE EXTERNAL LOCATION IF NOT EXISTS stage_managed URL 's3://<stage-bucket>/unity' WITH (STORAGE CREDENTIAL stage_storage);
CREATE EXTERNAL LOCATION IF NOT EXISTS prod_managed  URL 's3://<prod-bucket>/unity'  WITH (STORAGE CREDENTIAL prod_storage);

-- The catalog creator needs CREATE CATALOG on the metastore and CREATE MANAGED STORAGE on the location.
GRANT CREATE MANAGED STORAGE ON EXTERNAL LOCATION prod_managed TO `platform-admins`;

-- One catalog per environment. MANAGED LOCATION must sit inside the matching external location.
CREATE CATALOG IF NOT EXISTS dev   MANAGED LOCATION 's3://<dev-bucket>/unity/dev'     COMMENT 'dev environment';
CREATE CATALOG IF NOT EXISTS test  MANAGED LOCATION 's3://<test-bucket>/unity/test'   COMMENT 'test environment';
CREATE CATALOG IF NOT EXISTS stage MANAGED LOCATION 's3://<stage-bucket>/unity/stage' COMMENT 'stage environment';
CREATE CATALOG IF NOT EXISTS prod  MANAGED LOCATION 's3://<prod-bucket>/unity/prod'   COMMENT 'prod environment';

-- Domain schemas inside each catalog. The bundle's schema variable points at one of these.
CREATE SCHEMA IF NOT EXISTS dev.sales;
CREATE SCHEMA IF NOT EXISTS test.sales;
CREATE SCHEMA IF NOT EXISTS stage.sales;
CREATE SCHEMA IF NOT EXISTS prod.sales;

-- Layout (b) swaps the catalog names for <env>_<domain> and the schema for a layer:
--   CREATE CATALOG IF NOT EXISTS prod_sales MANAGED LOCATION 's3://<prod-bucket>/unity/prod_sales';
--   CREATE SCHEMA  IF NOT EXISTS prod_sales.reporting;
-- Layout (c) is one catalog with environment schemas, and one managed location for all of them:
--   CREATE SCHEMA IF NOT EXISTS analytics.prod_sales;
