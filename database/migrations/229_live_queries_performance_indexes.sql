-- Migration 229: Indexes for live/trending/specials query paths.

-- Trending + social proof fanout.
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_created_at
ON event_rsvps(event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_status
ON event_rsvps(event_id, status);

-- Happening-now event scan (today + time + canonical + non all-day).
CREATE INDEX IF NOT EXISTS idx_events_happening_now_window
ON events(start_date, start_time)
WHERE canonical_event_id IS NULL
  AND is_all_day = false;

-- Specials API: load by active specials near nearby venues.
CREATE INDEX IF NOT EXISTS idx_venue_specials_active_venue
ON venue_specials(venue_id, start_date, end_date)
WHERE is_active = true;

-- Specials API: bounding-box venue scan by coordinates.
CREATE INDEX IF NOT EXISTS idx_venues_active_lat_lng
ON venues(lat, lng)
WHERE COALESCE(active, true) = true
  AND lat IS NOT NULL
  AND lng IS NOT NULL;
