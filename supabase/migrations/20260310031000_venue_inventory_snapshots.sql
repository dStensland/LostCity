CREATE TABLE IF NOT EXISTS venue_inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  inventory_scope TEXT NOT NULL DEFAULT 'overnight' CHECK (
    inventory_scope IN ('overnight', 'day_use', 'package')
  ),
  arrival_date DATE NOT NULL,
  nights INTEGER NOT NULL CHECK (nights > 0 AND nights <= 30),
  captured_for_date DATE NOT NULL DEFAULT CURRENT_DATE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_label TEXT,
  total_results INTEGER,
  source_url TEXT,
  records JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_sites JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT venue_inventory_snapshots_total_results_check CHECK (
    total_results IS NULL OR total_results >= 0
  ),
  CONSTRAINT venue_inventory_snapshots_capture_key UNIQUE (
    venue_id,
    provider_id,
    inventory_scope,
    arrival_date,
    nights,
    captured_for_date
  )
);

CREATE INDEX IF NOT EXISTS idx_venue_inventory_snapshots_lookup
  ON venue_inventory_snapshots(venue_id, provider_id, inventory_scope, arrival_date, nights, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_inventory_snapshots_captured_for_date
  ON venue_inventory_snapshots(captured_for_date, captured_at DESC);

CREATE TRIGGER update_venue_inventory_snapshots_updated_at
  BEFORE UPDATE ON venue_inventory_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE venue_inventory_snapshots ENABLE ROW LEVEL SECURITY;
