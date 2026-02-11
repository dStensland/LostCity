-- Migration 190: Portal interaction tracking for launch readiness
-- Purpose:
--   1) Track attributed interaction events beyond page views
--   2) Support hospital-mode, wayfinding, and resource-click KPIs
--   3) Preserve strict portal attribution and manager-only read access

BEGIN;

CREATE TABLE IF NOT EXISTS portal_interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  action_type VARCHAR(40) NOT NULL CHECK (action_type IN ('mode_selected', 'wayfinding_opened', 'resource_clicked')),
  page_type VARCHAR(30) NOT NULL DEFAULT 'hospital' CHECK (page_type IN ('feed', 'find', 'event', 'spot', 'series', 'community', 'hospital')),
  hospital_slug VARCHAR(120),
  mode_context VARCHAR(20) CHECK (mode_context IN ('urgent', 'treatment', 'visitor', 'staff')),
  section_key VARCHAR(40),
  target_kind VARCHAR(40),
  target_id VARCHAR(120),
  target_label VARCHAR(180),
  target_url VARCHAR(700),
  referrer VARCHAR(500),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  user_agent VARCHAR(500),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_interaction_events_portal_time
  ON portal_interaction_events (portal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_interaction_events_portal_action_time
  ON portal_interaction_events (portal_id, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_interaction_events_mode
  ON portal_interaction_events (portal_id, mode_context, created_at DESC)
  WHERE mode_context IS NOT NULL;

ALTER TABLE portal_interaction_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_interaction_events_select ON portal_interaction_events;
CREATE POLICY portal_interaction_events_select
  ON portal_interaction_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM portal_members pm
      WHERE pm.portal_id = portal_interaction_events.portal_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'editor')
    )
  );

COMMENT ON TABLE portal_interaction_events IS
'Attributed interaction analytics events (mode selection, wayfinding opens, resource clicks).';

COMMIT;
