-- Register Midtown Alliance as an active Atlanta source.
--
-- Midtown Alliance is the Business Improvement District for Midtown Atlanta.
-- They produce original community programming (yoga in parks, cardio dance at
-- MARTA stations, mural events, neighborhood activations) that is not available
-- from any other source. source_type = 'organization' because events happen at
-- various Midtown venues, not at a fixed location.
--
-- The site returns 403 on plain HTTP requests; integration_method = 'html'
-- with Playwright rendering handled in the crawler.

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
  'Midtown Alliance',
  'midtown-alliance',
  'https://www.midtownatl.com/events',
  'organization',
  'daily',
  TRUE,
  p.id,
  'html',
  30
FROM portals p
WHERE p.slug = 'atlanta'
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.slug = 'midtown-alliance'
  );
