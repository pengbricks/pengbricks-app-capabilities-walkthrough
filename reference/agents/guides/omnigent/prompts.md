# Prompts for Omnigent

Paste these into one Omnigent session, in order. Replace `<owner>/<repo>` with your repository. Notebook `01_preflight_raw_volume` prints this file with `<catalog>` and `<schema>` already filled in.

The pipeline name prefix is `omnigent_`, the table prefix is `omni_`, and the feature branch is `feature/omni-orders-pipeline`. If your `github_policy` allows other branch patterns, keep the branch inside them.

## Prompt 1: build the bundle on a feature branch

```text
Work in the GitHub repository <owner>/<repo>. Create the branch feature/omni-orders-pipeline from the default branch. Do not push to any other branch.

Build a Declarative Automation Bundle in the folder omnigent_orders/ with a Lakeflow Declarative Pipeline named omnigent_orders. It reads raw files from the Unity Catalog volume /Volumes/<catalog>/<schema>/omnigent_raw and writes to the schema <catalog>.<schema>. Use serverless compute and write every table name with the prefix omni_.

Bronze, with Auto Loader (cloud_files or read_files in streaming mode):
- omni_bronze_orders from /Volumes/<catalog>/<schema>/omnigent_raw/orders.csv (CSV with a header)
- omni_bronze_customers from /Volumes/<catalog>/<schema>/omnigent_raw/customers.json (one JSON object per line)
- omni_bronze_events from /Volumes/<catalog>/<schema>/omnigent_raw/events/ (JSON lines files)
Keep every raw row. Add the source file path and the ingest time as columns.

Silver:
- omni_silver_orders: one row per order_id, drop rows where amount is null, cast amount to decimal(10,2) and order_date to date
- omni_silver_customers: one row per customer_id
- omni_silver_events: events whose order_id exists in omni_silver_orders

Gold:
- omni_gold_daily_revenue: group omni_silver_orders by order_date and region, with columns order_date, region, order_count, and revenue (the sum of amount)

Add a databricks.yml with a dev target in development mode, the catalog and schema as bundle variables, and a README.md that explains how to deploy. Commit to the feature branch and push it. Do not deploy yet.
```

## Prompt 2: deploy to dev and run

```text
In omnigent_orders/, run databricks bundle validate for the dev target, then databricks bundle deploy --target dev, then start the pipeline omnigent_orders with a full refresh once. Wait for the update to finish and show me the update state and the row count of each omni_ table. If a step fails, fix the code on the same branch, push, and try again. Do not touch any other pipeline or table.
```

## Prompt 3: open the pull request

```text
Open a pull request from feature/omni-orders-pipeline into the default branch of <owner>/<repo>. In the description, list the tables the pipeline creates, the volume path it reads, the dev run result, and the row counts. Do not merge it.
```

## What the check expects

- A pipeline whose name starts with `omnigent_` (development mode adds a `[dev <user>]` prefix, which the check ignores).
- Tables named `omni_bronze_*`, `omni_silver_*`, and `omni_gold_*` in `<catalog>.<schema>`.
- Bronze rows equal the raw rows, silver keeps one row per `order_id` with an amount, and the gold `order_count` and `revenue` columns sum to the silver totals.
