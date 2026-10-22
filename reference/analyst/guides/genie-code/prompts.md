# Genie Code prompt library

Replace `<catalog>` and `<schema>` with the values the preflight printed. Every prompt names its tables, states the grain, and asks for a test. Paste one prompt at a time, read the plan and the diff, then run it.

Keep this file in Git. When a prompt changes, change it here first and note what the change fixed.

## Step 1. Lakeflow Designer (visual data prep)

Click the plus icon (**New**), choose **Visual data prep**, and describe each step in the canvas prompt, which opens Genie Code. Save the file as `gc_orders_flow`. The Output operator has Overwrite, Append and Merge write modes; the prompts ask for Overwrite.

### 1.1 Silver

```text
Sources: <catalog>.<schema>.gc_orders, gc_customers and gc_products.
Keep orders whose status is completed or shipped.
Join gc_customers on customer_id and gc_products on product_id (inner joins).
Add order_total = quantity * unit_price, and order_month = the first day of the month of order_ts.
Remove duplicate rows by order_id with a Unique operator.
Write the result to the table <catalog>.<schema>.gc_orders_silver, overwrite mode.
```

Check after it runs:

- Row count equals `SELECT COUNT(*) FROM gc_orders WHERE status IN ('completed','shipped')`.
- `COUNT(*) = COUNT(DISTINCT order_id)` on `gc_orders_silver`.
- `region`, `segment` and `category` have no nulls.

### 1.2 Gold: sales by region and month

```text
After the gc_orders_silver output, add an Aggregate.
Group by order_month, region and category.
Compute orders = count of order_id, units = sum of quantity, revenue = sum of order_total.
The grain is one row per order_month, region and category.
Write the result to <catalog>.<schema>.gc_sales_by_region_month, overwrite mode.
```

Check: `SUM(revenue)` equals `SUM(order_total)` on silver. No (order_month, region, category) key appears twice.

### 1.3 Gold: customer value

```text
Add a second branch from gc_orders_silver.
Group by customer_id, region and segment.
Compute orders = count of order_id, revenue = sum of order_total,
first_order_date = min of order_ts cast to date, last_order_date = max of order_ts cast to date.
The grain is one row per customer_id.
Write the result to <catalog>.<schema>.gc_customer_value, overwrite mode.
```

Check: one row per `customer_id`, and `SUM(revenue)` equals the silver total.

## Step 2. Genie Code in a notebook

Create a notebook named `gc_orders_analysis`, attach serverless compute, open Genie Code and use agent mode.

### 2.1 Profile

```text
In a new cell, profile <catalog>.<schema>.gc_orders_silver.
Show the row count, the null count per column, the min and max of order_ts,
the number of distinct customer_id values, and revenue by status.
Only read the table. Do not write any table.
Add an assert that the row count equals the distinct order_id count.
```

### 2.2 Transformation

```text
Read <catalog>.<schema>.gc_customer_value.
Add spend_tier with percent_rank over revenue: top 10 percent is high, the next 40 percent is mid, the rest is low.
The grain stays one row per customer_id.
Display the count of customers and the revenue per tier.
Add an assert that the tier counts add up to the row count of gc_customer_value.
Do not write a table.
```

### 2.3 Chart

```text
Read <catalog>.<schema>.gc_sales_by_region_month.
Draw a line chart of revenue by order_month with one line per region, sorted by month, with titles and axis labels.
Add an assert that the sum of the plotted values equals SUM(revenue) in the table.
```

Check after each prompt: read the diff, confirm the table names match, run the cell, and confirm the assert passes.

## Step 3. Genie Code for an AI/BI dashboard

Create a dashboard named `gc_sales_dashboard`, open Genie Code in the dashboard and ask for a draft.

### 3.1 Draft

```text
In this dashboard, named gc_sales_dashboard, use <catalog>.<schema>.gc_sales_by_region_month and <catalog>.<schema>.gc_customer_value.
Use one dataset per table and no joins. Select only the columns each visual needs.
Page Overview:
- a counter for total revenue
- a line chart of revenue by order_month, split by region
- a bar chart of revenue by category
- a table of the top 10 customers by revenue, with segment and region
Add a filter on region that applies to the first three visuals.
```

### 3.2 Fix-ups

```text
Format revenue as currency with no decimals, sort the bar chart from highest to lowest,
and rename the visuals so each title says what it measures.
```

Check: the counter equals `SUM(revenue)` on `gc_sales_by_region_month`. The Data tab shows only the two gold tables. Picking one region changes all three filtered visuals.

## Step 4. Check

Run `02_check_outputs`. It reports what exists, what reconciles, and what is missing.
