-- Register the official Cobb parks family map source.

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
  'Cobb Parks Family Map',
  'cobb-parks-family-map',
  'https://www.cobbcounty.gov/parks/find-park',
  'government',
  'monthly',
  TRUE,
  p.id,
  'python',
  0
FROM portals p
WHERE p.slug = 'atlanta-families'
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.slug = 'cobb-parks-family-map'
  );
