"""SQL that runs at the relational source: schema, a database function, and the custom extract query."""

from __future__ import annotations

from source_ingestion.checksum import Column

SCHEMA = "source_app"

DDL = f"""
DROP SCHEMA IF EXISTS {SCHEMA} CASCADE;
CREATE SCHEMA {SCHEMA};

CREATE TABLE {SCHEMA}.customers (
  customer_id  integer PRIMARY KEY,
  first_name   text NOT NULL,
  last_name    text NOT NULL,
  email        text NOT NULL,
  city         text,
  country      text,
  segment      text,
  created_date date,
  credit_limit numeric(12,2)
);

CREATE TABLE {SCHEMA}.orders (
  order_id     integer PRIMARY KEY,
  customer_id  integer NOT NULL REFERENCES {SCHEMA}.customers (customer_id),
  order_date   date NOT NULL,
  status       text NOT NULL,
  amount       numeric(12,2) NOT NULL,
  discount_pct integer NOT NULL,
  notes        text
);

-- Database function: order amount after the percentage discount, rounded to cents.
CREATE FUNCTION {SCHEMA}.net_amount(amount numeric, discount_pct integer) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$ SELECT round(amount * (100 - discount_pct) / 100.0, 2) $$;
"""

# Joins two tables, aggregates per customer, calls the database function, and ranks customers
# inside each country with a window function.
CUSTOM_QUERY = f"""
SELECT c.customer_id,
       c.country,
       c.segment,
       count(o.order_id)                                   AS order_count,
       sum({SCHEMA}.net_amount(o.amount, o.discount_pct))  AS net_revenue,
       rank() OVER (PARTITION BY c.country
                    ORDER BY sum({SCHEMA}.net_amount(o.amount, o.discount_pct)) DESC, c.customer_id) AS country_rank
FROM {SCHEMA}.customers c
JOIN {SCHEMA}.orders o ON o.customer_id = c.customer_id
WHERE o.status <> 'cancelled'
GROUP BY c.customer_id, c.country, c.segment
"""

CUSTOMER_COLUMNS = [
    Column("customer_id", "int"), Column("first_name", "text"), Column("last_name", "text"), Column("email", "text"),
    Column("city", "text"), Column("country", "text"), Column("segment", "text"), Column("created_date", "date"),
    Column("credit_limit", "decimal"),
]
ORDER_COLUMNS = [
    Column("order_id", "int"), Column("customer_id", "int"), Column("order_date", "date"), Column("status", "text"),
    Column("amount", "decimal"), Column("discount_pct", "int"), Column("notes", "text"),
]
REVENUE_COLUMNS = [
    Column("customer_id", "int"), Column("country", "text"), Column("segment", "text"), Column("order_count", "int"),
    Column("net_revenue", "decimal"), Column("country_rank", "int"),
]
