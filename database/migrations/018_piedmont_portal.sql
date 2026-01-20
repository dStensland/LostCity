-- ============================================
-- MIGRATION 018: Piedmont Healthcare Portal
-- ============================================

-- Piedmont Healthcare Portal (business type)
-- Exclusive events from Piedmont hospitals in metro Atlanta
INSERT INTO portals (slug, name, tagline, portal_type, status, visibility, filters, branding, settings)
VALUES (
    'piedmont',
    'Piedmont Healthcare',
    'Health & Wellness Events in Metro Atlanta',
    'business',
    'active',
    'public',
    '{
        "city": "Atlanta",
        "tags": ["piedmont", "healthcare", "wellness", "hospital"]
    }',
    '{
        "primary_color": "#005eb8",
        "secondary_color": "#003366",
        "background_color": "#f0f7ff",
        "hero_image_url": null,
        "logo_url": null
    }',
    '{
        "show_map": true,
        "default_view": "list",
        "show_categories": true,
        "meta_description": "Discover health and wellness events, classes, and support groups at Piedmont Healthcare hospitals across metro Atlanta"
    }'
);

-- Create a source record for Piedmont Healthcare events
INSERT INTO sources (name, slug, url, source_type, is_active, crawl_frequency, config)
VALUES (
    'Piedmont Healthcare',
    'piedmont-healthcare',
    'https://www.piedmont.org/classes-and-events/classes-and-events',
    'website',
    true,
    'daily',
    '{
        "crawler": "piedmont_healthcare",
        "pages": [
            "https://classes.inquicker.com/?ClientID=12422",
            "https://www.pahauxiliary.org/calendar",
            "https://www.piedmont.org/about-piedmont-healthcare/foundation-and-giving/overview/special-events",
            "https://www.piedmontcancerinstitute.com/support-groups.php"
        ]
    }'
) ON CONFLICT (slug) DO UPDATE SET
    config = EXCLUDED.config,
    is_active = true;

-- Create venues for Piedmont hospitals
INSERT INTO venues (name, slug, address, city, state, neighborhood, lat, lng, spot_type)
VALUES
    ('Piedmont Atlanta Hospital', 'piedmont-atlanta-hospital', '1968 Peachtree Road NW', 'Atlanta', 'GA', 'Buckhead', 33.8126, -84.3857, 'hospital'),
    ('Piedmont Atlanta Hospital Auxiliary', 'piedmont-atlanta-auxiliary', '1968 Peachtree Road NW, Suite 180, Building 35', 'Atlanta', 'GA', 'Buckhead', 33.8126, -84.3857, 'hospital'),
    ('Piedmont Cancer Institute', 'piedmont-cancer-institute', '1800 Howell Mill Rd, Suite 575', 'Atlanta', 'GA', 'Westside', 33.8024, -84.4108, 'hospital'),
    ('Piedmont Wellness Center Fayette', 'piedmont-wellness-fayette', '200 Trilith Parkway', 'Fayetteville', 'GA', NULL, 33.4318, -84.4549, 'fitness_center'),
    ('Piedmont Fayette Hospital', 'piedmont-fayette-hospital', '1255 Highway 54 West', 'Fayetteville', 'GA', NULL, 33.4497, -84.4824, 'hospital'),
    ('Piedmont Henry Hospital', 'piedmont-henry-hospital', '1133 Eagle''s Landing Parkway', 'Stockbridge', 'GA', NULL, 33.5176, -84.2234, 'hospital'),
    ('Piedmont Newnan Hospital', 'piedmont-newnan-hospital', '745 Poplar Road', 'Newnan', 'GA', NULL, 33.3907, -84.7706, 'hospital'),
    ('Piedmont Rockdale Hospital', 'piedmont-rockdale-hospital', '1412 Milstead Avenue NE', 'Conyers', 'GA', NULL, 33.6745, -84.0035, 'hospital'),
    ('Piedmont Athens Regional', 'piedmont-athens-regional', '1199 Prince Avenue', 'Athens', 'GA', NULL, 33.9607, -83.3976, 'hospital'),
    ('Piedmont Atlanta Fitness Center', 'piedmont-atlanta-fitness', '1968 Peachtree Road NW', 'Atlanta', 'GA', 'Buckhead', 33.8126, -84.3857, 'fitness_center')
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    spot_type = EXCLUDED.spot_type;
