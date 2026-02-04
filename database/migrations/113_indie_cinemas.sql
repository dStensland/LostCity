-- ============================================
-- MIGRATION 113: Independent Cinemas
-- ============================================
-- Add Starlight Drive-In, Springs Cinema & Taphouse, Aurora Cineplex
-- as independent cinema venues with crawlers.
-- Feature Starlight Drive-In in the Atlanta portal feed.

-- ============================================
-- STEP 1: Insert indie cinema venue records
-- ============================================

-- Starlight Drive-In Theatre (featured)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website, lat, lng, featured)
VALUES (
    'Starlight Drive-In Theatre',
    'starlight-drive-in',
    '2000 Moreland Ave SE',
    'East Atlanta',
    'Atlanta', 'GA', '30316',
    'cinema',
    'https://starlightdrivein.com',
    33.7072, -84.3492,
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET featured = TRUE;

-- The Springs Cinema & Taphouse
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website, lat, lng)
VALUES (
    'The Springs Cinema & Taphouse',
    'springs-cinema',
    '5920 Roswell Rd NE Suite A-103',
    'Sandy Springs',
    'Sandy Springs', 'GA', '30328',
    'cinema',
    'https://www.springscinema.com',
    33.9196, -84.3563
)
ON CONFLICT (slug) DO NOTHING;

-- Aurora Cineplex
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website, lat, lng)
VALUES (
    'Aurora Cineplex',
    'aurora-cineplex',
    '5100 Commerce Pkwy',
    'Roswell',
    'Roswell', 'GA', '30076',
    'cinema',
    'https://www.auroracineplex.com',
    34.0003, -84.3242
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- STEP 2: Insert source records
-- ============================================

INSERT INTO sources (slug, name, source_type, url, is_active)
VALUES
    ('starlight-drive-in', 'Starlight Drive-In Theatre', 'crawler', 'https://starlightdrivein.com', TRUE),
    ('springs-cinema', 'The Springs Cinema & Taphouse', 'crawler', 'https://www.springscinema.com', TRUE),
    ('aurora-cineplex', 'Aurora Cineplex', 'crawler', 'https://www.auroracineplex.com', TRUE)
ON CONFLICT (slug) DO UPDATE SET is_active = TRUE;

-- ============================================
-- STEP 3: Feature Starlight in Atlanta portal
-- ============================================
-- Add a venue spotlight section for Starlight Drive-In

DO $$
DECLARE
    atlanta_portal_id UUID;
    starlight_venue_id INT;
BEGIN
    SELECT id INTO atlanta_portal_id FROM portals WHERE slug = 'atlanta';
    SELECT id INTO starlight_venue_id FROM venues WHERE slug = 'starlight-drive-in';

    IF atlanta_portal_id IS NOT NULL AND starlight_venue_id IS NOT NULL THEN
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            atlanta_portal_id,
            'starlight-drive-in-spotlight',
            'Starlight Drive-In',
            'Atlanta''s iconic drive-in theatre — 6 screens under the stars',
            'auto',
            'venue_spotlight',
            'featured',
            5,
            json_build_object('venue_ids', json_build_array(starlight_venue_id), 'date_filter', 'next_7_days')::jsonb,
            2,  -- After hero banner and happening today
            true
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
