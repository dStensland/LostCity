-- Fix existing events that were incorrectly marked as recurring.
-- The crawler changes prevent future bad data; this cleans up what's already in the DB.

-- 1. Annual tentpoles: these are one-time annual festivals, not weekly regulars.
-- Set is_recurring=false on all events from annual tentpole sources.
UPDATE events
SET is_recurring = false
WHERE source_id IN (
  SELECT id FROM sources WHERE slug IN (
    'piedmont-park-arts-festival',
    'national-black-arts-festival',
    'native-american-festival-and-pow-wow',
    'atlanta-greek-picnic',
    'taste-of-soul-atlanta',
    'ga-renaissance-festival',
    'blue-ridge-trout-fest',
    'breakaway-atlanta',
    'esfna-atlanta',
    '221b-con',
    'fifa-fan-festival-atlanta'
  )
)
AND is_recurring = true;

-- 2. True Colors Theatre + Atlanta Comedy Theater: multi-night show runs
-- are NOT recurring hangs. Fix is_recurring and series_type.
UPDATE events
SET is_recurring = false
WHERE source_id IN (
  SELECT id FROM sources WHERE slug IN (
    'true-colors-theatre',
    'atlanta-comedy-theater'
  )
)
AND is_recurring = true;

-- Fix the series_type from recurring_show → other for theatre run series
UPDATE series
SET series_type = 'other'
WHERE series_type = 'recurring_show'
  AND venue_id IN (
    SELECT id FROM venues WHERE slug IN (
      'true-colors-theatre',
      'atlanta-comedy-theater'
    )
  );

-- 3. Recompute is_regular_ready on affected events.
-- The trigger fires on UPDATE of title/series_id/start_time/source_url,
-- but changing is_recurring alone won't trigger it. Force a re-eval by
-- touching start_time (set it to itself).
UPDATE events
SET start_time = start_time
WHERE source_id IN (
  SELECT id FROM sources WHERE slug IN (
    'piedmont-park-arts-festival',
    'national-black-arts-festival',
    'native-american-festival-and-pow-wow',
    'atlanta-greek-picnic',
    'taste-of-soul-atlanta',
    'ga-renaissance-festival',
    'blue-ridge-trout-fest',
    'breakaway-atlanta',
    'esfna-atlanta',
    '221b-con',
    'fifa-fan-festival-atlanta',
    'true-colors-theatre',
    'atlanta-comedy-theater'
  )
);
