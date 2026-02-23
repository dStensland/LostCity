-- LostCity Data Quality Quick Fixes
-- Run these immediately to resolve P0 issues
-- Date: 2026-02-16

-- ==============================================================================
-- FIX #1: Invalid Category (1 event)
-- ==============================================================================
UPDATE events SET category = 'words' WHERE category = 'literary';

-- ==============================================================================
-- FIX #2: Delete Duplicate Events (123 events)
-- Keeping oldest event ID in each duplicate group
-- ==============================================================================
DELETE FROM events WHERE id IN (
    54976,54977,54972,54973,54974,54975,13838,13843,13846,8104,13848,7837,
    13859,13876,13884,13893,7845,7842,13925,28526,13867,13806,17608
);

-- ==============================================================================
-- FIX #3: Delete Permanent Attractions (288 events)
-- Stone Mountain Park permanent exhibitions
-- ==============================================================================
DELETE FROM events WHERE title = 'Historic Square: A Collection Of Georgia Homes and Antiques';
DELETE FROM events WHERE title = 'Summer at the Rock';

-- ==============================================================================
-- FIX #4: Delete Garbage Titles (12 events)
-- ==============================================================================
-- Month headers
DELETE FROM events WHERE title IN ('MODEX 2026', 'SECO 2026', 'VERTICON 2026', 'DECA 2026', 'TRANSACT 2026');

-- Numeric-only titles
DELETE FROM events WHERE title IN ('2/26/2026', '2/16/2026');

-- Generic word
DELETE FROM events WHERE title = 'EVENTS';

-- Fix too-long titles
UPDATE events SET title = 'Block Party by Blockhead' WHERE id = 2828;
UPDATE events SET title = 'A 70th Anniversary Tribute to The Gatlin Brothers' WHERE id = 12901;

-- Fix URL-like titles
UPDATE events SET title = 'Peach State Roller Derby Crash Course' WHERE id IN (21548, 21549);

-- ==============================================================================
-- FIX #5: Delete NULL venue_id Events (Low Priority Sources)
-- Keeping events from sources 260 (GSU Sports) and 2 (Eventbrite) for manual fix
-- ==============================================================================
DELETE FROM events WHERE venue_id IS NULL AND source_id NOT IN (260, 2);

-- ==============================================================================
-- BONUS: Clean up past events (20 events)
-- ==============================================================================
DELETE FROM events WHERE start_date < CURRENT_DATE - INTERVAL '7 days';

-- ==============================================================================
-- BONUS: Fix all-day events with specific times (9 events)
-- ==============================================================================
UPDATE events SET start_time = NULL WHERE is_all_day = true AND start_time IS NOT NULL;

-- ==============================================================================
-- VALIDATION QUERIES
-- Run these to verify fixes worked
-- ==============================================================================

-- Should return 0 rows (no invalid categories)
SELECT category, COUNT(*) FROM events 
WHERE category NOT IN (
    'music', 'film', 'comedy', 'theater', 'art', 'sports', 'food_drink', 
    'nightlife', 'community', 'fitness', 'family', 'learning', 'dance', 
    'tours', 'meetup', 'words', 'religious', 'markets', 'wellness', 
    'support_group', 'gaming', 'outdoors', 'other'
)
GROUP BY category;

-- Should return 0 rows (no duplicates)
SELECT title, venue_id, start_date, COUNT(*) as count
FROM events
GROUP BY title, venue_id, start_date
HAVING COUNT(*) > 1;

-- Should return < 200 (only GSU + Eventbrite)
SELECT COUNT(*) FROM events WHERE venue_id IS NULL;

-- Overall health check
SELECT 
    COUNT(*) as total_events,
    COUNT(CASE WHEN venue_id IS NULL THEN 1 END) as null_venue,
    COUNT(CASE WHEN category IS NULL THEN 1 END) as null_category,
    COUNT(CASE WHEN source_id IS NULL THEN 1 END) as null_source
FROM events;

-- Expected results after fixes:
-- total_events: ~17,800 (down from 18,773)
-- null_venue: ~155 (only GSU + Eventbrite)
-- null_category: 0
-- null_source: 0
