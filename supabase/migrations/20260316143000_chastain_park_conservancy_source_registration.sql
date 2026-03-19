-- Register Chastain Park Conservancy as an active Atlanta-family-relevant source.

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
  'Chastain Park Conservancy',
  'chastain-park-conservancy',
  'https://chastainparkconservancy.org/',
  'organization',
  'weekly',
  TRUE,
  p.id,
  'html',
  10
FROM portals p
WHERE p.slug = 'atlanta'
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.slug = 'chastain-park-conservancy'
  );
