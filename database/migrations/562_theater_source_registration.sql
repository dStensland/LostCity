-- Register 11 unregistered theater/performing arts crawlers as active Atlanta sources.
-- All crawler files already exist in crawlers/sources/; this activates them.

-- 1. Synchronicity Theatre (Virginia-Highland, professional)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method, expected_event_count)
SELECT 'Synchronicity Theatre', 'synchronicity-theatre', 'https://www.synchrotheatre.com', 'venue', 'weekly', TRUE, p.id, 'html', 10
FROM portals p WHERE p.slug = 'atlanta'
  AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.slug = 'synchronicity-theatre');

-- 2. 7 Stages (Little Five Points, experimental/international)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method, expected_event_count)
SELECT '7 Stages', '7-stages', 'https://www.7stages.org', 'venue', 'weekly', TRUE, p.id, 'html', 10
FROM portals p WHERE p.slug = 'atlanta'
  AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.slug = '7-stages');

-- 3. Rialto Center for the Arts (Downtown, Georgia State University)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method, expected_event_count)
SELECT 'Rialto Center for the Arts', 'rialto-center', 'https://rialto.gsu.edu', 'venue', 'weekly', TRUE, p.id, 'html', 15
FROM portals p WHERE p.slug = 'atlanta'
  AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.slug = 'rialto-center');

-- 4. Georgia Symphony Orchestra (multi-venue: Bailey Performance Center, Strand Theatre)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method, expected_event_count)
SELECT 'Georgia Symphony Orchestra', 'georgia-symphony', 'https://www.georgiasymphony.org', 'organization', 'weekly', TRUE, p.id, 'html', 10
FROM portals p WHERE p.slug = 'atlanta'
  AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.slug = 'georgia-symphony');

-- 5. Stage Door Theatre (Dunwoody, community theater)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method, expected_event_count)
SELECT 'Stage Door Theatre', 'stage-door-players', 'https://stagedoortheatrega.org', 'venue', 'weekly', TRUE, p.id, 'html', 8
FROM portals p WHERE p.slug = 'atlanta'
  AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.slug = 'stage-door-players');

-- 6. Earl Smith Strand Theatre (Marietta Square, historic venue)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method, expected_event_count)
SELECT 'Earl Smith Strand Theatre', 'strand-theatre', 'https://earlsmithstrand.org', 'venue', 'weekly', TRUE, p.id, 'html', 15
FROM portals p WHERE p.slug = 'atlanta'
  AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.slug = 'strand-theatre');

-- 7. Theatre in the Square (Marietta, community theater)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method, expected_event_count)
SELECT 'Theatre in the Square', 'theatre-in-the-square', 'https://mariettatheatre.com', 'venue', 'weekly', TRUE, p.id, 'html', 10
FROM portals p WHERE p.slug = 'atlanta'
  AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.slug = 'theatre-in-the-square');

-- 8. Atlanta Lyric Theatre (Marietta, musical theater via Eventbrite)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method, expected_event_count)
SELECT 'Atlanta Lyric Theatre', 'atlanta-lyric-theatre', 'https://www.atlantalyrictheatre.com', 'venue', 'weekly', TRUE, p.id, 'api', 8
FROM portals p WHERE p.slug = 'atlanta'
  AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.slug = 'atlanta-lyric-theatre');

-- 9. Out of Box Theatre (Smyrna, community theater)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method, expected_event_count)
SELECT 'Out of Box Theatre', 'out-of-box-theatre', 'https://www.outofboxtheatre.com', 'venue', 'weekly', TRUE, p.id, 'html', 8
FROM portals p WHERE p.slug = 'atlanta'
  AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.slug = 'out-of-box-theatre');

-- 10. Uptown Comedy Corner (Forest Park, Black comedy institution)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method, expected_event_count)
SELECT 'Uptown Comedy Corner', 'uptown-comedy', 'https://www.uptowncomedy.net', 'venue', 'weekly', TRUE, p.id, 'html', 15
FROM portals p WHERE p.slug = 'atlanta'
  AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.slug = 'uptown-comedy');

-- 11. Whole World Improv Theatre (Midtown, improv + sketch)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method, expected_event_count)
SELECT 'Whole World Improv Theatre', 'whole-world-improv', 'https://www.wholeworldtheatre.com', 'venue', 'weekly', TRUE, p.id, 'html', 10
FROM portals p WHERE p.slug = 'atlanta'
  AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.slug = 'whole-world-improv');
