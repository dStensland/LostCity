-- Migration 211: Add Tio Lucho's venue and source
-- Peruvian-Southern restaurant in Poncey-Highland by Chef Arnaldo Castillo
-- (James Beard semifinalist) and Howard Hsu. Hosts Ceviche Sessions and
-- Pisco Dinners. Wix site, no crawlable events page — events via Resy.

BEGIN;

DO $$
DECLARE
    atlanta_portal_id UUID;
BEGIN
    SELECT id INTO atlanta_portal_id
    FROM portals
    WHERE slug = 'atlanta'
    LIMIT 1;

    IF atlanta_portal_id IS NULL THEN
        RAISE EXCEPTION 'Atlanta portal is required before running migration 211';
    END IF;

    -- Source — venue only, no crawlable events page (Wix, events via Resy)
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES ('tio-luchos', 'Tio Lucho''s', 'https://www.tioluchos.com/', 'venue', 'monthly', false, atlanta_portal_id, 'none')
    ON CONFLICT (slug) DO UPDATE SET is_active = false, owner_portal_id = EXCLUDED.owner_portal_id;

END $$;

-- Venue
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website, phone,
  description, vibes, is_event_venue
) VALUES (
  'Tio Lucho''s',
  'tio-luchos',
  '675 N Highland Ave NE Ste 6000, Atlanta, GA 30306',
  'Poncey-Highland',
  'Atlanta', 'GA', '30306',
  33.7729, -84.3522,
  'restaurant', 'restaurant',
  'https://www.tioluchos.com',
  '(404) 343-0278',
  'Peruvian-Southern restaurant from James Beard semifinalist Chef Arnaldo Castillo and Howard Hsu. Shareable ceviches, lomo saltado, and regional dishes from Northern Peru in a relaxed but refined Poncey-Highland setting. Hosts monthly Ceviche Sessions and Pisco Dinners.',
  '{date-spot,foodie,upscale-casual,latin,community}',
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes,
  is_event_venue = EXCLUDED.is_event_venue;

COMMIT;
