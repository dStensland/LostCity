-- Migration: Data Quality Backfill
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- ==========================================================================
-- Data Quality Backfill — 2026-03-23 audit findings
-- ==========================================================================

-- 1. Fix end_date < start_date (set end_date = start_date)
UPDATE events
SET end_date = start_date, updated_at = NOW()
WHERE end_date IS NOT NULL
  AND end_date < start_date
  AND is_active = true;

-- 2. Deactivate stale non-recurring events older than 7 days
--    Exclude multi-day events whose end_date is still in the future
UPDATE events
SET is_active = false, updated_at = NOW()
WHERE start_date < CURRENT_DATE - INTERVAL '7 days'
  AND is_active = true
  AND (is_recurring IS NULL OR is_recurring = false)
  AND series_id IS NULL
  AND (end_date IS NULL OR end_date < CURRENT_DATE);

-- 3. Deactivate cross-source duplicates
--    Keep venue-crawler copy, deactivate Ticketmaster/Eventbrite copy.
--    Only match titles >10 chars to avoid false matches on generic short titles.
--    Use explicit source priority (not ID ordering).
WITH dupes AS (
  SELECT DISTINCT ON (
    CASE WHEN s1.source_type = 'venue' THEN e2.id ELSE e1.id END
  )
    CASE WHEN s1.source_type = 'venue' THEN e1.id ELSE e2.id END as keep_id,
    CASE WHEN s1.source_type = 'venue' THEN e2.id ELSE e1.id END as dupe_id
  FROM events e1
  JOIN events e2 ON lower(e1.title) = lower(e2.title)
    AND e1.venue_id = e2.venue_id
    AND e1.start_date = e2.start_date
    AND COALESCE(e1.start_time, '00:00') = COALESCE(e2.start_time, '00:00')
    AND e1.id != e2.id
    AND e1.is_active AND e2.is_active
    AND e1.source_id != e2.source_id
    AND LENGTH(e1.title) > 10
  JOIN sources s1 ON e1.source_id = s1.id
  JOIN sources s2 ON e2.source_id = s2.id
  WHERE (s1.source_type = 'venue' AND s2.slug IN ('ticketmaster', 'ticketmaster-nashville', 'eventbrite', 'eventbrite-nashville'))
     OR (s2.source_type = 'venue' AND s1.slug IN ('ticketmaster', 'ticketmaster-nashville', 'eventbrite', 'eventbrite-nashville'))
)
UPDATE events
SET is_active = false, canonical_event_id = dupes.keep_id, updated_at = NOW()
FROM dupes
WHERE events.id = dupes.dupe_id;

-- 4. Fix Ticketmaster theater miscategorization → music
UPDATE events
SET category_id = 'music', updated_at = NOW()
WHERE source_id IN (SELECT id FROM sources WHERE slug LIKE 'ticketmaster%')
  AND category_id = 'theater'
  AND is_active = true
  AND (
    title ~* '\m(concert|symphony|orchestra|philharmonic|live music|country|bluegrass|jazz|rock|hip.hop|rap|r&b|reggae|edm|dj)\M'
    OR venue_id IN (SELECT id FROM venues WHERE venue_type IN ('music_venue', 'arena', 'amphitheater'))
  );

-- 5. Fix Ticketmaster theater miscategorization → comedy
UPDATE events
SET category_id = 'comedy', updated_at = NOW()
WHERE source_id IN (SELECT id FROM sources WHERE slug LIKE 'ticketmaster%')
  AND category_id = 'theater'
  AND is_active = true
  AND title ~* '\m(comedy|comedian|stand.up|standup|improv|funny|laugh)\M';

-- 6. Fix is_free for price_min=0 events
UPDATE events
SET is_free = true, updated_at = NOW()
WHERE price_min = 0
  AND (price_max IS NULL OR price_max = 0)
  AND is_free = false
  AND is_active = true;
