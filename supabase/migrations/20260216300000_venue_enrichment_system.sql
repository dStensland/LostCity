-- Venue Enrichment System: audit log + proposal review queue
-- Supports enrichment tracking, rollback snapshots, and human-in-the-loop review

-- ═══════════════════════════════════════════════════════════════
-- Table 1: venue_enrichment_log
-- Tracks every enrichment action for auditability and rollback
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE venue_enrichment_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venue_id BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  enrichment_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'skipped', 'failed')),
  source TEXT,
  fields_updated TEXT[],
  previous_values JSONB,
  error_message TEXT,
  ran_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enrichment_log_venue ON venue_enrichment_log (venue_id, created_at DESC);
CREATE INDEX idx_enrichment_log_type ON venue_enrichment_log (enrichment_type, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- Table 2: venue_enrichment_proposals
-- Queue for AI agents / crawlers to propose field changes with review
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE venue_enrichment_proposals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venue_id BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  current_value TEXT,
  proposed_value TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'agent',
  agent_id TEXT,
  confidence FLOAT,
  reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  batch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enrichment_proposals_venue ON venue_enrichment_proposals (venue_id, status);
CREATE INDEX idx_enrichment_proposals_status ON venue_enrichment_proposals (status, created_at DESC);
CREATE INDEX idx_enrichment_proposals_batch ON venue_enrichment_proposals (batch_id) WHERE batch_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- RLS: service_role full access, anon read-only on approved
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE venue_enrichment_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_enrichment_proposals ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so these policies are for anon/authenticated
CREATE POLICY "Enrichment log read for authenticated" ON venue_enrichment_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enrichment proposals read approved" ON venue_enrichment_proposals
  FOR SELECT TO anon USING (status = 'approved');

CREATE POLICY "Enrichment proposals read all for authenticated" ON venue_enrichment_proposals
  FOR SELECT TO authenticated USING (true);
