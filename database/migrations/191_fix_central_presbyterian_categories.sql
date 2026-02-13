-- Fix Central Presbyterian Church events miscategorized as "music"
-- The crawler was defaulting everything to category=music, subcategory=classical
-- which caused advocacy meetings, shelters, worship, etc. to appear as music events.

-- Also fix the venue_type from event_space to church
UPDATE venues
SET venue_type = 'church',
    spot_type = 'church'
WHERE slug = 'central-presbyterian-church'
  AND venue_type = 'event_space';

-- Fix shelter / social services events
UPDATE events
SET category = 'community',
    subcategory = 'service',
    tags = array_remove(tags, 'live-music')
WHERE venue_id = (SELECT id FROM venues WHERE slug = 'central-presbyterian-church')
  AND category = 'music'
  AND (
    title ILIKE '%shelter%'
    OR title ILIKE '%night shelter%'
    OR title ILIKE '%food pantry%'
    OR title ILIKE '%meal%'
  );

-- Fix advocacy / civic events
UPDATE events
SET category = 'community',
    subcategory = 'advocacy',
    tags = array_remove(tags, 'live-music')
WHERE venue_id = (SELECT id FROM venues WHERE slug = 'central-presbyterian-church')
  AND category = 'music'
  AND (
    title ILIKE '%advocacy%'
    OR title ILIKE '%council on aging%'
    OR title ILIKE '%aging council%'
    OR title ILIKE '%civic%'
    OR title ILIKE '%justice%'
    OR title ILIKE '%legislative%'
  );

-- Fix worship / religious events
UPDATE events
SET category = 'religious',
    subcategory = NULL,
    tags = array_remove(tags, 'live-music')
WHERE venue_id = (SELECT id FROM venues WHERE slug = 'central-presbyterian-church')
  AND category = 'music'
  AND (
    title ILIKE '%worship%'
    OR title ILIKE '%service%'
    OR title ILIKE '%sermon%'
    OR title ILIKE '%prayer%'
    OR title ILIKE '%vespers%'
    OR title ILIKE '%ash wednesday%'
    OR title ILIKE '%lent%'
    OR title ILIKE '%advent%'
    OR title ILIKE '%holy week%'
    OR title ILIKE '%palm sunday%'
    OR title ILIKE '%easter%'
  )
  AND title NOT ILIKE '%concert%';

-- Fix education / lecture events
UPDATE events
SET category = 'learning',
    subcategory = 'lecture',
    tags = array_remove(tags, 'live-music')
WHERE venue_id = (SELECT id FROM venues WHERE slug = 'central-presbyterian-church')
  AND category = 'music'
  AND (
    title ILIKE '%lecture%'
    OR title ILIKE '%discussion%'
    OR title ILIKE '%symposium%'
    OR title ILIKE '%seminar%'
    OR title ILIKE '%class%'
    OR title ILIKE '%workshop%'
    OR title ILIKE '%art of the%'
  )
  AND title NOT ILIKE '%master class%'
  AND title NOT ILIKE '%masterclass%';

-- Any remaining music events that don't have music keywords → community
-- This catches anything the crawler miscategorized that doesn't fit above buckets
UPDATE events
SET category = 'community',
    subcategory = NULL,
    tags = array_remove(tags, 'live-music')
WHERE venue_id = (SELECT id FROM venues WHERE slug = 'central-presbyterian-church')
  AND category = 'music'
  AND title NOT ILIKE '%concert%'
  AND title NOT ILIKE '%recital%'
  AND title NOT ILIKE '%symphony%'
  AND title NOT ILIKE '%orchestra%'
  AND title NOT ILIKE '%performance%'
  AND title NOT ILIKE '%quartet%'
  AND title NOT ILIKE '%ensemble%'
  AND title NOT ILIKE '%chorale%'
  AND title NOT ILIKE '%master class%'
  AND title NOT ILIKE '%masterclass%';
