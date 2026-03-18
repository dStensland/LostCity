-- Register Essential Theatre as an organization source.
-- They are a resident company at 7 Stages (Little Five Points).
-- Georgia's longest-running company for Georgia playwrights.

INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method, expected_event_count)
SELECT 'Essential Theatre', 'essential-theatre', 'https://www.essentialtheatre.com', 'organization', 'weekly', TRUE, p.id, 'api', 8
FROM portals p WHERE p.slug = 'atlanta'
  AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.slug = 'essential-theatre');
