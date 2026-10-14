-- Queueing per warehouse and hour. Replace <workspace_id>. Statements that waited for capacity
-- show waiting_at_capacity_duration_ms > 0.
SELECT date_trunc('HOUR', start_time) AS hour,
       compute.warehouse_id AS warehouse_id,
       count(*) AS statements,
       count_if(waiting_at_capacity_duration_ms > 0) AS queued,
       round(percentile(waiting_at_capacity_duration_ms, 0.95) / 1000, 1) AS p95_wait_at_capacity_s,
       round(avg(total_duration_ms) / 1000, 1) AS avg_total_s
FROM system.query.history
WHERE workspace_id = '<workspace_id>' AND start_time >= current_timestamp() - INTERVAL 7 DAYS
  AND compute.warehouse_id IS NOT NULL
GROUP BY ALL
ORDER BY hour DESC;

-- Start, stop, and scale events.
SELECT event_time, warehouse_id, event_type, cluster_count
FROM system.compute.warehouse_events
WHERE workspace_id = '<workspace_id>' AND event_time >= current_timestamp() - INTERVAL 7 DAYS
ORDER BY event_time DESC;
