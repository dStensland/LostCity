-- Migration 232: Atlanta Salsa & Bachata Festival
--
-- Recreates the festival record that was deleted in migration 144
-- (previously 'atlanta-salsa-congress', merged into this slug).
-- Adds source and venue for Playwright crawler.
-- Festival: Feb 26 - Mar 2, 2026 at Courtland Grand Hotel, Downtown Atlanta.

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
        RAISE EXCEPTION 'Atlanta portal is required before running migration 232';
    END IF;

    -- Source — organization with crawlable workshop schedule (Wix site)
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES (
        'atlanta-salsa-bachata-festival',
        'Atlanta Salsa & Bachata Festival',
        'https://www.atlantasbf.com',
        'organization',
        'weekly',
        true,
        atlanta_portal_id,
        'playwright'
    )
    ON CONFLICT (slug) DO UPDATE SET
        is_active = true,
        url = EXCLUDED.url,
        owner_portal_id = EXCLUDED.owner_portal_id,
        integration_method = EXCLUDED.integration_method;

END $$;

-- Festival record
INSERT INTO festivals (
    id, slug, name, website, typical_month, typical_duration_days,
    location, neighborhood, categories, free, festival_type, description
) VALUES (
    'atlanta-salsa-bachata-festival',
    'atlanta-salsa-bachata-festival',
    'Atlanta Salsa & Bachata Festival',
    'https://www.atlantasbf.com',
    2,
    5,
    'Courtland Grand Hotel',
    'Downtown',
    '{dance,community,fitness}',
    false,
    'festival',
    'Five-day Latin dance festival with 70+ workshops, 30+ world-class instructors in salsa, bachata, kizomba, and more. Social dancing, performances, and competitions at the Courtland Grand Hotel in Downtown Atlanta.'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    website = EXCLUDED.website,
    description = EXCLUDED.description;

-- Classify festival
UPDATE festivals SET
    primary_type = 'dance_festival',
    experience_tags = '{workshops,social_dancing,performances,competitions}',
    audience = 'all_ages',
    size_tier = 'major',
    indoor_outdoor = 'indoor',
    price_tier = 'moderate',
    announced_start = '2026-02-26',
    announced_end = '2026-03-02',
    announced_2026 = true
WHERE slug = 'atlanta-salsa-bachata-festival';

-- Venue
INSERT INTO venues (
    name, slug, address, neighborhood, city, state, zip,
    lat, lng, venue_type, spot_type, website,
    description, is_event_venue
) VALUES (
    'Courtland Grand Hotel',
    'courtland-grand-hotel',
    '165 Courtland St NE, Atlanta, GA 30303',
    'Downtown',
    'Atlanta', 'GA', '30303',
    33.7590, -84.3853,
    'hotel', 'event_space',
    'https://www.atlantasbf.com',
    'Downtown Atlanta hotel hosting the Atlanta Salsa & Bachata Festival. Features multiple ballrooms and workshop rooms for Latin dance events.',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type,
    spot_type = EXCLUDED.spot_type,
    is_event_venue = EXCLUDED.is_event_venue;

COMMIT;
