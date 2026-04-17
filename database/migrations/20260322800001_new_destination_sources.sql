-- Register new destination-first sources for enrichment sprint
-- Dave & Busters, Bowlero, Medieval Times, Main Event, Chattahoochee Food Works

INSERT INTO sources (slug, name, url, source_type, is_active, owner_portal_id, crawl_frequency)
VALUES
    ('dave-and-busters-atlanta', 'Dave & Busters Atlanta', 'https://www.daveandbusters.com/us/en/about/locations/sugarloaf-mills', 'venue_website', true, NULL, 'weekly'),
    ('bowlero-atlanta', 'Bowlero Atlanta', 'https://www.bowlero.com/', 'venue_website', true, NULL, 'weekly'),
    ('medieval-times-atlanta', 'Medieval Times Atlanta', 'https://www.medievaltimes.com/plan-your-trip/atlanta-ga', 'venue_website', true, NULL, 'weekly'),
    ('main-event-atlanta', 'Main Event Atlanta', 'https://www.mainevent.com/', 'venue_website', true, NULL, 'weekly'),
    ('chattahoochee-food-works', 'Chattahoochee Food Works', 'https://chattahoocheefoodworks.com/', 'venue_website', true, NULL, 'weekly')
ON CONFLICT (slug) DO NOTHING;
