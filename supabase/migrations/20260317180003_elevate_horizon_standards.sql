-- Elevate Planning Horizon standards.
--
-- Previous logic promoted ALL paid events at capacity_tier >= 3 to 'major'.
-- This produced 423 major events including every Braves game, every Tabernacle
-- show, and admin events like "Suite Season Payments".
--
-- New criteria for 'major':
--   1. Arena concert/show: capacity_tier 5 + music/theater/comedy/art/food/family
--   2. Amphitheater headliner: capacity_tier 4 + music
--   3. Festival programs (festival_id set)
--   4. Sellout risk medium/high
--
-- Excluded: regular-season sports, tier 3 venues, tours, classes, admin noise.
--
-- Strategy: reset ALL major → standard, then re-promote only qualifying events.
-- Flagship events are untouched.

-- ============================================================================
-- Step 1: Reset all major → standard (clean slate)
-- ============================================================================
UPDATE events
SET importance = 'standard'
WHERE importance = 'major'
  AND is_active = true;

-- ============================================================================
-- Step 2: Re-promote arena concerts/shows (tier 5 venues, non-sports)
-- ============================================================================
-- Tier 5 = Mercedes-Benz Stadium, State Farm Arena, Truist Park
-- Only music, theater, comedy, art, food_drink, family categories qualify.
UPDATE events e
SET importance = 'major'
FROM venues v
WHERE e.venue_id = v.id
  AND v.capacity_tier >= 5
  AND e.importance = 'standard'
  AND e.is_active = true
  AND e.start_date >= CURRENT_DATE
  AND e.category_id IN ('music', 'theater', 'comedy', 'art', 'food_drink', 'family')
  AND e.is_class IS NOT TRUE
  AND e.title NOT ILIKE 'tours:%'
  AND e.title NOT ILIKE '%suite season%'
  AND e.title NOT ILIKE '%sth deposit%'
  AND e.title NOT ILIKE 'event for calendar%';

-- ============================================================================
-- Step 3: Re-promote amphitheater headliners (tier 4 venues, music only)
-- ============================================================================
-- Tier 4 = Ameris Bank Amphitheatre, Chastain Park Amphitheatre,
--          Lakewood Amphitheatre, Gas South Arena
-- Only music qualifies — sports at tier 4 (Gladiators, Vibe) stay standard.
UPDATE events e
SET importance = 'major'
FROM venues v
WHERE e.venue_id = v.id
  AND v.capacity_tier = 4
  AND e.importance = 'standard'
  AND e.is_active = true
  AND e.start_date >= CURRENT_DATE
  AND e.category_id = 'music'
  AND e.is_class IS NOT TRUE;

-- ============================================================================
-- Step 4: Re-promote festival programs
-- ============================================================================
UPDATE events
SET importance = 'major'
WHERE importance = 'standard'
  AND is_active = true
  AND start_date >= CURRENT_DATE
  AND festival_id IS NOT NULL;

-- Also promote events in series that belong to festivals
UPDATE events e
SET importance = 'major'
FROM series s
WHERE e.series_id = s.id
  AND s.festival_id IS NOT NULL
  AND e.importance = 'standard'
  AND e.is_active = true
  AND e.start_date >= CURRENT_DATE;

-- ============================================================================
-- Step 5: Re-promote events with sellout risk
-- ============================================================================
UPDATE events
SET importance = 'major'
WHERE importance = 'standard'
  AND is_active = true
  AND start_date >= CURRENT_DATE
  AND sellout_risk IN ('medium', 'high');
