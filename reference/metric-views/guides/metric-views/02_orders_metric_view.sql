-- Orders metric view: net revenue, order count, active customers, ratios, and window measures.
--
-- This file is the definition. Review it in Git, deploy it with a Lakeflow Jobs SQL task, and every
-- dashboard, Genie Agent, notebook, and BI tool reads the same measures.
--
-- The job passes catalog and schema as parameters. USE sets them for the statement below, so the table
-- names inside the YAML (mv_orders, mv_customers, mv_products) resolve in the right catalog and schema.
-- Databricks resolves them when the view is created and stores the result. Run by hand: fill in the
-- parameter boxes the editor shows for :catalog and :schema.
--
-- Safe to rerun: CREATE OR REPLACE VIEW replaces the definition. It also drops the view's tags (the
-- reference run showed this for system.certification_status), so step 5 sets the tag again after every
-- deploy. ALTER VIEW ... AS $$ ... $$ changes the definition and keeps tags.

USE CATALOG IDENTIFIER(:catalog);
USE SCHEMA IDENTIFIER(:schema);

CREATE OR REPLACE VIEW mv_orders_metrics
WITH METRICS
LANGUAGE YAML
AS $$
version: 1.1
comment: >-
  Completed orders. Net revenue is quantity x unit price after discount. Cancelled and returned
  orders are excluded by the filter, so every consumer sees the same scope.
source: mv_orders
filter: order_status = 'completed'

joins:
  - name: customer
    source: mv_customers
    'on': source.customer_id = customer.customer_id
    rely:
      at_most_one_match: true
  - name: product
    source: mv_products
    'on': source.product_id = product.product_id
    rely:
      at_most_one_match: true

fields:
  - name: order_date
    expr: source.order_date
    display_name: Order Date
    synonyms: ['date', 'day']
  - name: order_month
    expr: DATE_TRUNC('MONTH', source.order_date)
    display_name: Order Month
    synonyms: ['month']
  - name: sales_channel
    expr: source.channel
    display_name: Sales Channel
    synonyms: ['channel']
  - name: customer_segment
    expr: customer.segment
    display_name: Customer Segment
    synonyms: ['segment', 'tier']
  - name: customer_region
    expr: customer.region
    display_name: Customer Region
    synonyms: ['region', 'geography']
  - name: product_category
    expr: product.category
    display_name: Product Category
    synonyms: ['category']

measures:
  - name: order_count
    expr: COUNT(DISTINCT source.order_id)
    comment: Number of completed orders.
    display_name: Order Count
    synonyms: ['orders', 'number of orders']
    format:
      type: number
      decimal_places:
        type: exact
        places: 0
  - name: gross_revenue
    expr: SUM(source.quantity * source.unit_price)
    comment: Quantity x unit price before discount.
    display_name: Gross Revenue
    format:
      type: currency
      currency_code: USD
      decimal_places:
        type: exact
        places: 2
  - name: net_revenue
    expr: SUM(source.quantity * source.unit_price * (1 - source.discount_pct))
    comment: Quantity x unit price after discount, completed orders only.
    display_name: Net Revenue
    synonyms: ['revenue', 'sales', 'turnover']
    format:
      type: currency
      currency_code: USD
      decimal_places:
        type: exact
        places: 2
  - name: active_customers
    expr: COUNT(DISTINCT source.customer_id)
    comment: Distinct customers with at least one completed order in the group.
    display_name: Active Customers
    synonyms: ['buyers', 'purchasing customers']
    format:
      type: number
      decimal_places:
        type: exact
        places: 0
  - name: avg_order_value
    expr: MEASURE(net_revenue) / MEASURE(order_count)
    comment: Net revenue divided by order count, computed after both are summed for the group.
    display_name: Average Order Value
    synonyms: ['AOV', 'average order size']
    format:
      type: currency
      currency_code: USD
      decimal_places:
        type: exact
        places: 2
  - name: revenue_per_active_customer
    expr: MEASURE(net_revenue) / MEASURE(active_customers)
    comment: Net revenue divided by distinct active customers in the group.
    display_name: Revenue per Active Customer
    format:
      type: currency
      currency_code: USD
      decimal_places:
        type: exact
        places: 2
  - name: discount_rate
    expr: 1 - MEASURE(net_revenue) / MEASURE(gross_revenue)
    comment: Share of gross revenue given away as discount.
    display_name: Discount Rate
    synonyms: ['discount share']
    format:
      type: percentage
      decimal_places:
        type: exact
        places: 1
  - name: net_revenue_prior_month
    expr: SUM(source.quantity * source.unit_price * (1 - source.discount_pct))
    window:
      - order: order_month
        range: current
        offset: -1 month
        semiadditive: last
    comment: Net revenue of the month before the month in each row.
    display_name: Net Revenue, Prior Month
    format:
      type: currency
      currency_code: USD
      decimal_places:
        type: exact
        places: 2
  - name: net_revenue_mom_growth
    expr: (MEASURE(net_revenue) - MEASURE(net_revenue_prior_month)) / NULLIF(MEASURE(net_revenue_prior_month), 0)
    comment: Month-over-month change in net revenue. Group by Order Month to read it.
    display_name: Net Revenue MoM Growth
    synonyms: ['month over month growth', 'MoM']
    format:
      type: percentage
      decimal_places:
        type: exact
        places: 1
  - name: net_revenue_trailing_3_months
    expr: SUM(source.quantity * source.unit_price * (1 - source.discount_pct))
    window:
      - order: order_month
        range: trailing 3 month inclusive
        semiadditive: last
    comment: Net revenue of the month in each row plus the two before it.
    display_name: Net Revenue, Rolling 3 Months
    format:
      type: currency
      currency_code: USD
      decimal_places:
        type: exact
        places: 2
  - name: cumulative_net_revenue
    expr: SUM(source.quantity * source.unit_price * (1 - source.discount_pct))
    window:
      - order: order_month
        range: cumulative
        semiadditive: last
    comment: Running total of net revenue up to and including the month in each row.
    display_name: Cumulative Net Revenue
    format:
      type: currency
      currency_code: USD
      decimal_places:
        type: exact
        places: 2
$$;
