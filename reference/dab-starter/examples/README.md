# More resources for the starter bundle

The starter deploys a pipeline, a job, and a schema. Each file here adds one more kind of resource. A file does nothing until you copy it into `resources/`; `databricks.yml` only includes `resources/*.yml`.

| File                      | Adds                                                               | Needs first                                                                    |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `app.app.yml` and `app/`  | A Databricks App that shows the gold table                         | A SQL warehouse ID, and `SELECT` on the schema for the app's service principal |
| `lakebase.postgres.yml`   | A Lakebase Postgres project, registered as a Unity Catalog catalog | Lakebase enabled in the workspace                                              |
| `dashboard.dashboard.yml` | An AI/BI dashboard on the gold table                               | A dashboard built in the UI, pulled in with `bundle generate dashboard`        |
| `genie.genie_space.yml`   | A Genie agent over the orders tables                               | A Genie agent set up in the UI, pulled in with `bundle generate genie-space`   |

To add one:

```bash
cp examples/app.app.yml resources/
databricks bundle validate --var catalog=<catalog> --var warehouse_id=<warehouse-id>
databricks bundle deploy   --var catalog=<catalog> --var warehouse_id=<warehouse-id>
```

Each file explains its settings in comments and links to the documentation for that resource type.

## Build dashboards and Genie agents in the UI, then generate

Dashboards and Genie agents are stored as JSON that the UI writes. Don't write that JSON by hand. Build the dashboard or agent in the workspace, then let the CLI write both the YAML and the JSON file:

```bash
databricks bundle generate dashboard   --existing-id <dashboard-id> --key orders_revenue
databricks bundle generate genie-space --existing-id <space-id>     --key orders_genie
```

Add `--resource <key> --watch` to keep the file in sync while you keep editing in the UI. Then commit the JSON with the rest of the bundle, so a deploy recreates the same dashboard or agent in another target.

## Names in development mode

Development mode adds a `[dev <you>]` prefix to the job, pipeline, dashboard, and Genie agent names, and a `dev_<you>_` prefix to the schema, so two people can deploy the same bundle without colliding. App names and Lakebase project and catalog IDs don't get a prefix. If dev and prod share a workspace, give those a different name or ID per target.

## Learn more

- Every resource type a bundle can deploy: <https://docs.databricks.com/aws/en/dev-tools/bundles/resources>
- Databricks Apps: <https://docs.databricks.com/aws/en/dev-tools/databricks-apps>
- Lakebase: <https://docs.databricks.com/aws/en/oltp/projects>
- AI/BI dashboards: <https://docs.databricks.com/aws/en/dashboards>
- Genie agents and Genie One: <https://docs.databricks.com/aws/en/genie-agents>, <https://docs.databricks.com/aws/en/genie-one>
- Example bundles from Databricks: <https://github.com/databricks/bundle-examples>
