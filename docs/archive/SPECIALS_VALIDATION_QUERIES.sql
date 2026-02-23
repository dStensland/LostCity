-- SPECIALS & HAPPY HOUR DATA VALIDATION QUERIES
-- Run these to verify the current state and test fixes
-- Date: 2026-02-14

-- ============================================================================
-- 1. VENUE_SPECIALS TABLE STATUS
-- ============================================================================

-- Total records and distribution by type
SELECT 
  type,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as pct
FROM venue_specials
WHERE is_active = true
GROUP BY type
ORDER BY count DESC;

-- Specials with missing price information
SELECT COUNT(*) as missing_price_note
FROM venue_specials
WHERE is_active = true AND price_note IS NULL;

-- Specials without last_verified_at (stale data risk)
SELECT COUNT(*) as unverified
FROM venue_specials
WHERE is_active = true AND last_verified_at IS NULL;

-- Active specials by day of week
SELECT 
  unnest(days_of_week) as day,
  COUNT(*) as specials_count
FROM venue_specials
WHERE is_active = true AND days_of_week IS NOT NULL
GROUP BY day
ORDER BY day;

-- ============================================================================
-- 2. EVENTS WITH SPECIALS KEYWORDS
-- ============================================================================

-- Events that should have 'specials' genre but don't
SELECT 
  id,
  title,
  category,
  genres,
  start_date
FROM events
WHERE (
    title ILIKE '%happy hour%' OR 
    title ILIKE '%drink special%' OR
    title ILIKE '%taco tuesday%' OR
    title ILIKE '%wing night%' OR
    title ILIKE '%ladies night%' OR
    title ILIKE '%industry night%' OR
    title ILIKE '%trivia%' OR
    title ILIKE '%brunch%'
  )
  AND category = 'nightlife'
  AND NOT ('specials' = ANY(genres))
ORDER BY start_date DESC
LIMIT 20;

-- Events already tagged with specials genre
SELECT 
  id,
  title,
  category,
  genres,
  start_date
FROM events
WHERE 'specials' = ANY(genres)
ORDER BY start_date DESC
LIMIT 10;

-- ============================================================================
-- 3. NIGHTLIFE EVENTS BY GENRE
-- ============================================================================

-- Nightlife genre distribution
SELECT 
  unnest(genres) as genre,
  COUNT(*) as count
FROM events
WHERE category = 'nightlife'
  AND genres IS NOT NULL
  AND array_length(genres, 1) > 0
GROUP BY genre
ORDER BY count DESC;

-- Missing subcategories (expected but zero events)
WITH expected_genres AS (
  SELECT unnest(ARRAY[
    'specials', 'bingo', 'pub-crawl', 'latin-night', 
    'line-dancing', 'bar-games'
  ]) as genre
)
SELECT 
  eg.genre,
  COALESCE(COUNT(e.id), 0) as event_count
FROM expected_genres eg
LEFT JOIN events e ON e.category = 'nightlife' AND eg.genre = ANY(e.genres)
GROUP BY eg.genre
HAVING COALESCE(COUNT(e.id), 0) = 0;

-- ============================================================================
-- 4. VENUE COVERAGE ANALYSIS
-- ============================================================================

-- Bars and restaurants without specials data
SELECT 
  v.venue_type,
  COUNT(DISTINCT v.id) as total_venues,
  COUNT(DISTINCT vs.venue_id) as venues_with_specials,
  ROUND(COUNT(DISTINCT vs.venue_id) * 100.0 / COUNT(DISTINCT v.id), 1) as coverage_pct
FROM venues v
LEFT JOIN venue_specials vs ON v.id = vs.venue_id AND vs.is_active = true
WHERE v.venue_type IN ('bar', 'restaurant', 'nightclub', 'brewery')
  AND v.active = true
GROUP BY v.venue_type
ORDER BY total_venues DESC;

-- Bars with websites but no specials data (good scrape targets)
SELECT 
  id,
  name,
  neighborhood,
  website
FROM venues
WHERE venue_type = 'bar'
  AND active = true
  AND website IS NOT NULL
  AND website != ''
  AND id NOT IN (SELECT DISTINCT venue_id FROM venue_specials WHERE is_active = true)
