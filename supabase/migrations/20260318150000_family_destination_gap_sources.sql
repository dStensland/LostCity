-- Register Family destination-first gap-closure sources for Outdoor Activity Center
-- and Exchange Recreation Center.

INSERT INTO sources (
  name,
  slug,
  url,
  source_type,
  crawl_frequency,
  is_active,
  owner_portal_id,
  integration_method,
  expected_event_count
)
SELECT
  'Outdoor Activity Center',
  'outdoor-activity-center',
  'https://www.wawa-online.org/outdoor-center',
  'nonprofit',
  'monthly',
  TRUE,
  p.id,
  'python',
  0
FROM portals p
WHERE p.slug = 'atlanta-families'
  AND NOT EXISTS (
    SELECT 1 FROM sources s WHERE s.slug = 'outdoor-activity-center'
  );

INSERT INTO sources (
  name,
  slug,
  url,
  source_type,
  crawl_frequency,
  is_active,
  owner_portal_id,
  integration_method,
  expected_event_count
)
SELECT
  'Exchange Recreation Center',
  'exchange-recreation-center',
  'https://www.dekalbcountyga.gov/parks/exchange-recreation',
  'government',
  'monthly',
  TRUE,
  p.id,
  'python',
  0
FROM portals p
WHERE p.slug = 'atlanta-families'
  AND NOT EXISTS (
    SELECT 1 FROM sources s WHERE s.slug = 'exchange-recreation-center'
  );
