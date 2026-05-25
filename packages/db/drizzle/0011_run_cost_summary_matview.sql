CREATE MATERIALIZED VIEW IF NOT EXISTS run_cost_summary AS
SELECT
  tenant_id,
  run_id,
  SUM(kind_total) AS total_cost_micro_usd,
  jsonb_object_agg(kind, kind_total) AS by_kind,
  MAX(last_event_at) AS last_event_at
FROM (
  SELECT
    tenant_id,
    run_id,
    kind,
    SUM(total_micro_usd) AS kind_total,
    MAX(occurred_at) AS last_event_at
  FROM cost_events
  WHERE run_id IS NOT NULL
  GROUP BY tenant_id, run_id, kind
) sub
GROUP BY tenant_id, run_id;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS run_cost_summary_uniq_tenant_run
  ON run_cost_summary (tenant_id, run_id);
