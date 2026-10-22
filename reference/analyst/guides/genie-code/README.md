# Genie Code: from sample data to notebooks and dashboards

## Overview

A job writes a governed sample dataset. You then shape it into silver and gold tables with Lakeflow Designer, build an analysis notebook with Genie Code, and build an AI/BI dashboard with Genie Code, all from the prompts in `prompts.md`. A second job task checks that the tables exist, reconcile to the sample, and sit at the stated grain, and it lists the `gc_` notebooks and dashboards.

## Required setup

- For `03_install_skills`: write access to your home folder. Writing to `/Workspace/.assistant/skills` needs access to that folder, which workspace admins can grant. Workspace instructions can be edited only by workspace admins, so nothing here writes them.
- **Genie Code** available in the workspace (notebooks, SQL editor, Lakeflow Pipelines Editor, dashboards).
- **Partner-powered AI features** on at the account and workspace level, because Genie Code's agentic capabilities need them. An admin sets this.
- **Lakeflow Designer** access (**New**, then **Visual data prep**).
- **A serverless SQL warehouse** for the dashboard datasets.
- Unity Catalog: `USE CATALOG`, `USE SCHEMA`, `SELECT` and `CREATE TABLE` on the schema. Genie Code runs as you.

## What this shows

| Guide goal | Artifact |
|---|---|
| Governed sample data, fixed seed | `gc_customers` (2,000), `gc_products` (30), `gc_orders` (60,000) |
| Designer flow | `gc_orders_flow`, writing `gc_orders_silver`, `gc_sales_by_region_month`, `gc_customer_value` |
| Genie Code notebook | `gc_orders_analysis` |
| Genie Code dashboard | `gc_sales_dashboard` |
| Check | `02_check_outputs` reports missing steps and mismatches without failing |

## Reference code

- `guides/genie-code/00_start_here`: required setup, the prompt library, and the job link
- `guides/genie-code/prompts.md`: the prompts to keep in Git
- `guides/genie-code/01_preflight_sample_data`: sample tables with `CREATE OR REPLACE`
- `guides/genie-code/02_check_outputs`: existence, reconciliation, grain, and `gc_` asset listing
- `guides/genie-code/skills/gc-sample-data/SKILL.md`: an example skill that knows the `gc_` tables and the prompt rules
- `guides/genie-code/instructions.md`: an example instructions file (under the 20,000-character limit)
- `guides/genie-code/03_install_skills`: standalone notebook that copies the skill to `/Users/<you>/.assistant/skills/` and prints the steps to publish to the shared folder; the workspace-wide write is behind a parameter that defaults to off
- `src/analyst_common/genie_skills.py`: documented locations, skill validation and install planning
- `src/analyst_common/genie_code.py`: table names, the sample spec, and the pure check helpers
- `resources/genie_code.job.yml`: the two-task job

## Demo steps

1. Run the job `capability-guides-genie-code`. The check reports the missing steps.
2. Paste the Step 1 prompts into Lakeflow Designer. After each, run the check listed in `prompts.md`.
3. Paste the Step 2 prompts into a notebook named `gc_orders_analysis`.
4. Paste the Step 3 prompts into a dashboard named `gc_sales_dashboard`.
5. Run the job again. The status should read `complete`.

## Limitations and next steps

- Designer, Genie Code, and dashboard creation are interactive. The job cannot run them, so the check reports their state instead.
- Genie Code output varies from run to run. The checks compare totals and grain, not wording.
- `03_install_skills` is not a job task. It changes your own Genie Code settings, so it runs by hand.
- Cleanup: delete `/Users/<you>/.assistant/skills/gc-sample-data`, then drop the `gc_` tables and delete the flow, notebook, and dashboard. Nothing bills while idle.
