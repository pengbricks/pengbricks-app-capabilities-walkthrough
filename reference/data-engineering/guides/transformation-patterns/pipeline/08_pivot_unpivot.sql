-- Pivot: one row per category, one column per order status.
CREATE OR REFRESH MATERIALIZED VIEW tp_pivot AS
SELECT *
FROM (SELECT category, status, amount * quantity AS sales FROM tp_cast_valid)
PIVOT (sum(sales) FOR status IN ('placed' AS placed, 'shipped' AS shipped, 'returned' AS returned));

-- Unpivot: turn the status columns back into rows.
CREATE OR REFRESH MATERIALIZED VIEW tp_unpivot AS
SELECT category, status, sales
FROM tp_pivot
UNPIVOT INCLUDE NULLS (sales FOR status IN (placed, shipped, returned));
