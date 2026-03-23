-- Fix widespread substring-match category inference bug.
--
-- Root cause: ~25 crawler source files used `if keyword in text` (substring
-- match) for category inference. The keyword "art" matched inside common
-- words: "partnering", "smart", "start", "artificial", "department", etc.
-- Result: 77.8% of "art" category events are false positives (1,174 of 1,509).
--
-- Crawler fix: all 25 files switched to word-boundary regex matching.
-- This migration cleans up existing dirty records in the database.

-- ==========================================================================
-- 1. Mark all AARP events as is_class (service programs, not entertainment)
-- ==========================================================================
UPDATE events
SET is_class = true, updated_at = NOW()
WHERE title ILIKE '%AARP%'
  AND (is_class IS NULL OR is_class = false);

-- ==========================================================================
-- 2. Reset false-positive "art" events back to "community" across ALL sources.
--    Keep events that genuinely contain art-related words in the title.
--    Uses Postgres word-boundary anchors \m (start) and \M (end).
--
--    Excludes known art-activity sources where events ARE art but titles
--    don't say "art" (Painting With a Twist, etc.)
-- ==========================================================================

-- Known art-activity source IDs to EXCLUDE from the reset
-- (their events are genuinely art even without "art" in the title)
WITH art_sources AS (
  SELECT id FROM sources WHERE slug IN (
    'painting-with-a-twist',
    'painting-with-a-twist-brookhaven',
    'painting-with-a-twist-kennesaw',
    'painting-with-a-twist-midtown',
    'painting-with-a-twist-smyrna',
    'painting-with-a-twist-suwanee',
    'painting-with-a-twist-woodstock',
    'mudfire',
    'mudfire-pottery-studio',
    'atlanta-clay-works',
    'all-fired-up',
    'all-fired-up-art-studio'
  )
)
UPDATE events
SET category_id = 'community', updated_at = NOW()
WHERE category_id = 'art'
  AND is_active = true
  AND start_date >= CURRENT_DATE
  AND source_id NOT IN (SELECT id FROM art_sources)
  AND title !~* '\m(art|arts|craft|crafts|paint|painting|draw|drawing|gallery|museum|exhibit|exhibition|ceramic|pottery|sculpt|sculpture|mural|mosaic|weav|knit|stitch|sew|embroider|printmaking|watercolor|collage|sketch)\M';
