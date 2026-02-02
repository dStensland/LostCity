-- ============================================
-- MIGRATION 094: Decatur City Portal
-- ============================================

-- Decatur City Portal (city type)
-- Walkable, artsy, historic city adjacent to Atlanta
-- Known for vibrant downtown square, great food scene, and progressive community
INSERT INTO portals (slug, name, tagline, portal_type, status, visibility, filters, branding, settings)
VALUES (
    'decatur',
    'Discover Decatur',
    'Events & happenings in walkable Decatur',
    'city',
    'active',
    'public',
    '{
        "city": "Decatur",
        "neighborhoods": [
            "Downtown Decatur",
            "Decatur Square",
            "Oakhurst",
            "Winnona Park",
            "East Lake",
            "Midway Woods",
            "MAK Historic District",
            "Clairemont-Great Lakes",
            "Glennwood Estates",
            "North Decatur",
            "Westchester",
            "Sycamore Place",
            "Ponce de Leon Heights",
            "Scott-Candler"
        ]
    }',
    '{
        "visual_preset": "warm_creative",
        "theme_mode": "light",
        "primary_color": "#ea580c",
        "secondary_color": "#7c2d12",
        "accent_color": "#d97706",
        "background_color": "#fffbeb",
        "text_color": "#292524",
        "muted_color": "#78716c",
        "button_color": "#ea580c",
        "button_text_color": "#ffffff",
        "border_color": "#fed7aa",
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
            "intensity": "medium",
            "colors": {
                "primary": "#ffedd5",
                "secondary": "#fef3c7"
            },
            "animation_speed": "slow"
        },
        "component_style": {
            "border_radius": "lg",
            "shadows": "medium",
            "card_style": "elevated",
            "button_style": "rounded",
            "glow_enabled": true,
            "glow_intensity": "subtle",
            "animations": "medium",
            "glass_enabled": false
        }
    }',
    '{
        "show_map": true,
        "default_view": "list",
        "show_categories": true,
        "icon_glow": true,
        "exclude_adult": false,
        "meta_description": "Discover events, activities, and entertainment in walkable Decatur, GA. From the historic downtown square to Oakhurst and East Lake, find what''s happening in your neighborhood.",
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

-- Update Atlanta portal to include Decatur neighborhoods
-- This ensures Decatur events show up in the metro Atlanta feed too
UPDATE portals
SET filters = jsonb_set(
    filters,
    '{neighborhoods}',
    COALESCE(filters->'neighborhoods', '[]'::jsonb) ||
    '[
        "Downtown Decatur",
        "Decatur Square",
        "Oakhurst",
        "Winnona Park",
        "East Lake",
        "Midway Woods",
        "MAK Historic District",
        "Clairemont-Great Lakes",
        "Glennwood Estates",
        "North Decatur",
        "Westchester",
        "Sycamore Place",
        "Ponce de Leon Heights",
        "Scott-Candler"
    ]'::jsonb
),
updated_at = NOW()
WHERE slug = 'atlanta'
AND NOT (filters->'neighborhoods' ? 'Downtown Decatur');

-- Add comment explaining the dual-portal approach
COMMENT ON COLUMN portals.filters IS 'Event filtering rules. City neighborhoods (Marietta, Decatur) are included in both their city portals and Atlanta metro portal for comprehensive coverage.';
