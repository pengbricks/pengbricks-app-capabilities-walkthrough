-- Date and time: parse three input formats, extract parts, compute differences,
-- and convert a UTC timestamp to local time zones (daylight saving aware).
CREATE OR REFRESH MATERIALIZED VIEW tp_date_time AS
WITH parsed AS (
  SELECT
    order_id,
    order_ts_utc,
    ship_date_raw,
    coalesce(
      try_to_date(ship_date_raw, 'yyyy-MM-dd'),
      try_to_date(ship_date_raw, 'MM/dd/yyyy'),
      try_to_date(ship_date_raw, 'dd.MM.yyyy')
    ) AS ship_date
  FROM orders
)
SELECT
  order_id,
  order_ts_utc,
  ship_date_raw,
  ship_date,
  year(ship_date)                                          AS ship_year,
  date_format(ship_date, 'EEEE')                           AS ship_weekday,
  datediff(ship_date, CAST(order_ts_utc AS DATE))          AS days_to_ship,
  from_utc_timestamp(order_ts_utc, 'America/New_York')     AS order_ts_eastern,
  from_utc_timestamp(order_ts_utc, 'America/Los_Angeles')  AS order_ts_pacific,
  date_format(from_utc_timestamp(order_ts_utc, 'Asia/Tokyo'), 'yyyy-MM-dd HH:mm') AS order_ts_tokyo
FROM parsed;
