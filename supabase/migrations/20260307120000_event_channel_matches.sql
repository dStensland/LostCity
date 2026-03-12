-- Event Channel Matches
-- Precomputed portal-scoped event/channel matches for feed personalization.

CREATE TABLE IF NOT EXISTS event_channel_matches (
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES interest_channels(id) ON DELETE CASCADE,
  matched_rule_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  match_reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (portal_id, event_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_event_channel_matches_portal_channel_time
  ON event_channel_matches(portal_id, channel_id, matched_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_channel_matches_portal_event
  ON event_channel_matches(portal_id, event_id);

CREATE INDEX IF NOT EXISTS idx_event_channel_matches_channel_event
  ON event_channel_matches(channel_id, event_id);

ALTER TABLE event_channel_matches ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE event_channel_matches IS 'Portal-scoped precomputed matches between events and interest channels.';
COMMENT ON COLUMN event_channel_matches.matched_rule_types IS 'Ordered list of rule types that matched event to channel.';
COMMENT ON COLUMN event_channel_matches.match_reasons IS 'Structured match metadata used for explainability/debugging.';
