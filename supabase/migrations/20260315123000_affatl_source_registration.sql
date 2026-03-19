-- Register African Film Festival Atlanta as an active Arts portal source.

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
  'African Film Festival Atlanta',
  'african-film-festival-atlanta',
  'https://africanfilmfestatl.com/press/',
  'organization',
  'weekly',
  TRUE,
  p.id,
  'html',
  12
FROM portals p
WHERE p.slug = 'arts-atlanta'
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.slug = 'african-film-festival-atlanta'
  );
