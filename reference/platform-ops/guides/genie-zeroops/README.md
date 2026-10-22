# Genie ZeroOps: break a job and watch it get diagnosed

## Overview

Genie ZeroOps is in private preview. The `capability-guides-zeroops-demo` job gives it a failure to diagnose. Task `prepare_data` replaces a seeded `zo_orders` table. Task `daily_revenue` sums `amount_column` per day into `zo_daily_revenue`. With the default `amount` it succeeds. With `amout` the query fails with an unresolved-column error. The job has no schedule.

## Required setup

1. **ZeroOps enabled in your workspace.** Ask your Databricks account team. Nothing in the bundle turns it on.
2. **You own the job.** Deploy and run the bundle as yourself. ZeroOps monitors jobs you own.
3. **The shared schema.** Deploy `foundation/` first. The demo writes `zo_orders` and `zo_daily_revenue` there and creates nothing at account level.

## Run it

```bash
databricks bundle run capability_guides_zeroops_demo --target dev
```

Add the job to ZeroOps with Configure (outside full-screen mode), or ask in Genie Code chat: `Monitor the job capability_guides_zeroops_demo`. Then break it:

```bash
databricks bundle run capability_guides_zeroops_demo --target dev --params amount_column=amout
```

Wait 1 to 2 minutes. The ZeroOps inbox has no URL of its own. Open it from the ZeroOps banner on Jobs & Pipelines, or from full-screen Genie Code at `https://<your-workspace-host>/editor/folders/workspace?mode=chat&o=<workspace-id>`. Review the root cause, the lineage trace and the proposed fix, then approve or reject it. Reset with a run that uses the defaults.

The inbox stays empty until a monitored job fails. Plain job failure is the dependable trigger in the preview. Schema drift and data spikes are less dependable.

## What this shows

| Success criterion | Artifact |
|---|---|
| A failure with a clear root cause | `02_daily_revenue` fails on the mistyped column `amout` |
| A safe, repeatable break | `validate_column` accepts only plain identifiers, so the typo never becomes SQL injection |
| A clean reset | Both tables use `CREATE OR REPLACE`; a run with defaults restores `zo_daily_revenue` |

## Variables

| Variable | Meaning |
|---|---|
| `catalog` | Unity Catalog catalog that holds the guide schema |
| `schema` | Schema for `zo_orders` and `zo_daily_revenue` |
| `zeroops_amount_column` | Bundle variable behind the `amount_column` job parameter. Default `amount` |

## Idle cost and cleanup

Nothing runs while idle. The job has no schedule and uses serverless compute. To remove the tables: `DROP TABLE <catalog>.<schema>.zo_orders; DROP TABLE <catalog>.<schema>.zo_daily_revenue;`.

Safe to rerun: each task replaces its own table, so row counts stay the same.
