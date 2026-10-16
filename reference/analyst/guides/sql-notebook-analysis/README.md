# SQL and notebooks at scale

## Overview

One job runs SQL exploration on a SQL warehouse, a Python notebook that round-trips a result through pandas, and a timed aggregation over 6 million generated rows. An R notebook ships with the bundle but is not a task, because serverless compute does not run R.

## What this shows

| Guide goal | Artifact |
|---|---|
| Analysts query governed tables with SQL | `sql_revenue_by_region`, `sql_top_customers`, `sql_monthly_running_total` |
| Python round-trips to pandas | `pandas_region_trend`, written from a pandas result and re-read |
| R is available | `guides/sql-notebook-analysis/05_r_sparklyr_summary`, for classic compute |
| Millions of rows aggregate in seconds | `large_aggregation_timing`: 6,000,000 rows, 4.18 s for the customer-by-month aggregate |

## Architecture

```mermaid
flowchart LR
  spec[use_cases/general.yml] --> gen[generate_data]
  gen --> base[(analyst_customers, analyst_orders)]
  base --> sql[sql_exploration]
  base --> py[python_pandas_roundtrip]
  base --> big[large_aggregation]
  sql --> t1[(sql_* tables)]
  py --> t2[(pandas_region_trend)]
  big --> t3[(events_large, large_aggregation_timing)]
  base -.-> r[R notebook, classic compute]
```

## Reference code

- `guides/sql-notebook-analysis/00_start_here`: what the guide shows, the notebooks in order, and the variables
- `guides/sql-notebook-analysis/02_sql_exploration`: three statements, each saved as a table
- `guides/sql-notebook-analysis/03_python_pandas_roundtrip`: SQL to pandas, reshape, write back, row-count assert
- `guides/sql-notebook-analysis/04_large_aggregation`: generates 6 million rows and times each step
- `guides/sql-notebook-analysis/05_r_sparklyr_summary`: sparklyr aggregation, R statistics, Delta write (classic compute, not a job task)
- `resources/sql_notebooks.job.yml`: the job

## Demo steps

1. Open the latest run of `capability-guides-sql-notebooks`. Four tasks ran, and the three analysis tasks ran in parallel.
2. Open `02_sql_exploration`. Point out the `catalog` and `schema` widgets, which the job fills from its parameters.
3. Query `sql_monthly_running_total` and show the running total and month-over-month change.
4. Open `03_python_pandas_roundtrip` and walk through collect, reshape, write back.
5. Query the timings:
   ```sql
   SELECT step, rows, seconds FROM <catalog>.<schema>.large_aggregation_timing ORDER BY recorded_at DESC;
   ```
6. Open `r_sparklyr_summary.r`. Explain that it needs a classic cluster with R, so the job leaves it out.

## Artifacts produced

- Tables: `sql_revenue_by_region`, `sql_top_customers`, `sql_monthly_running_total`, `pandas_region_trend`, `events_large`, `events_large_customer_month`, `large_aggregation_timing`
- Reference run: 6,000,000 rows generated and written in 6.49 s, counted in 0.42 s, aggregated into 59,594 customer-month rows in 4.18 s, percentiles by event type in 0.83 s

## Limitations and next steps

- The R notebook was not run. Serverless has no R runtime, so verify it on a classic cluster.
- Timings include generation and a table write. They change with serverless load, so compare reruns in the timing table.
- Collecting to pandas suits results that fit on the driver. Aggregate in Spark first.
