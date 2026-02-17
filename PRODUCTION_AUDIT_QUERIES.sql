-- LOSTCITY PRODUCTION AUDIT - DIAGNOSTIC QUERIES
-- Generated: 2026-02-16
-- Health Score: 90.4/100
-- Use these queries to identify and fix specific data quality issues

-- ============================================================================
-- CRITICAL: Venues Missing Coordinates (343 venues)
-- ============================================================================
-- These venues have future events but can't appear on maps

SELECT DISTINCT
    v.id,
    v.name,
    v.slug,
    v.address,
    v.city,
    v.state,
    v.venue_type,
    COUNT(DISTINCT e.id) as future_event_count
FROM venues v
INNER JOIN events e ON e.venue_id = v.id
WHERE (v.lat IS NULL OR v.lng IS NULL)
  AND e.start_date >= CURRENT_DATE
GROUP BY v.id, v.name, v.slug, v.address, v.city, v.state, v.venue_type
ORDER BY future_event_count DESC, v.name
LIMIT 50;

-- ACTION: Run venue_enrich.py with these venue IDs
-- python3 venue_enrich.py --venue-ids 4005,4006,4009,4016,4007...


-- ============================================================================
-- CRITICAL: Invalid Venue Types (33 venues)
-- ============================================================================
-- These venues have types not in the valid taxonomy

SELECT DISTINCT
    v.id,
    v.name,
    v.venue_type,
    v.city,
    COUNT(DISTINCT e.id) as future_event_count
FROM venues v
INNER JOIN events e ON e.venue_id = v.id
WHERE v.venue_type NOT IN (
    'bar', 'restaurant', 'music_venue', 'nightclub', 'comedy_club', 'gallery', 
    'museum', 'brewery', 'coffee_shop', 'bookstore', 'library', 'arena', 'cinema', 
    'park', 'garden', 'food_hall', 'farmers_market', 'convention_center', 'venue', 
    'organization', 'festival', 'church', 'event_space', 'sports_bar', 'distillery', 
    'winery', 'hotel', 'rooftop', 'coworking', 'record_store', 'studio', 
    'fitness_center', 'community_center', 'college', 'university', 'theater', 
    'stadium', 'auditorium', 'performing_arts_center'
)
  AND e.start_date >= CURRENT_DATE
GROUP BY v.id, v.name, v.venue_type, v.city
ORDER BY future_event_count DESC;

-- ACTION: Update venue types manually or add to valid taxonomy
-- UPDATE venues SET venue_type = 'event_space' WHERE venue_type = 'virtual';
-- UPDATE venues SET venue_type = 'event_space' WHERE venue_type = 'entertainment';
-- UPDATE venues SET venue_type = 'event_space' WHERE venue_type = 'hospital';


-- ============================================================================
-- HIGH: Events with ALL CAPS Short Titles (420 events)
-- ============================================================================
-- These are likely navigation text or poorly parsed titles

SELECT 
    e.id,
    e.title,
    e.start_date,
    v.name as venue_name,
    s.slug as source_slug,
    s.name as source_name
FROM events e
INNER JOIN venues v ON e.venue_id = v.id
INNER JOIN sources s ON e.source_id = s.id
WHERE e.title = UPPER(e.title)
  AND LENGTH(e.title) < 20
  AND e.title ~ '[A-Z]'  -- Contains at least one letter
  AND e.start_date >= CURRENT_DATE
ORDER BY s.slug, e.start_date
LIMIT 100;

-- Top offenders by source:
SELECT 
    s.slug,
    s.name,
    COUNT(*) as all_caps_count
FROM events e
INNER JOIN sources s ON e.source_id = s.id
WHERE e.title = UPPER(e.title)
  AND LENGTH(e.title) < 20
  AND e.title ~ '[A-Z]'
  AND e.start_date >= CURRENT_DATE
GROUP BY s.slug, s.name
ORDER BY all_caps_count DESC;

-- ACTION: Fix crawlers for the-eastern, the-masquerade, terminal-west
-- Add title normalization in db.py insert_event()


-- ============================================================================
-- HIGH: Events with Date in Title (105 events)
-- ============================================================================
-- Titles starting with month names or dates

SELECT 
    e.id,
    e.title,
    e.start_date,
    v.name as venue_name,
    s.slug as source_slug
