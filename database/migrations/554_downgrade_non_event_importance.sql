-- Downgrade events that were auto-promoted to 'major' by venue capacity
-- but don't belong in the planning horizon (tours, gym access, conferences, etc.)

-- Tours category: daily ballpark tours, stadium tours, etc.
UPDATE events
SET importance = 'standard'
WHERE importance = 'major'
  AND is_active = true
  AND (
    category_id = 'tours'
    OR title ILIKE 'tours:%'
    OR title ILIKE '%truist park tour%'
    OR title ILIKE '%stadium tour%'
  );

-- Gym/fitness access events
UPDATE events
SET importance = 'standard'
WHERE importance = 'major'
  AND is_active = true
  AND (
    title ILIKE '%open gym%'
    OR title ILIKE '%workout day%'
    OR title ILIKE '%member open%'
  );

-- Professional/trade events that aren't consumer-relevant
UPDATE events
SET importance = 'standard'
WHERE importance = 'major'
  AND is_active = true
  AND (
    title ILIKE '%symposium%'
    OR title ILIKE '%select-a-seat%'
    OR title ILIKE '%red carpet experience%'
  );

-- Classes shouldn't be major
UPDATE events
SET importance = 'standard'
WHERE importance = 'major'
  AND is_active = true
  AND is_class = true;
