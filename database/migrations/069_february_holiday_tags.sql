-- Migration: Add February holiday tags to events
-- Tags: valentines, lunar-new-year, super-bowl, black-history-month, mardi-gras
-- Also marks specific events as featured for the carousel

-- ============================================
-- VALENTINE'S DAY EVENTS (Feb 12-14 primarily)
-- ============================================

-- Tag Valentine's Day related events
UPDATE events
SET tags = array_append(COALESCE(tags, ARRAY[]::TEXT[]), 'valentines')
WHERE tags IS NULL OR NOT ('valentines' = ANY(tags))
  AND start_date BETWEEN '2026-02-01' AND '2026-02-16'
  AND (
    title ILIKE '%valentine%'
    OR title ILIKE '%love%'
    OR title ILIKE '%romance%'
    OR title ILIKE '%heart%'
    OR title ILIKE '%date night%'
    OR description ILIKE '%valentine%'
  );

-- ============================================
-- LUNAR NEW YEAR EVENTS (Feb 8-15)
-- ============================================

-- Tag Lunar New Year events
UPDATE events
SET tags = array_append(COALESCE(tags, ARRAY[]::TEXT[]), 'lunar-new-year')
WHERE tags IS NULL OR NOT ('lunar-new-year' = ANY(tags))
  AND start_date BETWEEN '2026-01-20' AND '2026-02-28'
  AND (
    title ILIKE '%lunar%'
    OR title ILIKE '%chinese new year%'
    OR title ILIKE '%year of the snake%'
    OR title ILIKE '%lunar new year%'
    OR description ILIKE '%lunar new year%'
  );

-- ============================================
-- SUPER BOWL EVENTS (Feb 9)
-- ============================================

-- Tag Super Bowl events
UPDATE events
SET tags = array_append(COALESCE(tags, ARRAY[]::TEXT[]), 'super-bowl')
WHERE tags IS NULL OR NOT ('super-bowl' = ANY(tags))
  AND start_date BETWEEN '2026-02-08' AND '2026-02-10'
  AND (
    title ILIKE '%super bowl%'
    OR title ILIKE '%superbowl%'
    OR title ILIKE '%big game%'
    OR description ILIKE '%super bowl%'
  );

-- ============================================
-- BLACK HISTORY MONTH (All of February)
-- ============================================

-- Tag Black History Month events
UPDATE events
SET tags = array_append(COALESCE(tags, ARRAY[]::TEXT[]), 'black-history-month')
WHERE tags IS NULL OR NOT ('black-history-month' = ANY(tags))
  AND start_date BETWEEN '2026-02-01' AND '2026-02-28'
  AND (
    title ILIKE '%black history%'
    OR title ILIKE '%african american%'
    OR title ILIKE '%black heritage%'
    OR description ILIKE '%black history month%'
  );

-- ============================================
-- MARDI GRAS EVENTS (Feb 25 - March 4)
-- ============================================

-- Tag Mardi Gras events
UPDATE events
SET tags = array_append(COALESCE(tags, ARRAY[]::TEXT[]), 'mardi-gras')
WHERE tags IS NULL OR NOT ('mardi-gras' = ANY(tags))
  AND start_date BETWEEN '2026-02-10' AND '2026-02-20'
  AND (
    title ILIKE '%mardi gras%'
    OR title ILIKE '%fat tuesday%'
    OR title ILIKE '%carnival%'
    OR description ILIKE '%mardi gras%'
  );

-- ============================================
-- MARK FEATURED EVENTS FOR CAROUSEL
-- ============================================

-- Victorian Valentine Workshop (id=7713)
UPDATE events
SET is_featured = true
WHERE id = 7713;

-- HeART Market (id=8441)
UPDATE events
SET is_featured = true
WHERE id = 8441;

-- Celebrate Lunar New Year (id=7505)
UPDATE events
SET is_featured = true
WHERE id = 7505;

-- ============================================
-- CREATE INDEX FOR TAG QUERIES
-- ============================================

-- Add index for tag-based queries if not exists
CREATE INDEX IF NOT EXISTS idx_events_tags ON events USING GIN(tags);

-- Add comment for documentation
COMMENT ON COLUMN events.tags IS 'Event tags for filtering (e.g., valentines, lunar-new-year, super-bowl, black-history-month, mardi-gras)';