FROM events e
INNER JOIN venues v ON e.venue_id = v.id
INNER JOIN sources s ON e.source_id = s.id
WHERE (
    e.title ~* '^(January|February|March|April|May|June|July|August|September|October|November|December)'
    OR e.title ~* '^(Mon |Tue |Wed |Thu |Fri |Sat |Sun )'
    OR e.title ~ '^202[0-9]-'
)
  AND e.start_date >= CURRENT_DATE
ORDER BY s.slug, e.start_date
LIMIT 50;

-- ACTION: Add title cleaning in db.py:
-- title = re.sub(r'^(January|February|...|December)\s+\d+:\s*', '', title)
-- title = re.sub(r'^\d{4}-\d{2}-\d{2}\s+@\s+', '', title)


-- ============================================================================
-- HIGH: Title Equals Venue Name (34 events)
-- ============================================================================
-- "Event is just the place being open" - likely junk events

SELECT 
    e.id,
    e.title,
    v.name as venue_name,
    e.start_date,
    s.slug as source_slug,
    e.description
FROM events e
INNER JOIN venues v ON e.venue_id = v.id
INNER JOIN sources s ON e.source_id = s.id
WHERE LOWER(TRIM(e.title)) = LOWER(TRIM(v.name))
  AND e.start_date >= CURRENT_DATE
ORDER BY e.start_date;

-- ACTION: Delete these or fix crawler to only capture actual programmed events


-- ============================================================================
-- MEDIUM: Dead Sources (194 sources)
-- ============================================================================
-- Active sources with no future events

SELECT 
    s.id,
    s.slug,
    s.name,
    s.url,
    s.is_active,
    MAX(e.start_date) as last_event_date,
    COUNT(e.id) as total_events
FROM sources s
LEFT JOIN events e ON e.source_id = s.id
WHERE s.is_active = true
GROUP BY s.id, s.slug, s.name, s.url, s.is_active
HAVING MAX(e.start_date) < CURRENT_DATE OR MAX(e.start_date) IS NULL
ORDER BY MAX(e.start_date) DESC NULLS LAST, s.slug
LIMIT 100;

-- ACTION: Set is_active = false for broken sources
-- UPDATE sources SET is_active = false WHERE slug IN ('basement-atlanta', 'keep-atlanta-beautiful', ...);


-- ============================================================================
-- MEDIUM: Music Events Without Genres (971 events)
-- ============================================================================
-- Music events that can't be filtered by genre

SELECT 
    e.id,
    e.title,
    v.name as venue_name,
    e.start_date,
    s.slug as source_slug,
    e.genres,
    e.tags
FROM events e
INNER JOIN venues v ON e.venue_id = v.id
INNER JOIN sources s ON e.source_id = s.id
WHERE e.category = 'music'
  AND (e.genres IS NULL OR e.genres = '{}')
  AND e.start_date >= CURRENT_DATE
ORDER BY e.start_date
LIMIT 100;

-- Top sources missing genres:
SELECT 
    s.slug,
    COUNT(*) as missing_genre_count
FROM events e
INNER JOIN sources s ON e.source_id = s.id
WHERE e.category = 'music'
  AND (e.genres IS NULL OR e.genres = '{}')
  AND e.start_date >= CURRENT_DATE
GROUP BY s.slug
ORDER BY missing_genre_count DESC;

-- ACTION: Run artist_images.py to fetch Spotify genres for music events
-- Enhance tag_inference.py with better genre extraction rules


-- ============================================================================
-- MEDIUM: Nightlife Events Without Genres (159 events)
-- ============================================================================

SELECT 
    e.id,
    e.title,
    v.name as venue_name,
    e.start_date,
    s.slug as source_slug,
    e.genres,
    e.tags
FROM events e
INNER JOIN venues v ON e.venue_id = v.id
INNER JOIN sources s ON e.source_id = s.id
WHERE e.category = 'nightlife'
  AND (e.genres IS NULL OR e.genres = '{}')
  AND e.start_date >= CURRENT_DATE
ORDER BY e.start_date
LIMIT 50;

-- ACTION: Add nightlife genre inference based on title keywords in tag_inference.py


-- ============================================================================
-- MEDIUM: Cross-Midnight Time Bug (119 events)
-- ============================================================================
-- Events where end_time < start_time (nightclubs closing after midnight)

SELECT 
    e.id,
    e.title,
    v.name as venue_name,
    e.start_date,
    e.start_time,
    e.end_time,
    s.slug as source_slug
FROM events e
INNER JOIN venues v ON e.venue_id = v.id
INNER JOIN sources s ON e.source_id = s.id
WHERE e.start_time IS NOT NULL
  AND e.end_time IS NOT NULL
  AND e.end_time < e.start_time
  AND e.start_date >= CURRENT_DATE
