-- ============================================================================
-- Explore Tracks Editorial Quality - Validation Queries
-- Generated: 2026-02-16
-- Use these queries to verify fixes and track progress
-- ============================================================================

-- ============================================================================
-- 1. FEATURED VENUES MISSING BLURBS (Critical Priority)
-- ============================================================================

SELECT 
    et.name as track_name,
    v.name as venue_name,
    v.id as venue_id,
    etv.is_featured,
    etv.editorial_blurb
FROM explore_track_venues etv
JOIN explore_tracks et ON etv.track_id = et.id
JOIN venues v ON etv.venue_id = v.id
WHERE etv.is_featured = true 
  AND (etv.editorial_blurb IS NULL OR etv.editorial_blurb = '')
ORDER BY et.name, v.name;

-- Expected: 14 rows (needs to be 0)


-- ============================================================================
-- 2. ALL MISSING BLURBS
-- ============================================================================

SELECT 
    et.name as track_name,
    v.name as venue_name,
    v.id as venue_id,
    etv.is_featured
FROM explore_track_venues etv
JOIN explore_tracks et ON etv.track_id = et.id
JOIN venues v ON etv.venue_id = v.id
WHERE (etv.editorial_blurb IS NULL OR etv.editorial_blurb = '')
ORDER BY et.name, etv.is_featured DESC, v.name;

-- Expected: 24 rows (needs to be 0)


-- ============================================================================
-- 3. VENUES MISSING COORDINATES (Breaks Map View)
-- ============================================================================

SELECT 
    et.name as track_name,
    v.name as venue_name,
    v.id as venue_id,
    v.address,
    v.city,
    v.lat,
    v.lng,
    etv.is_featured
FROM explore_track_venues etv
JOIN explore_tracks et ON etv.track_id = et.id
JOIN venues v ON etv.venue_id = v.id
WHERE v.lat IS NULL OR v.lng IS NULL
ORDER BY etv.is_featured DESC, v.name;

-- Expected: 2 rows (Plaza Fiesta, Southern Fried Queer Pride)
-- CRITICAL: Must geocode these venues


-- ============================================================================
-- 4. VENUES WITH DUPLICATE BLURBS ACROSS TRACKS
-- ============================================================================

WITH venue_blurbs AS (
    SELECT 
        etv.venue_id,
        v.name as venue_name,
        etv.editorial_blurb,
        COUNT(*) as usage_count,
        STRING_AGG(et.name, ' | ' ORDER BY et.name) as tracks
    FROM explore_track_venues etv
    JOIN venues v ON etv.venue_id = v.id
    JOIN explore_tracks et ON etv.track_id = et.id
    WHERE etv.editorial_blurb IS NOT NULL
    GROUP BY etv.venue_id, v.name, etv.editorial_blurb
    HAVING COUNT(*) > 1
)
SELECT * FROM venue_blurbs
ORDER BY usage_count DESC, venue_name;

-- Expected: 4-5 rows (Mercedes-Benz Stadium, Krog Street Market, etc.)


-- ============================================================================
-- 5. BLURBS TOO SHORT (< 50 characters)
-- ============================================================================

SELECT 
    et.name as track_name,
    v.name as venue_name,
    LENGTH(etv.editorial_blurb) as blurb_length,
    etv.editorial_blurb
FROM explore_track_venues etv
JOIN explore_tracks et ON etv.track_id = et.id
JOIN venues v ON etv.venue_id = v.id
WHERE etv.editorial_blurb IS NOT NULL 
  AND LENGTH(etv.editorial_blurb) < 50
ORDER BY LENGTH(etv.editorial_blurb);

-- Expected: 1 row (Bun Bo Hue Kitchen)


-- ============================================================================
-- 6. BLURBS TOO LONG (> 200 characters)
-- ============================================================================

SELECT 
    et.name as track_name,
    v.name as venue_name,
    LENGTH(etv.editorial_blurb) as blurb_length,
    etv.editorial_blurb
FROM explore_track_venues etv
JOIN explore_tracks et ON etv.track_id = et.id
JOIN venues v ON etv.venue_id = v.id
WHERE etv.editorial_blurb IS NOT NULL 
  AND LENGTH(etv.editorial_blurb) > 200
