-- Backfill producer_id for existing events based on their source slug
-- This links events to their producers so they show in "From Orgs You Follow"

UPDATE events e
SET producer_id = 'atlanta-ballet'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'atlanta-ballet'
  AND e.producer_id IS NULL;

UPDATE events e
SET producer_id = 'atlanta-opera'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'atlanta-opera'
  AND e.producer_id IS NULL;

UPDATE events e
SET producer_id = 'atlanta-pride'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'atlanta-pride'
  AND e.producer_id IS NULL;

UPDATE events e
SET producer_id = 'atlanta-beltline-inc'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'beltline'
  AND e.producer_id IS NULL;

UPDATE events e
SET producer_id = 'atlanta-film-society'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'atlanta-film-society'
  AND e.producer_id IS NULL;

UPDATE events e
SET producer_id = 'out-on-film'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'out-on-film'
  AND e.producer_id IS NULL;

UPDATE events e
SET producer_id = 'atlanta-jewish-film'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'ajff'
  AND e.producer_id IS NULL;

UPDATE events e
SET producer_id = 'atlanta-contemporary'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'atlanta-contemporary'
  AND e.producer_id IS NULL;

UPDATE events e
SET producer_id = 'callanwolde'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'callanwolde'
  AND e.producer_id IS NULL;

UPDATE events e
SET producer_id = 'atlanta-track-club'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'atlanta-track-club'
  AND e.producer_id IS NULL;

UPDATE events e
SET producer_id = 'woodruff-arts'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'high-museum'
  AND e.producer_id IS NULL;

UPDATE events e
SET producer_id = 'artsatl'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'arts-atl'
  AND e.producer_id IS NULL;

UPDATE events e
SET producer_id = 'atlanta-cultural-affairs'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'atlanta-cultural-affairs'
  AND e.producer_id IS NULL;

UPDATE events e
SET producer_id = 'taste-of-atlanta'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'taste-of-atlanta'
  AND e.producer_id IS NULL;

UPDATE events e
SET producer_id = 'decatur-arts'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'decatur-arts-festival'
  AND e.producer_id IS NULL;

UPDATE events e
SET producer_id = 'community-foundation-atl'
FROM sources s
WHERE e.source_id = s.id
  AND s.slug = 'community-foundation-atl'
  AND e.producer_id IS NULL;
