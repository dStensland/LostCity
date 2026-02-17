-- Migration 210: Add craft/art community venues and sources
-- The Craftivist (Edgewood yarn shop), Needle Nook (Briarcliff yarn shop),
-- Java Lords (L5P coffee + craft nights), Doraville Art Center (DART),
-- Atlanta Craft Club (org — hosts at various venues via Luma)
-- Source: Reddit r/Atlanta craft clubs thread, Feb 2026

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
        RAISE EXCEPTION 'Atlanta portal is required before running migration 210';
    END IF;

    -- ============================================================================
    -- SOURCES (crawlers)
    -- ============================================================================

    -- The Craftivist — women-owned yarn/craft shop, Edgewood Ave
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES ('the-craftivist', 'The Craftivist', 'https://www.thecraftivist.com/', 'venue', 'weekly', true, atlanta_portal_id, 'playwright')
    ON CONFLICT (slug) DO UPDATE SET is_active = true, owner_portal_id = EXCLUDED.owner_portal_id;

    -- Needle Nook — fiber arts shop since 1976, Briarcliff Rd
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES ('needle-nook', 'Needle Nook', 'https://needlenookyarns.com/', 'venue', 'weekly', true, atlanta_portal_id, 'playwright')
    ON CONFLICT (slug) DO UPDATE SET is_active = true, owner_portal_id = EXCLUDED.owner_portal_id;

    -- Java Lords — L5P coffee house, venue only (no crawlable events page)
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES ('java-lords', 'Java Lords', 'https://javalordscoffee.com/', 'venue', 'monthly', false, atlanta_portal_id, 'none')
    ON CONFLICT (slug) DO UPDATE SET is_active = false, owner_portal_id = EXCLUDED.owner_portal_id;

    -- Doraville Art Center (DART) — community art space, classes, events
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES ('doraville-art-center', 'Doraville Art Center', 'https://www.doravilleartcenter.org/', 'venue', 'weekly', true, atlanta_portal_id, 'playwright')
    ON CONFLICT (slug) DO UPDATE SET is_active = true, owner_portal_id = EXCLUDED.owner_portal_id;

    -- Atlanta Craft Club — org that hosts craft workshops at various ATL venues via Luma
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES ('atlanta-craft-club', 'Atlanta Craft Club', 'https://lu.ma/atlcraftclub', 'organization', 'weekly', true, atlanta_portal_id, 'playwright')
    ON CONFLICT (slug) DO UPDATE SET is_active = true, owner_portal_id = EXCLUDED.owner_portal_id;

END $$;

-- ============================================================================
-- VENUES
-- ============================================================================

-- The Craftivist — yarn & craft shop on Edgewood Ave (Cabbagetown/Inman Park border)
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website, phone,
  description, vibes, is_event_venue
) VALUES (
  'The Craftivist',
  'the-craftivist',
  '743 Edgewood Ave NE, Atlanta, GA 30307',
  'Inman Park',
  'Atlanta', 'GA', '30307',
  33.7583, -84.3560,
  'venue', 'shop',
  'https://www.thecraftivist.com',
  '(404) 330-8023',
  'Women-owned yarn and craft shop on Edgewood Avenue. Carries local and independent yarn brands, notions, and fiber arts supplies. Hosts open knit/crochet nights and workshops.',
  '{artsy,chill,community,lgbtq-friendly}',
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes,
  is_event_venue = EXCLUDED.is_event_venue;

-- Needle Nook — fiber arts institution since 1976, near Emory
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website, phone,
  description, vibes, is_event_venue
) VALUES (
  'Needle Nook',
  'needle-nook',
  '2165 Briarcliff Rd NE, Atlanta, GA 30329',
  'Briarcliff',
  'Atlanta', 'GA', '30329',
  33.8065, -84.3255,
  'venue', 'shop',
  'https://needlenookyarns.com',
  '(404) 325-0068',
  'Atlanta fiber arts institution open since 1976. Yarn, needles, notions, and classes in the Briarcliff La Vista shopping center near Emory. Hosts open knit and crochet nights weekly.',
  '{chill,community,family-friendly}',
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes,
  is_event_venue = EXCLUDED.is_event_venue;

-- Java Lords — late-night L5P coffee house and bar, hosts craft nights
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website, phone,
  description, vibes, is_event_venue
) VALUES (
  'Java Lords',
  'java-lords',
  '1105 Euclid Ave NE, Atlanta, GA 30307',
  'Little Five Points',
  'Atlanta', 'GA', '30307',
  33.7647, -84.3490,
  'cafe', 'coffee_shop',
  'https://javalordscoffee.com',
  '(404) 477-0921',
  'Organic fair-trade coffee house and bar in the heart of Little Five Points, co-located with Seven Stages theater. Open late with beer and wine. Hosts queer craft night and community events.',
  '{artsy,chill,late-night,lgbtq-friendly,community}',
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes,
  is_event_venue = EXCLUDED.is_event_venue;

-- Doraville Art Center (DART) — community art space across from MARTA Gold Line
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website, phone,
  description, vibes, is_event_venue
) VALUES (
  'Doraville Art Center',
  'doraville-art-center',
  '3774 Central Ave, Doraville, GA 30340',
  'Doraville',
  'Doraville', 'GA', '30340',
  33.8979, -84.2832,
  'venue', 'community_center',
  'https://www.doravilleartcenter.org',
  '(470) 890-3278',
  'Community art space in downtown Doraville across from the MARTA Gold Line station. Classes in painting, music, dance, knitting, and more. Gallery exhibitions and open studio events.',
  '{artsy,community,family-friendly,multicultural}',
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes,
  is_event_venue = EXCLUDED.is_event_venue;

COMMIT;
