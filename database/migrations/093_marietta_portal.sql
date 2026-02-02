-- ============================================
-- MIGRATION 093: Marietta City Portal
-- ============================================

-- Marietta City Portal (city type)
-- Historic downtown city in metro Atlanta with a vibrant arts and culture scene
INSERT INTO portals (slug, name, tagline, portal_type, status, visibility, filters, branding, settings)
VALUES (
    'marietta',
    'Discover Marietta',
    'Events & happenings in historic Marietta',
    'city',
    'active',
    'public',
    '{
        "city": "Marietta",
        "neighborhoods": [
            "Marietta Square",
            "Downtown Marietta",
            "East Cobb",
            "Polk",
            "Whitlock",
            "Fort Hill",
            "North Landing",
            "Eastern Marietta",
            "Indian Hills",
            "Chimney Springs",
            "Windsor Oaks",
            "Somerset",
            "Brookstone",
            "Powers Park"
        ]
    }',
    '{
        "visual_preset": "corporate_clean",
        "theme_mode": "light",
        "primary_color": "#2563eb",
        "secondary_color": "#7c3aed",
        "accent_color": "#dc2626",
        "background_color": "#f8fafc",
        "text_color": "#1e293b",
        "muted_color": "#64748b",
        "button_color": "#2563eb",
        "button_text_color": "#ffffff",
        "border_color": "#e2e8f0",
        "card_color": "#ffffff",
        "font_heading": "Inter",
        "font_body": "Inter",
        "header": {
            "template": "standard",
            "logo_position": "left",
            "logo_size": "md",
            "nav_style": "tabs",
            "show_search_in_header": true,
            "transparent_on_top": false
        },
        "ambient": {
            "effect": "subtle_glow",
            "intensity": "subtle",
            "colors": {
                "primary": "#dbeafe",
                "secondary": "#ede9fe"
            },
            "animation_speed": "slow"
        },
        "component_style": {
            "border_radius": "md",
            "shadows": "medium",
            "card_style": "elevated",
            "button_style": "default",
            "glow_enabled": false,
            "glow_intensity": "subtle",
            "animations": "subtle",
            "glass_enabled": false
        }
    }',
    '{
        "show_map": true,
        "default_view": "list",
        "show_categories": true,
        "icon_glow": false,
        "exclude_adult": false,
        "meta_description": "Discover events, activities, and entertainment in historic Marietta, GA. From the Marietta Square to East Cobb, find what''s happening in your neighborhood.",
        "nav_labels": {
            "feed": "Feed",
            "events": "Events",
            "spots": "Places"
        }
    }'
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    filters = EXCLUDED.filters,
    branding = EXCLUDED.branding,
    settings = EXCLUDED.settings,
    status = 'active';

-- Update Atlanta portal to include Marietta neighborhoods
-- This ensures Marietta events show up in the metro Atlanta feed too
UPDATE portals
SET filters = jsonb_set(
    filters,
    '{neighborhoods}',
    COALESCE(filters->'neighborhoods', '[]'::jsonb) ||
    '[
        "Marietta Square",
        "Downtown Marietta",
        "East Cobb",
        "Polk",
        "Whitlock",
        "Fort Hill",
        "North Landing",
        "Eastern Marietta",
        "Indian Hills",
        "Chimney Springs",
        "Windsor Oaks",
        "Somerset",
        "Brookstone",
        "Powers Park"
    ]'::jsonb
),
updated_at = NOW()
WHERE slug = 'atlanta'
AND NOT (filters->'neighborhoods' ? 'Marietta Square');

-- Add comment explaining the dual-portal approach
COMMENT ON COLUMN portals.filters IS 'Event filtering rules. Marietta neighborhoods are included in both Marietta and Atlanta portals for metro coverage.';
