-- ============================================
-- MIGRATION 110: Clean up stale theatre events
-- ============================================
-- Remove Landmark events with NULL start_time (stale Jan 20 crawl data)
-- Remove Landmark junk entries (trailer links, section headers)
-- Remove Plaza special events with NULL start_time (will re-crawl when times posted)

-- Delete Landmark events with NULL start_time that aren't all-day events
-- These are from an older crawler version that didn't parse times
DELETE FROM events
WHERE source_id = (SELECT id FROM sources WHERE slug = 'landmark-midtown')
  AND start_time IS NULL
  AND is_all_day = false;

-- Delete Landmark junk entries that slipped through as movie titles
DELETE FROM events
WHERE source_id = (SELECT id FROM sources WHERE slug = 'landmark-midtown')
  AND (
    title ILIKE 'See trailer%'
    OR title ILIKE 'A FILM BY%'
    OR title ILIKE 'Late Shows%'
    OR title ILIKE 'Two Shows Only%'
    OR title ILIKE '%Film Series%'
    OR title ILIKE 'Trailer%'
  );

-- Remove Plaza special events that have no start_time
-- They'll be re-crawled when actual showtimes are posted
DELETE FROM events
WHERE source_id = (SELECT id FROM sources WHERE slug = 'plaza-theatre')
  AND start_time IS NULL;
