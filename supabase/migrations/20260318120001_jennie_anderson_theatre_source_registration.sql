-- Register Jennie T. Anderson Theatre as a venue source.
-- 606-seat performing arts theater at the Cobb Civic Center complex.
-- Operated by Cobb County Parks. Home to Georgia Players Guild.

-- Source registration
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method, expected_event_count)
SELECT 'Jennie T. Anderson Theatre', 'jennie-anderson-theatre', 'https://www.cobbcounty.gov/jennie-t-anderson-theatre', 'venue', 'weekly', TRUE, p.id, 'html', 10
FROM portals p WHERE p.slug = 'atlanta'
  AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.slug = 'jennie-anderson-theatre');

-- Venue record (if not already created by cobb_parks_rec or georgia_symphony crawlers)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, vibes)
SELECT 'Jennie T. Anderson Theatre', 'jennie-anderson-theatre',
       '548 S Marietta Pkwy SE', 'Marietta', 'Marietta', 'GA', '30060',
       33.9433, -84.5360, 'theater', 'theater',
       'https://www.cobbcounty.gov/jennie-t-anderson-theatre',
       '606-seat performing arts theater at the Cobb Civic Center complex, operated by Cobb County Parks. Home to Georgia Players Guild and touring performances.',
       ARRAY['theater', 'performing-arts', 'family-friendly']
WHERE NOT EXISTS (SELECT 1 FROM venues v WHERE v.slug = 'jennie-anderson-theatre');