ORDER BY LENGTH(etv.editorial_blurb) DESC;

-- Expected: 0 rows (excellent!)


-- ============================================================================
-- 7. TRACK COMPLETION STATUS
-- ============================================================================

SELECT 
    et.name as track_name,
    COUNT(*) as total_venues,
    COUNT(etv.editorial_blurb) as venues_with_blurbs,
    COUNT(*) - COUNT(etv.editorial_blurb) as missing_blurbs,
    ROUND(100.0 * COUNT(etv.editorial_blurb) / COUNT(*), 1) as completion_pct,
    COUNT(*) FILTER (WHERE etv.is_featured = true) as featured_venues,
    COUNT(etv.editorial_blurb) FILTER (WHERE etv.is_featured = true) as featured_with_blurbs
FROM explore_track_venues etv
JOIN explore_tracks et ON etv.track_id = et.id
GROUP BY et.id, et.name
ORDER BY completion_pct ASC, et.name;

-- Lowest completion first to prioritize fixes


-- ============================================================================
-- 8. VENUES APPEARING IN MULTIPLE TRACKS
-- ============================================================================

WITH multi_track_venues AS (
    SELECT 
        etv.venue_id,
        v.name as venue_name,
        COUNT(DISTINCT etv.track_id) as track_count,
        STRING_AGG(et.name, ' | ' ORDER BY et.name) as tracks
    FROM explore_track_venues etv
    JOIN venues v ON etv.venue_id = v.id
    JOIN explore_tracks et ON etv.track_id = et.id
    GROUP BY etv.venue_id, v.name
    HAVING COUNT(DISTINCT etv.track_id) > 1
)
SELECT * FROM multi_track_venues
ORDER BY track_count DESC, venue_name;

-- Shows venues that need differentiated blurbs per track


-- ============================================================================
-- 9. VENUE DATA QUALITY SCORES FOR TRACK VENUES
-- ============================================================================

SELECT 
    et.name as track_name,
    v.name as venue_name,
    v.data_quality,
    v.venue_type,
    CASE 
        WHEN v.lat IS NULL OR v.lng IS NULL THEN 'Missing coords'
        WHEN v.address IS NULL THEN 'Missing address'
        ELSE 'OK'
    END as data_gap
FROM explore_track_venues etv
JOIN explore_tracks et ON etv.track_id = et.id
JOIN venues v ON etv.venue_id = v.id
WHERE v.data_quality < 60
ORDER BY v.data_quality ASC, et.name;


-- ============================================================================
-- 10. GENERIC WORD USAGE (Quality Check)
-- ============================================================================

SELECT 
    'iconic' as generic_word,
    COUNT(*) as usage_count,
    STRING_AGG(v.name || ' (' || et.name || ')', ', ' ORDER BY v.name) as examples
FROM explore_track_venues etv
JOIN venues v ON etv.venue_id = v.id
JOIN explore_tracks et ON etv.track_id = et.id
WHERE etv.editorial_blurb ILIKE '%iconic%'

UNION ALL

SELECT 
    'legendary' as generic_word,
    COUNT(*) as usage_count,
    STRING_AGG(v.name || ' (' || et.name || ')', ', ' ORDER BY v.name) as examples
FROM explore_track_venues etv
JOIN venues v ON etv.venue_id = v.id
JOIN explore_tracks et ON etv.track_id = et.id
WHERE etv.editorial_blurb ILIKE '%legendary%'

UNION ALL

SELECT 
    'beloved' as generic_word,
    COUNT(*) as usage_count,
    STRING_AGG(v.name || ' (' || et.name || ')', ', ' ORDER BY v.name) as examples
FROM explore_track_venues etv
JOIN venues v ON etv.venue_id = v.id
JOIN explore_tracks et ON etv.track_id = et.id
WHERE etv.editorial_blurb ILIKE '%beloved%'

UNION ALL

SELECT 
    'must-visit' as generic_word,
    COUNT(*) as usage_count,
    STRING_AGG(v.name || ' (' || et.name || ')', ', ' ORDER BY v.name) as examples
FROM explore_track_venues etv
JOIN venues v ON etv.venue_id = v.id
JOIN explore_tracks et ON etv.track_id = et.id
WHERE etv.editorial_blurb ILIKE '%must-visit%'