ORDER BY neighborhood, name
LIMIT 50;

-- ============================================================================
-- 5. SERIES THAT COULD BECOME VENUE_SPECIALS
-- ============================================================================

-- Series with specials-related keywords
SELECT 
  id,
  name,
  recurrence_rule,
  COUNT(*) FILTER (WHERE start_date >= CURRENT_DATE) as future_events
FROM series
WHERE (
    name ILIKE '%happy hour%' OR
    name ILIKE '%trivia%' OR
    name ILIKE '%karaoke%' OR
    name ILIKE '%bingo%' OR
    name ILIKE '%game night%' OR
    name ILIKE '%poker%' OR
    name ILIKE '%special%'
  )
GROUP BY id, name, recurrence_rule
HAVING COUNT(*) FILTER (WHERE start_date >= CURRENT_DATE) > 0
ORDER BY future_events DESC
LIMIT 20;

-- ============================================================================
-- 6. DATA QUALITY FIXES
-- ============================================================================

-- FIX 1: Backfill 'specials' genre on existing events
-- UNCOMMENT TO RUN (test first with SELECT to preview)
/*
UPDATE events
SET genres = CASE 
  WHEN genres IS NULL THEN ARRAY['specials']
  ELSE array_append(genres, 'specials')
END
WHERE (
    title ILIKE '%happy hour%' OR 
    title ILIKE '%drink special%' OR
    title ILIKE '%taco tuesday%' OR
    title ILIKE '%wing night%' OR
    title ILIKE '%oyster night%' OR
    title ILIKE '%burger night%' OR
    title ILIKE '%ladies night%' OR
    title ILIKE '%industry night%'
  )
  AND category = 'nightlife'
  AND (genres IS NULL OR NOT ('specials' = ANY(genres)))
RETURNING id, title, genres;
*/

-- FIX 2: Mark stale venue_specials (last verified > 90 days ago)
-- UNCOMMENT TO RUN
/*
UPDATE venue_specials
SET confidence = 'low'
WHERE last_verified_at < (CURRENT_DATE - INTERVAL '90 days')
  AND confidence != 'low'
RETURNING id, title, last_verified_at, confidence;
*/

-- ============================================================================
-- 7. REPORTING QUERIES
-- ============================================================================

-- Comprehensive specials coverage report
SELECT 
  'venue_specials records' as metric,
  COUNT(*)::text as value
FROM venue_specials WHERE is_active = true
UNION ALL
SELECT 
  'events with specials keywords',
  COUNT(*)::text
FROM events 
WHERE (title ILIKE '%happy hour%' OR title ILIKE '%special%' OR title ILIKE '%trivia%')
UNION ALL
SELECT 
  'events with specials genre',
  COUNT(*)::text
FROM events 
WHERE 'specials' = ANY(genres)
UNION ALL
SELECT 
  'bars total',
  COUNT(*)::text
FROM venues 
WHERE venue_type = 'bar' AND active = true
UNION ALL
SELECT 
  'bars with specials',
  COUNT(DISTINCT venue_id)::text
FROM venue_specials vs
JOIN venues v ON vs.venue_id = v.id
WHERE vs.is_active = true AND v.venue_type = 'bar'
UNION ALL
SELECT 
  'restaurants with specials',
  COUNT(DISTINCT venue_id)::text
FROM venue_specials vs
JOIN venues v ON vs.venue_id = v.id
WHERE vs.is_active = true AND v.venue_type = 'restaurant';

-- Active specials by neighborhood (top 10)
SELECT 
  v.neighborhood,
  COUNT(DISTINCT vs.id) as specials_count,
  COUNT(DISTINCT vs.venue_id) as venue_count
FROM venue_specials vs
JOIN venues v ON vs.venue_id = v.id
WHERE vs.is_active = true
  AND v.neighborhood IS NOT NULL
GROUP BY v.neighborhood
ORDER BY specials_count DESC
LIMIT 10;

-- Hourly distribution of happy hours
SELECT 
  EXTRACT(HOUR FROM time_start) as start_hour,
  COUNT(*) as count
FROM venue_specials
WHERE type = 'happy_hour'
  AND time_start IS NOT NULL
  AND is_active = true
GROUP BY start_hour
ORDER BY start_hour;
