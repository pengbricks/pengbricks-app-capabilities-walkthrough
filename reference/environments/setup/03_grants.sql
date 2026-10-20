-- Grants for layout (a). Not executed by this repo: replace the group names and the <placeholders>.
-- Grant to groups, never to individual users. Groups are account-level, so every workspace sees them.

-- dev: engineers build freely, including a schema of their own for a sandbox.
GRANT ALL PRIVILEGES ON CATALOG dev TO `dev-engineers`;

-- test and stage: engineers read and the environment's service principal writes.
ALTER CATALOG test  OWNER TO `<test-run-as-service-principal-application-id>`;
ALTER CATALOG stage OWNER TO `<stage-run-as-service-principal-application-id>`;
GRANT USE CATALOG, USE SCHEMA, SELECT ON CATALOG test  TO `dev-engineers`;
GRANT USE CATALOG, USE SCHEMA, SELECT ON CATALOG stage TO `dev-engineers`;

-- prod: people read, only the service principal writes. The owner has every privilege, so make
-- the run-as service principal the owner and nobody else needs write grants.
ALTER CATALOG prod OWNER TO `<prod-run-as-service-principal-application-id>`;
GRANT USE CATALOG, USE SCHEMA, SELECT ON CATALOG prod TO `prod-analysts`;
GRANT USE CATALOG, USE SCHEMA, SELECT ON CATALOG prod TO `dev-engineers`;

-- The deploy service principal creates schemas and the jobs that fill them. It does not need the data.
GRANT USE CATALOG, CREATE SCHEMA ON CATALOG prod TO `<prod-deploy-service-principal-application-id>`;

-- Check one catalog: who holds what, and who owns it.
SHOW GRANTS ON CATALOG prod;
DESCRIBE CATALOG EXTENDED prod;