ORDER BY usage_count DESC;


-- ============================================================================
-- 11. VENUES MISSING ADDRESSES (Parks and Landmarks)
-- ============================================================================

SELECT 
    et.name as track_name,
    v.name as venue_name,
    v.id as venue_id,
    v.venue_type,
    v.city,
    v.neighborhood,
    v.lat,
    v.lng
FROM explore_track_venues etv
JOIN explore_tracks et ON etv.track_id = et.id
JOIN venues v ON etv.venue_id = v.id
WHERE v.address IS NULL
ORDER BY v.venue_type, v.name;


-- ============================================================================
-- 12. FULL EDITORIAL BLURB EXPORT (For Review)
-- ============================================================================

SELECT 
    et.name as track_name,
    et.slug as track_slug,
    v.name as venue_name,
    v.slug as venue_slug,
    v.id as venue_id,
    etv.is_featured,
    etv.editorial_blurb,
    LENGTH(etv.editorial_blurb) as blurb_length,
    v.venue_type,
    v.data_quality
FROM explore_track_venues etv
JOIN explore_tracks et ON etv.track_id = et.id
JOIN venues v ON etv.venue_id = v.id
ORDER BY et.name, etv.is_featured DESC, v.name;


-- ============================================================================
-- 13. GOOD TROUBLE TRACK (Needs Immediate Attention - 44% Complete)
-- ============================================================================

SELECT 
    v.name as venue_name,
    v.id as venue_id,
    etv.is_featured,
    etv.editorial_blurb,
    CASE 
        WHEN etv.editorial_blurb IS NOT NULL THEN '✓ Has blurb'
        WHEN etv.is_featured THEN '⚠️ FEATURED - MISSING BLURB'
        ELSE '○ Missing blurb'
    END as status
FROM explore_track_venues etv
JOIN venues v ON etv.venue_id = v.id
WHERE etv.track_id = (SELECT id FROM explore_tracks WHERE slug = 'good-trouble')
ORDER BY etv.is_featured DESC, v.name;


-- ============================================================================
-- 14. THE ITIS TRACK (Needs Immediate Attention - 68% Complete)
-- ============================================================================

SELECT 
    v.name as venue_name,
    v.id as venue_id,
    etv.is_featured,
    etv.editorial_blurb,
    CASE 
        WHEN etv.editorial_blurb IS NOT NULL THEN '✓ Has blurb'
        WHEN etv.is_featured THEN '⚠️ FEATURED - MISSING BLURB'
        ELSE '○ Missing blurb'
    END as status
FROM explore_track_venues etv
JOIN venues v ON etv.venue_id = v.id
WHERE etv.track_id = (SELECT id FROM explore_tracks WHERE slug = 'the-itis')
ORDER BY etv.is_featured DESC, v.name;


-- ============================================================================
-- PROGRESS TRACKING DASHBOARD
-- ============================================================================

WITH stats AS (
    SELECT 
        COUNT(*) as total_venues,
        COUNT(etv.editorial_blurb) as venues_with_blurbs,
        COUNT(*) - COUNT(etv.editorial_blurb) as missing_blurbs,
        COUNT(*) FILTER (WHERE etv.is_featured = true) as featured_venues,
        COUNT(etv.editorial_blurb) FILTER (WHERE etv.is_featured = true) as featured_with_blurbs,
        COUNT(*) FILTER (WHERE LENGTH(etv.editorial_blurb) < 50) as too_short,
        COUNT(*) FILTER (WHERE LENGTH(etv.editorial_blurb) > 200) as too_long,
        COUNT(DISTINCT v.id) FILTER (WHERE v.lat IS NULL OR v.lng IS NULL) as missing_coords
    FROM explore_track_venues etv
    JOIN venues v ON etv.venue_id = v.id
)
SELECT 
    total_venues,
    venues_with_blurbs,
    ROUND(100.0 * venues_with_blurbs / total_venues, 1) || '%' as completion_pct,
    missing_blurbs,
    featured_venues,
    featured_with_blurbs,
    featured_venues - featured_with_blurbs as featured_missing,
    too_short,
    too_long,
    missing_coords
FROM stats;

-- Run this query daily to track progress toward 100% completion
