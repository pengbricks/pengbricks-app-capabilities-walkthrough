-- Revenue metric view for the AI/BI visualizations guide: base measures, a ratio, and window measures
-- (running total, rolling three months, prior month) that dashboard charts read with MEASURE(). Step 2 of
-- the capability_guides_aibi_visualizations job.
--
-- The job passes catalog and schema as parameters. USE sets them, so analyst_orders and
-- analyst_customers inside the YAML resolve in the right catalog and schema. Run by hand: fill in the
-- parameter boxes the editor shows for :catalog and :schema.
--
-- Safe to rerun: CREATE OR REPLACE VIEW replaces the definition.

USE CATALOG IDENTIFIER(:catalog);
USE SCHEMA IDENTIFIER(:schema);

CREATE OR REPLACE VIEW analyst_viz_metrics
WITH METRICS
LANGUAGE YAML
AS $$
version: 1.1
comment: >-
  Completed and shipped orders from the analyst sample data. Read by the AI/BI visualizations
  dashboard, so its charts and any Genie Agent or SQL query share these definitions.
source: analyst_orders
filter: status IN ('completed', 'shipped')

joins:
  - name: customer
    source: analyst_customers
    'on': source.customer_id = customer.customer_id
    rely:
      at_most_one_match: true

fields:
  - name: order_month
    expr: CAST(DATE_TRUNC('MONTH', source.order_ts) AS DATE)
    display_name: Order Month
    synonyms: ['month']
  - name: region
    expr: customer.region
    display_name: Region
    synonyms: ['geography']
  - name: segment
    expr: customer.segment
    display_name: Segment
    synonyms: ['customer segment', 'tier']

measures:
  - name: revenue
    expr: SUM(source.quantity * source.unit_price)
    display_name: Revenue
    comment: Quantity x unit price for completed and shipped orders.
    synonyms: ['sales']
    format:
      type: currency
      currency_code: USD
  - name: orders
    expr: COUNT(1)
    display_name: Orders
    comment: Number of completed and shipped orders.
  - name: avg_order_value
    expr: MEASURE(revenue) / MEASURE(orders)
    display_name: Average Order Value
    comment: Revenue divided by orders, computed after grouping so it stays a true ratio.
    format:
      type: currency
      currency_code: USD
  - name: revenue_running_total
    expr: SUM(source.quantity * source.unit_price)
    window:
      - order: order_month
        range: cumulative
        semiadditive: last
    display_name: Revenue Running Total
    comment: Revenue from the first month up to and including the month in each row.
    synonyms: ['cumulative revenue', 'year to date revenue', 'cumsum']
    format:
      type: currency
      currency_code: USD
  - name: revenue_trailing_3m
    expr: SUM(source.quantity * source.unit_price)
    window:
      - order: order_month
        range: trailing 3 month inclusive
        semiadditive: last
    display_name: Revenue Trailing 3 Months
    comment: Revenue of the month in each row plus the two before it.
    format:
      type: currency
      currency_code: USD
  - name: revenue_prior_month
    expr: SUM(source.quantity * source.unit_price)
    window:
      - order: order_month
        range: current
        offset: -1 month
        semiadditive: last
    display_name: Revenue Prior Month
    format:
      type: currency
      currency_code: USD
  - name: revenue_mom_growth
    expr: MEASURE(revenue) / MEASURE(revenue_prior_month) - 1
    display_name: Revenue Month-over-Month Growth
    format:
      type: percentage
$$;
