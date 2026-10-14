-- Spend queries over system.billing.usage x system.billing.list_prices. Replace <workspace_id>.
-- The job creates these as the view cost_usage_enriched; every query below reads from that view.

-- By product and SKU
SELECT product, sku_name, round(sum(usage_quantity), 2) AS quantity, usage_unit, round(sum(cost_usd), 2) AS cost_usd
FROM cost_usage_enriched WHERE usage_date >= date_sub(current_date(), 30)
GROUP BY ALL ORDER BY cost_usd DESC;

-- By custom tag (jobs carry capability_guide_job and capability_guide_use_case)
SELECT coalesce(guide_job, '(untagged)') AS guide_job, coalesce(use_case, '(untagged)') AS use_case, round(sum(cost_usd), 2) AS cost_usd
FROM cost_usage_enriched WHERE usage_date >= date_sub(current_date(), 30)
GROUP BY ALL ORDER BY cost_usd DESC;

-- By user, by job, by pipeline
SELECT usage_user, round(sum(cost_usd), 2) AS cost_usd FROM cost_usage_enriched
WHERE usage_date >= date_sub(current_date(), 30) GROUP BY ALL ORDER BY cost_usd DESC;

SELECT job_id, max(job_name) AS job_name, count(DISTINCT job_run_id) AS runs, round(sum(cost_usd), 2) AS cost_usd
FROM cost_usage_enriched WHERE usage_date >= date_sub(current_date(), 30) AND job_id IS NOT NULL
GROUP BY job_id ORDER BY cost_usd DESC;

SELECT pipeline_id, round(sum(cost_usd), 2) AS cost_usd FROM cost_usage_enriched
WHERE usage_date >= date_sub(current_date(), 30) AND pipeline_id IS NOT NULL GROUP BY pipeline_id ORDER BY cost_usd DESC;

-- Budget alert query (resources/budget.alert.yml)
SELECT coalesce(sum(cost_usd), 0) AS spend_7d_usd FROM cost_usage_enriched
WHERE usage_date >= date_sub(current_date(), 7);

-- Optimization: jobs with the highest cost per run
SELECT job_id, max(job_name) AS job_name, count(DISTINCT job_run_id) AS runs,
       round(sum(cost_usd) / nullif(count(DISTINCT job_run_id), 0), 3) AS usd_per_run
FROM cost_usage_enriched WHERE usage_date >= date_sub(current_date(), 30) AND job_id IS NOT NULL
GROUP BY job_id ORDER BY usd_per_run DESC LIMIT 20;

-- Optimization: warehouses by statements and spend
SELECT s.warehouse_id, round(s.cost_usd, 2) AS cost_usd, q.statements
FROM (SELECT warehouse_id, sum(cost_usd) AS cost_usd FROM cost_usage_enriched
      WHERE usage_date >= date_sub(current_date(), 30) AND warehouse_id IS NOT NULL GROUP BY warehouse_id) s
LEFT JOIN (SELECT compute.warehouse_id AS warehouse_id, count(*) AS statements FROM system.query.history
           WHERE workspace_id = '<workspace_id>' AND start_time >= current_timestamp() - INTERVAL 30 DAYS GROUP BY 1) q
  ON s.warehouse_id = q.warehouse_id
ORDER BY s.cost_usd DESC;
