-- Data Quality Fixes - 2026-02-16
-- Run these queries to clean up identified data quality issues

-- ============================================================
-- IMMEDIATE FIXES (Run Now)
-- ============================================================

-- 1. Delete garbage event: "Calendar" at Sandy Springs PAC
DELETE FROM events WHERE id = 51396;
-- Expected: 1 row deleted

-- 2. Fix invalid category: outdoor → outdoors (with 's')
UPDATE events SET category = 'outdoors' WHERE category = 'outdoor';
-- Expected: ~314 rows updated

-- 3. Fix invalid category: museums → art
UPDATE events SET category = 'art' WHERE category = 'museums';
-- Expected: ~17 rows updated

-- 4. Fix invalid category: shopping → community
UPDATE events SET category = 'community' WHERE category = 'shopping';
-- Expected: ~2 rows updated

-- 5. Delete events older than 30 days (no user value)
DELETE FROM events 
WHERE start_date < CURRENT_DATE - INTERVAL '30 days';
-- Expected: ~40-50 rows deleted (keeps recent past events for context)

-- ============================================================
-- VERIFICATION QUERIES (Run After Fixes)
-- ============================================================

-- Verify no invalid categories remain
SELECT category, COUNT(*) as count
FROM events
WHERE category NOT IN (
    'music', 'film', 'comedy', 'theater', 'art', 'sports', 'food_drink', 
    'nightlife', 'community', 'fitness', 'family', 'learning', 'dance', 
    'tours', 'meetup', 'words', 'religious', 'markets', 'wellness', 
    'support_group', 'gaming', 'outdoors', 'other'
)
GROUP BY category
ORDER BY count DESC;
-- Expected: 0 rows

-- Verify no garbage titles remain
SELECT id, title, start_date 
FROM events
WHERE 
    title IN ('Events', 'Calendar', 'Add To Calendar', 'View Details', 'Schedule', 'Event', 'Show')
    OR LENGTH(title) < 3
    OR title ~ '^[0-9]+$'
ORDER BY created_at DESC
LIMIT 10;
-- Expected: 0 rows (except the 3 MODEX/SECO/VERTICON which are legitimate)

-- Count remaining past events (should only be < 30 days old)
SELECT 
    COUNT(*) as total_past_events,
    MIN(start_date) as oldest_event,
    MAX(start_date) as newest_past_event
FROM events
WHERE start_date < CURRENT_DATE;
-- Expected: ~25-30 events, oldest should be < 30 days ago

-- ============================================================
-- OPTIONAL: Duplicate Event Analysis
-- ============================================================

-- Find duplicate events (same title + venue + date)
-- DO NOT RUN DELETE - manual review recommended first
SELECT 
    title,
    venue_id,
    start_date,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id ORDER BY created_at) as event_ids,
    ARRAY_AGG(created_at ORDER BY created_at) as created_dates
FROM events
GROUP BY title, venue_id, start_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, title
LIMIT 50;

-- To delete duplicates (keep oldest, delete newer):
-- WARNING: Review output above first!
-- WITH duplicates AS (
--     SELECT 
--         id,
--         ROW_NUMBER() OVER (
--             PARTITION BY title, venue_id, start_date 
--             ORDER BY created_at ASC
--         ) as rn
--     FROM events
-- )
-- DELETE FROM events 
-- WHERE id IN (
--     SELECT id FROM duplicates WHERE rn > 1
-- );
-- Expected: ~127 rows deleted (keeps 81 originals, deletes 127 dupes)

-- ============================================================
-- STONE MOUNTAIN CLEANUP (Optional - Requires Discussion)
-- ============================================================

-- Stone Mountain "Summit Skyride" are not real events - they're daily operations
-- These should either be deleted OR moved to venue metadata as an amenity
-- Recommend deletion since it's a permanent attraction, not a programmed event

-- Preview what would be deleted:
SELECT COUNT(*) 
FROM events 
WHERE venue_id = (SELECT id FROM venues WHERE slug = 'stone-mountain-park')
AND title = 'Summit Skyride';
-- Expected: ~307 events

-- TO DELETE (uncomment after approval):
-- DELETE FROM events 
-- WHERE venue_id = (SELECT id FROM venues WHERE slug = 'stone-mountain-park')
-- AND title = 'Summit Skyride';

-- ============================================================
-- POST-CLEANUP STATISTICS
-- ============================================================

-- Overall event count by category
SELECT category, COUNT(*) as event_count
FROM events
WHERE start_date >= CURRENT_DATE
GROUP BY category
ORDER BY event_count DESC;

-- Event count by source (top 20)
SELECT 
    s.name,
    s.slug,
    COUNT(*) as event_count
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE e.start_date >= CURRENT_DATE
GROUP BY s.name, s.slug
ORDER BY event_count DESC
LIMIT 20;

-- Total stats
SELECT 
    COUNT(*) as total_events,
    COUNT(DISTINCT venue_id) as unique_venues,
    COUNT(DISTINCT source_id) as active_sources,
    MIN(start_date) as earliest_event,
    MAX(start_date) as latest_event
FROM events
WHERE start_date >= CURRENT_DATE;
