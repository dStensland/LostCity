-- Performance indexes identified by audit 2026-02-10
-- These cover the most common query patterns across all API endpoints

-- Events: portal + date composite (the #1 most common query pattern)
CREATE INDEX IF NOT EXISTS idx_events_portal_date ON events(portal_id, start_date, start_time) WHERE canonical_event_id IS NULL;

-- Events: individual filters
CREATE INDEX IF NOT EXISTS idx_events_portal_id ON events(portal_id);
CREATE INDEX IF NOT EXISTS idx_events_canonical_null ON events(canonical_event_id) WHERE canonical_event_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_is_live ON events(is_live) WHERE is_live = true;

-- Venues: common filters
CREATE INDEX IF NOT EXISTS idx_venues_neighborhood ON venues(neighborhood);
CREATE INDEX IF NOT EXISTS idx_venues_active ON venues(active);
CREATE INDEX IF NOT EXISTS idx_venues_vibes ON venues USING GIN(vibes);
CREATE INDEX IF NOT EXISTS idx_venues_venue_type ON venues(venue_type);
