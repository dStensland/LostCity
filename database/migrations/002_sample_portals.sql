-- ============================================
-- MIGRATION 002: Sample Portals
-- ============================================

-- Sample Conference Portal (event type)
INSERT INTO portals (slug, name, tagline, portal_type, status, visibility, filters, branding, settings)
VALUES (
    'sample-conference',
    'Sample Conference 2026',
    'March 15-18, 2026 • Atlanta, GA',
    'event',
    'active',
    'public',
    '{
        "city": "Atlanta",
        "date_range": ["2026-03-15", "2026-03-18"],
        "categories": ["community", "food_drink", "nightlife"]
    }',
    '{
        "primary_color": "#6366f1",
        "secondary_color": "#1e1b4b",
        "background_color": "#f5f3ff",
        "hero_image_url": null
    }',
    '{
        "show_map": false,
        "default_view": "list",
        "show_categories": true,
        "meta_description": "Discover events and activities during Sample Conference 2026 in Atlanta"
    }'
);

-- Coach Personal Portal
INSERT INTO portals (slug, name, tagline, portal_type, status, visibility, filters, branding, settings)
VALUES (
    'coach',
    'Coach''s Picks',
    'Curated events worth checking out',
    'personal',
    'active',
    'public',
    '{
        "city": "Atlanta"
    }',
    '{
        "primary_color": "#059669",
        "secondary_color": "#064e3b",
        "background_color": "#ecfdf5",
        "hero_image_url": null
    }',
    '{
        "show_map": false,
        "default_view": "list",
        "show_categories": true,
        "meta_description": "Hand-picked events in Atlanta by Coach"
    }'
);
