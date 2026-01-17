-- Migration: Add fields for redesign features
-- Adds event status indicators and venue enhancements

-- ============================================
-- EVENTS TABLE ADDITIONS
-- ============================================

-- Attendee/interest count for social proof
ALTER TABLE events ADD COLUMN IF NOT EXISTS attendee_count INTEGER DEFAULT 0;

-- Live event indicator (happening now)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false;

-- Featured event (editorially selected)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Trending event (algorithmically determined)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT false;

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_events_is_featured ON events(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_events_is_trending ON events(is_trending) WHERE is_trending = true;
CREATE INDEX IF NOT EXISTS idx_events_is_live ON events(is_live) WHERE is_live = true;

-- ============================================
-- VENUES TABLE ADDITIONS
-- ============================================

-- Venue vibes/tags (e.g., 'Underground', 'Rooftop', 'Intimate')
ALTER TABLE venues ADD COLUMN IF NOT EXISTS vibes TEXT[];

-- Venue description for detail pages
ALTER TABLE venues ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================================
-- FUNCTION: Update is_live based on current time
-- ============================================

-- Function to check if an event is currently live
CREATE OR REPLACE FUNCTION update_live_events()
RETURNS void AS $$
BEGIN
  -- Mark events as live if they're happening now
  UPDATE events
  SET is_live = true
  WHERE start_date = CURRENT_DATE
    AND start_time IS NOT NULL
    AND start_time <= CURRENT_TIME
    AND (
      (end_time IS NOT NULL AND end_time >= CURRENT_TIME)
      OR (end_time IS NULL AND start_time + INTERVAL '3 hours' >= CURRENT_TIME)
    )
    AND is_live = false;

  -- Mark events as not live if they've ended
  UPDATE events
  SET is_live = false
  WHERE is_live = true
    AND (
      start_date < CURRENT_DATE
      OR (start_date = CURRENT_DATE AND end_time IS NOT NULL AND end_time < CURRENT_TIME)
      OR (start_date = CURRENT_DATE AND end_time IS NULL AND start_time + INTERVAL '3 hours' < CURRENT_TIME)
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Calculate trending score
-- ============================================

-- Simple trending calculation based on saves and recency
CREATE OR REPLACE FUNCTION calculate_trending_events()
RETURNS void AS $$
BEGIN
  -- Reset all trending flags
  UPDATE events SET is_trending = false WHERE is_trending = true;

  -- Mark top events as trending based on save count and recency
  UPDATE events
  SET is_trending = true
  WHERE id IN (
    SELECT e.id
    FROM events e
    LEFT JOIN saved_events se ON se.event_id = e.id
    WHERE e.start_date >= CURRENT_DATE
      AND e.start_date <= CURRENT_DATE + INTERVAL '7 days'
    GROUP BY e.id
    ORDER BY COUNT(se.id) DESC, e.start_date ASC
    LIMIT 20
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SAMPLE DATA: Add some vibes to existing venues
-- ============================================

-- Update a few venues with vibes for testing
UPDATE venues SET vibes = ARRAY['Live Music', 'Intimate', 'Late Night']
WHERE slug = 'the-earl' OR name ILIKE '%earl%';

UPDATE venues SET vibes = ARRAY['Rooftop', 'Views', 'Casual']
WHERE name ILIKE '%rooftop%' OR name ILIKE '%ponce city%';

UPDATE venues SET vibes = ARRAY['Comedy', 'Intimate', 'BYOB']
WHERE name ILIKE '%laughing skull%' OR name ILIKE '%comedy%';

UPDATE venues SET vibes = ARRAY['Underground', 'Electronic', 'Late Night']
WHERE name ILIKE '%basement%' OR name ILIKE '%warehouse%';

UPDATE venues SET vibes = ARRAY['Quirky', 'Divey', 'Local Favorite']
WHERE name ILIKE '%sister louisa%' OR name ILIKE '%church%bar%';
