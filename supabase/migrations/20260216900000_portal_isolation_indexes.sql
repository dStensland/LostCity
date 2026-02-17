-- ============================================
-- MIGRATION: Portal Isolation Performance Indexes
-- ============================================
-- Adds indexes to support portal-scoped queries and city filtering.
-- Identified during Phase Q scale guardrails audit.

-- Index on venues.city for portal-scoped city filtering.
-- Used by: feed, tonight, timeline, trending, explore, spots, venue search routes.
CREATE INDEX IF NOT EXISTS idx_venues_city ON venues(city);

-- Composite index for portal-scoped event queries that also filter by is_active.
-- Covers the most common portal feed pattern: portal_id + start_date + is_active.
CREATE INDEX IF NOT EXISTS idx_events_portal_active_date
ON events(portal_id, is_active, start_date)
WHERE is_active = true;

-- Index for event_rsvps lookups by event + status (social proof counts).
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_status
ON event_rsvps(event_id, status);

-- Index for event_rsvps lookups by user + status (calendar, crew-this-week).
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_status
ON event_rsvps(user_id, status);

-- Comments
COMMENT ON INDEX idx_venues_city IS 'Supports portal-scoped city filtering across all venue queries';
COMMENT ON INDEX idx_events_portal_active_date IS 'Optimizes portal feed queries: portal_id + is_active + date range';
COMMENT ON INDEX idx_event_rsvps_event_status IS 'Optimizes social proof count queries per event';
COMMENT ON INDEX idx_event_rsvps_user_status IS 'Optimizes user calendar and crew activity lookups';
