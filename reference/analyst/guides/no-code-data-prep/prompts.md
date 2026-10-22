# Lakeflow Designer prompt

Replace `<catalog>` and `<schema>` with the values the job used. Click the plus icon (**New**), choose **Visual data prep**, and paste the text into the Genie Code prompt above the canvas. Select each operator to check its configuration and preview before you run, since the generated flow may need adjustment.

Keep this file in Git. When the prompt changes, change it here first.

## Build `prep_flow_output_designer`

```text
Sources: <catalog>.<schema>.analyst_orders and <catalog>.<schema>.analyst_customers.
Filter analyst_orders to rows where status is equal to completed and order_ts is on or after 2026-01-01.
Join the filtered orders to analyst_customers on customer_id (inner join).
Add Custom columns: order_date = order_ts cast to a date, order_total = quantity * unit_price cast to decimal(12,2), and order_size = 'large' when quantity * unit_price is 1000 or more, otherwise 'standard'.
Add a Select operator that keeps only these columns, in this order: order_number (renamed from order_id), customer_id, sales_region (renamed from region), customer_segment (renamed from segment), order_date, quantity, unit_price, order_total, order_size.
Write the result to the table <catalog>.<schema>.prep_flow_output_designer, overwrite mode.
```

## Check

Run `01_generate_data` first, then `02_build_flow_output`. The output must match `prep_flow_summary` (99,710 rows, 5,000 customers, total 138,172,774.00 in the reference run).

```sql
SELECT * FROM <catalog>.<schema>.prep_flow_summary;
SELECT COUNT(*) AS output_rows, SUM(order_total) AS output_total, COUNT(DISTINCT customer_id) AS customers
FROM <catalog>.<schema>.prep_flow_output_designer;

SELECT * FROM <catalog>.<schema>.prep_flow_output EXCEPT SELECT * FROM <catalog>.<schema>.prep_flow_output_designer;
SELECT * FROM <catalog>.<schema>.prep_flow_output_designer EXCEPT SELECT * FROM <catalog>.<schema>.prep_flow_output;
```

If the flow differs, edit the operator that is off (usually a filter condition, a join type or a column name), or re-prompt with the operator and the exact condition.
