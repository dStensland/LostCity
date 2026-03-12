-- Improve get_spot_event_counts by supporting its portal/date/venue scan pattern.

CREATE INDEX IF NOT EXISTS idx_events_spot_counts_portal_start_venue
ON events(portal_id, start_date, venue_id)
WHERE venue_id IS NOT NULL
  AND is_active = true
  AND canonical_event_id IS NULL
  AND COALESCE(is_sensitive, false) = false
  AND (is_feed_ready IS NULL OR is_feed_ready = true);

CREATE INDEX IF NOT EXISTS idx_venues_city_id_for_spots
ON venues(city, id);