ORDER BY s.slug, e.start_date;

-- Sources with this issue:
SELECT 
    s.slug,
    COUNT(*) as cross_midnight_count
FROM events e
INNER JOIN sources s ON e.source_id = s.id
WHERE e.start_time IS NOT NULL
  AND e.end_time IS NOT NULL
  AND e.end_time < e.start_time
  AND e.start_date >= CURRENT_DATE
GROUP BY s.slug
ORDER BY cross_midnight_count DESC;

-- ACTION: Fix crawler logic to handle cross-midnight events
-- Option 1: Set end_time = NULL if end < start
-- Option 2: Add 1 day to end_date when end < start


-- ============================================================================
-- MEDIUM: All-Day Events with Times (11 events)
-- ============================================================================
-- Contradictory: is_all_day=true but has start_time

SELECT 
    e.id,
    e.title,
    v.name as venue_name,
    e.start_date,
    e.start_time,
    e.is_all_day,
    s.slug as source_slug
FROM events e
INNER JOIN venues v ON e.venue_id = v.id
INNER JOIN sources s ON e.source_id = s.id
WHERE e.is_all_day = true
  AND e.start_time IS NOT NULL
  AND e.start_date >= CURRENT_DATE
ORDER BY e.start_date;

-- ACTION: Fix crawler logic - if is_all_day, set start_time = NULL
-- OR if start_time exists, set is_all_day = false


-- ============================================================================
-- MEDIUM: Null Descriptions (882 events)
-- ============================================================================
-- Events with no description at all

SELECT 
    s.slug,
    s.name,
    COUNT(*) as null_desc_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as pct_of_null
FROM events e
INNER JOIN sources s ON e.source_id = s.id
WHERE e.description IS NULL
  AND e.start_date >= CURRENT_DATE
GROUP BY s.slug, s.name
ORDER BY null_desc_count DESC
LIMIT 30;

-- ACTION: Enable LLM extraction for high-volume sources
-- Add fallback descriptions based on category + venue data


-- ============================================================================
-- LOW: Duplicate Content Hashes (21 duplicates)
-- ============================================================================
-- Same event appearing multiple times (likely venue variants)

SELECT 
    e.content_hash,
    COUNT(*) as dup_count,
    STRING_AGG(DISTINCT v.name, ' | ') as venue_names,
    STRING_AGG(DISTINCT e.title, ' | ') as titles,
    STRING_AGG(DISTINCT s.slug, ' | ') as source_slugs
FROM events e
INNER JOIN venues v ON e.venue_id = v.id
INNER JOIN sources s ON e.source_id = s.id
WHERE e.content_hash IS NOT NULL
  AND e.start_date >= CURRENT_DATE
GROUP BY e.content_hash
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ACTION: Improve venue slug normalization for multi-room venues
-- Masquerade should map "The Masquerade - Hell" to "the-masquerade"


-- ============================================================================
-- SUMMARY STATS
-- ============================================================================

SELECT 
    'Total Events' as metric,
    COUNT(*) as count
FROM events
UNION ALL
SELECT 
    'Future Events',
    COUNT(*)
FROM events
WHERE start_date >= CURRENT_DATE
UNION ALL
SELECT 
    'Events Missing Description',
    COUNT(*)
FROM events
WHERE description IS NULL AND start_date >= CURRENT_DATE
UNION ALL
SELECT 
    'Music Events Missing Genres',
    COUNT(*)
FROM events
WHERE category = 'music' 
  AND (genres IS NULL OR genres = '{}')
  AND start_date >= CURRENT_DATE
UNION ALL
SELECT 
    'Venues Missing Coordinates',
    COUNT(DISTINCT venue_id)
FROM events e
INNER JOIN venues v ON e.venue_id = v.id
WHERE (v.lat IS NULL OR v.lng IS NULL)
  AND e.start_date >= CURRENT_DATE
UNION ALL
SELECT 
    'Active Sources',
    COUNT(*)
FROM sources
WHERE is_active = true
UNION ALL
SELECT 
    'Dead Active Sources',
    COUNT(*)
FROM (
    SELECT s.id
    FROM sources s
    LEFT JOIN events e ON e.source_id = s.id
    WHERE s.is_active = true
    GROUP BY s.id
    HAVING MAX(e.start_date) < CURRENT_DATE OR MAX(e.start_date) IS NULL
) sub;

