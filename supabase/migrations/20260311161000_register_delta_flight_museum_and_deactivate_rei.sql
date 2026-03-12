WITH atlanta_portal AS (
  SELECT id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1
)
INSERT INTO sources (
  name,
  slug,
  url,
  source_type,
  is_active,
  owner_portal_id,
  crawl_frequency,
  integration_method
)
SELECT
  'Delta Flight Museum',
  'delta-flight-museum',
  'https://www.deltamuseum.org/visit/whats-on/upcoming-events',
  'venue',
  true,
  atlanta_portal.id,
  'daily',
  'python_crawler'
FROM atlanta_portal
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    is_active = true,
    owner_portal_id = EXCLUDED.owner_portal_id,
    crawl_frequency = EXCLUDED.crawl_frequency,
    integration_method = EXCLUDED.integration_method,
    updated_at = NOW();

UPDATE sources
SET is_active = false,
    expected_event_count = 0,
    updated_at = NOW()
WHERE slug = 'rei-atlanta';
