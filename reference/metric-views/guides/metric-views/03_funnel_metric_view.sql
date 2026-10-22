-- Funnel metric view: sessions and conversion rate.
--
-- Conversion rate is converted sessions divided by sessions, both summed over the group. Averaging
-- each day's rate gives a different number, because a quiet day with few sessions weighs as much as a
-- busy one. Step 4 of the job shows both numbers side by side.
--
-- Same deployment pattern as 02_orders_metric_view.sql: the job passes catalog and schema, USE sets
-- them. Safe to rerun: CREATE OR REPLACE VIEW replaces the definition.

USE CATALOG IDENTIFIER(:catalog);
USE SCHEMA IDENTIFIER(:schema);

CREATE OR REPLACE VIEW mv_funnel_metrics
WITH METRICS
LANGUAGE YAML
AS $$
version: 1.1
comment: >-
  Site sessions and how many end in a purchase. Conversion rate is a ratio of sums, so it stays
  correct at any grouping.
source: mv_sessions

joins:
  - name: customer
    source: mv_customers
    'on': source.customer_id = customer.customer_id
    rely:
      at_most_one_match: true

fields:
  - name: session_date
    expr: source.session_date
    display_name: Session Date
    synonyms: ['date', 'day']
  - name: session_month
    expr: DATE_TRUNC('MONTH', source.session_date)
    display_name: Session Month
    synonyms: ['month']
  - name: session_channel
    expr: source.channel
    display_name: Session Channel
    synonyms: ['channel', 'traffic source']
  - name: customer_segment
    expr: customer.segment
    display_name: Customer Segment
    synonyms: ['segment', 'tier']

measures:
  - name: sessions
    expr: COUNT(DISTINCT source.session_id)
    comment: Number of site sessions.
    display_name: Sessions
    synonyms: ['visits']
    format:
      type: number
      decimal_places:
        type: exact
        places: 0
  - name: converted_sessions
    expr: COUNT(DISTINCT source.session_id) FILTER (WHERE source.converted)
    comment: Sessions that ended in a purchase.
    display_name: Converted Sessions
    synonyms: ['purchases', 'conversions']
    format:
      type: number
      decimal_places:
        type: exact
        places: 0
  - name: conversion_rate
    expr: MEASURE(converted_sessions) / MEASURE(sessions)
    comment: Converted sessions divided by sessions, both summed over the group.
    display_name: Conversion Rate
    synonyms: ['conversion', 'CVR']
    format:
      type: percentage
      decimal_places:
        type: exact
        places: 2
  - name: visitors
    expr: COUNT(DISTINCT source.customer_id)
    comment: Distinct customers with a session in the group.
    display_name: Visitors
    format:
      type: number
      decimal_places:
        type: exact
        places: 0
  - name: converting_visitors
    expr: COUNT(DISTINCT source.customer_id) FILTER (WHERE source.converted)
    comment: Distinct customers with a converted session in the group.
    display_name: Converting Visitors
    format:
      type: number
      decimal_places:
        type: exact
        places: 0
  - name: visitor_conversion_rate
    expr: MEASURE(converting_visitors) / MEASURE(visitors)
    comment: Converting visitors divided by visitors. Distinct counts do not add up across groups, so this is computed per group, never summed.
    display_name: Visitor Conversion Rate
    format:
      type: percentage
      decimal_places:
        type: exact
        places: 2
$$;
