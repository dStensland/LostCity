-- Introduce "museums" as a distinct event category.
-- Previously, museum events were filed under "art" or "cultural".
-- This migration recategorizes events at museum-type venues.

-- Step 1: Recategorize events at museum venues from "art" → "museums"
-- Only change events where the category is generic "art" — not music, film, etc.
UPDATE events
SET category = 'museums',
    updated_at = now()
WHERE category = 'art'
  AND venue_id IN (
    SELECT id FROM venues WHERE venue_type = 'museum'
  );

-- Step 2: Recategorize "cultural" events at museum venues → "museums"
UPDATE events
SET category = 'museums',
    updated_at = now()
WHERE category = 'cultural'
  AND venue_id IN (
    SELECT id FROM venues WHERE venue_type = 'museum'
  );

-- Step 3: Also catch events where the source is a known museum but venue_type
-- might not be set (e.g. CDC Museum uses venue_type "organization")
UPDATE events
SET category = 'museums',
    updated_at = now()
WHERE category IN ('art', 'cultural')
  AND venue_id IN (
    SELECT id FROM venues
    WHERE slug IN (
      'cdc-museum-atlanta',
      'center-for-civil-and-human-rights',
      'national-center-for-civil-and-human-rights'
    )
  );
