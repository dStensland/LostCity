-- Remove umbrella festival wrapper events from Stone Mountain Park.
-- These are multi-week placeholder entries (e.g. "Lunar New Year Festival")
-- that have no useful detail and sit at the top of the feed. The festivals
-- themselves are tracked in the festivals table; individual programming
-- events within them are the ones worth showing.

DELETE FROM events
WHERE venue_id = (SELECT id FROM venues WHERE slug = 'stone-mountain-park')
  AND is_all_day = true
  AND end_date IS NOT NULL
  AND (end_date - start_date) >= 7
  AND (
    title ILIKE '%lunar new year%'
    OR title ILIKE '%chinese new year%'
    OR title ILIKE '%stone mountain christmas%'
    OR title ILIKE '%pumpkin festival%'
    OR title ILIKE '%latino family festival%'
  );
