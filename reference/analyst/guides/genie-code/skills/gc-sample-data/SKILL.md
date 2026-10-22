---
name: gc-sample-data
description: Knows the gc_ sample tables (gc_customers, gc_products, gc_orders, gc_orders_silver and two gold tables) and the prompt conventions for the Genie Code guide. Use when a request mentions gc_ tables, revenue by region or month, customer value, or the gc_orders_flow, gc_orders_analysis or gc_sales_dashboard assets.
---

# gc-sample-data

Use this skill when the request touches the Genie Code guide's sample data. Ask for the catalog and schema if the request does not give them, then use full `catalog.schema.table` names.

## Tables and grain

| Table | Grain | Columns |
|---|---|---|
| `gc_customers` | one row per `customer_id` | `customer_id`, `region`, `segment`, `signup_date` |
| `gc_products` | one row per `product_id` | `product_id`, `category`, `list_price` |
| `gc_orders` | one row per `order_id` | `order_id`, `customer_id`, `product_id`, `order_ts`, `quantity`, `unit_price`, `status` |
| `gc_orders_silver` | one row per revenue order | orders joined to customer and product, plus `order_total` and `order_month` |
| `gc_sales_by_region_month` | one row per `order_month`, `region`, `category` | `orders`, `units`, `revenue` |
| `gc_customer_value` | one row per `customer_id` | `orders`, `revenue`, `first_order_date`, `last_order_date` |

## Rules

- Revenue orders have `status` of `completed` or `shipped`. `cancelled` and `returned` never count.
- `order_total` is `quantity * unit_price`. `order_month` is the first day of the month of `order_ts`.
- Every gold total must equal `SUM(order_total)` on `gc_orders_silver`.
- Name new assets with the `gc_` prefix so the check notebook finds them.

## Prompt conventions

1. Name the source tables in full.
2. State the grain in one sentence.
3. Name the output table and the write mode (overwrite for rebuilt tables).
4. Say "do not write any table" for analysis.
5. End with an assert that ties the result to a source total.

## Do not

- Write to a table that is not prefixed `gc_`.
- Join without stating the key. A missing key fans out the rows and doubles revenue.
- Drop or replace `gc_orders`, `gc_customers` or `gc_products`. The preflight notebook owns them.
