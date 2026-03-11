CREATE INDEX IF NOT EXISTS idx_venue_inventory_snapshots_current_lookup
  ON venue_inventory_snapshots(
    venue_id,
    provider_id,
    inventory_scope,
    arrival_date,
    nights,
    captured_for_date DESC,
    captured_at DESC
  );

CREATE OR REPLACE VIEW current_venue_inventory_snapshots AS
SELECT DISTINCT ON (
  venue_id,
  provider_id,
  inventory_scope,
  arrival_date,
  nights
)
  id,
  venue_id,
  provider_id,
  inventory_scope,
  arrival_date,
  nights,
  captured_for_date,
  captured_at,
  window_label,
  total_results,
  source_url,
  records,
  sample_sites,
  metadata,
  created_at,
  updated_at
FROM venue_inventory_snapshots
ORDER BY
  venue_id,
  provider_id,
  inventory_scope,
  arrival_date,
  nights,
  captured_for_date DESC,
  captured_at DESC,
  created_at DESC;
