-- EXPLORE TRACKS DATA CLEANUP SCRIPT
-- Date: 2026-02-14
-- Purpose: Remove closed, out-of-market, and address-only venues from explore tracks

-- ============================================================================
-- STEP 1: REMOVE CLOSED VENUES
-- ============================================================================

-- Orpheus Brewing is CLOSED (appears in 2 tracks)
DELETE FROM explore_track_venues
WHERE venue_id IN (
  SELECT id FROM venues WHERE name = 'Orpheus Brewing'
)
AND status = 'approved';

-- ============================================================================
-- STEP 2: REMOVE NON-ATLANTA VENUES
-- ============================================================================

-- Nashville venues (3rd & Lindsley appears 2x, Art Urban Nashville)
DELETE FROM explore_track_venues
WHERE venue_id IN (
  SELECT id FROM venues 
  WHERE name LIKE '%3rd & Lindsley%' 
  OR name LIKE '%3rd&Lindsley%'
  OR name = 'third-and-lindsley'
  OR name LIKE '%Art Urban Nashville%'
);

-- Anaheim venue (Angel Stadium)
DELETE FROM explore_track_venues
WHERE venue_id IN (
  SELECT id FROM venues WHERE name = 'Angel Stadium'
);

-- ============================================================================
-- STEP 3: REMOVE ADDRESS-ONLY ENTRIES (NO REAL VENUE NAMES)
-- ============================================================================

DELETE FROM explore_track_venues
WHERE venue_id IN (
  SELECT id FROM venues 
  WHERE name IN (
    '121 Baker Street',
    '400 Park Dr NE',
    '395 Edgewood Ave SE',
    '755 Hank Aaron Drive'
  )
);

-- ============================================================================
-- STEP 4: VERIFICATION QUERIES
-- ============================================================================

-- Count venues removed per track
SELECT 
  et.name as track_name,
  et.slug,
  COUNT(etv.id) as remaining_venues
FROM explore_tracks et
LEFT JOIN explore_track_venues etv ON et.id = etv.track_id AND etv.status = 'approved'
WHERE et.is_active = true
GROUP BY et.id, et.name, et.slug
ORDER BY remaining_venues ASC;

-- Tracks with < 10 venues (sparse)
SELECT 
  et.name,
  et.slug,
  et.description,
  COUNT(etv.id) as venue_count
FROM explore_tracks et
LEFT JOIN explore_track_venues etv ON et.id = etv.track_id AND etv.status = 'approved'
WHERE et.is_active = true
GROUP BY et.id, et.name, et.slug, et.description
HAVING COUNT(etv.id) < 10
ORDER BY venue_count ASC;

-- ============================================================================
-- END OF CLEANUP SCRIPT
-- ============================================================================
