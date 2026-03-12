-- Migration 282: NULL out auto-generated filler descriptions
--
-- The post_crawl_maintenance script previously fabricated descriptions like:
--   "Happy Hour is a local event. Location: Hudson Grille in Midtown, Atlanta, GA."
-- These restate structured fields and add zero value. NULL is better.

UPDATE events
SET description = NULL
WHERE description LIKE '%is a local event%'
  AND start_date >= CURRENT_DATE;

-- Also catch the other filler pattern
UPDATE events
SET description = NULL
WHERE description LIKE '%Location details are listed on the official event page%'
  AND length(description) < 300
  AND start_date >= CURRENT_DATE;
