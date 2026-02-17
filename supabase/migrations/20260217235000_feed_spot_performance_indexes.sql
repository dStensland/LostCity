-- ============================================
-- MIGRATION: Feed + Spot Performance Indexes
-- ============================================
-- Goal: improve cold-load latency for portal feed and venue detail APIs.

-- Portal feed section lookup:
-- WHERE portal_id = ? AND is_visible = true ORDER BY display_order
CREATE INDEX IF NOT EXISTS idx_portal_sections_visible_order
ON portal_sections(portal_id, display_order)
WHERE is_visible = true;

-- Nested section item hydration:
-- portal_section_items loaded by section_id and sorted by display_order.
CREATE INDEX IF NOT EXISTS idx_portal_section_items_section_order
ON portal_section_items(section_id, display_order, entity_type, entity_id);

-- Feed event pool scans:
-- start_date window + canonical-only + non-class + non-sensitive.
CREATE INDEX IF NOT EXISTS idx_events_feed_visible_start
ON events(start_date, start_time)
WHERE canonical_event_id IS NULL
  AND COALESCE(is_class, false) = false
  AND COALESCE(is_sensitive, false) = false;

-- Supports ongoing-event branch in upcoming filters (end_date >= today).
CREATE INDEX IF NOT EXISTS idx_events_feed_visible_end
ON events(end_date)
WHERE canonical_event_id IS NULL
  AND end_date IS NOT NULL
  AND COALESCE(is_class, false) = false
  AND COALESCE(is_sensitive, false) = false;

-- Venue detail upcoming events:
-- WHERE venue_id = ? AND canonical_event_id IS NULL
--   AND (start_date >= ? OR end_date >= ?)
-- ORDER BY start_date, start_time
CREATE INDEX IF NOT EXISTS idx_events_venue_upcoming_window
ON events(venue_id, start_date, start_time, end_date)
WHERE canonical_event_id IS NULL;

-- Venue show lineup hydration:
-- event_artists queried by event_id and sorted by billing/headliner/name.
CREATE INDEX IF NOT EXISTS idx_event_artists_event_billing
ON event_artists(event_id, billing_order, is_headliner, name);

-- Nearby destinations for venue detail:
-- WHERE neighborhood = ? AND venue_type IN (...) AND active = true
CREATE INDEX IF NOT EXISTS idx_venues_neighborhood_type_active
ON venues(neighborhood, venue_type)
WHERE active = true;

COMMENT ON INDEX idx_portal_sections_visible_order IS
  'Speeds portal feed section reads by portal and display order for visible sections';
COMMENT ON INDEX idx_portal_section_items_section_order IS
  'Speeds nested portal section item expansion ordered by display_order';
COMMENT ON INDEX idx_events_feed_visible_start IS
  'Speeds feed event pool date-window scans for canonical non-class non-sensitive events';
COMMENT ON INDEX idx_events_feed_visible_end IS
  'Speeds ongoing-event lookups that filter by end_date in feed and spot APIs';
COMMENT ON INDEX idx_events_venue_upcoming_window IS
  'Speeds venue upcoming event queries with date ordering and ongoing-event checks';
COMMENT ON INDEX idx_event_artists_event_billing IS
  'Speeds event artist lineup reads ordered by billing/headliner/name';
COMMENT ON INDEX idx_venues_neighborhood_type_active IS
  'Speeds nearby destination queries by neighborhood and venue type for active venues';
