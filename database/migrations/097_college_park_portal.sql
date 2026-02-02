-- ============================================
-- MIGRATION 097: College Park City Portal
-- ============================================

-- College Park City Portal (city type)
-- Soul food capital, Gullah-Geechee heritage, historic Main Street
-- Known for Black-owned businesses, 867-structure historic district, and cultural richness
INSERT INTO portals (slug, name, tagline, portal_type, status, visibility, filters, branding, settings)
VALUES (
    'college-park',
    'Discover College Park',
    'Soul food, culture & history in Atlanta''s airport city',
    'city',
    'active',
    'public',
    '{
        "city": "College Park",
        "neighborhoods": [
            "Historic College Park",
            "Downtown College Park",
            "Main Street District",
            "College Park Old Town",
            "West End College Park",
            "East Point Border",
            "College Park Heights",
            "Airport Area"
        ]
    }',
    '{
        "visual_preset": "soulful_heritage",
        "theme_mode": "light",
        "primary_color": "#dc2626",
        "secondary_color": "#b91c1c",
        "accent_color": "#d97706",
        "background_color": "#fef3c7",
        "text_color": "#292524",
        "muted_color": "#78716c",
        "button_color": "#dc2626",
        "button_text_color": "#ffffff",
        "border_color": "#fed7aa",
        "card_color": "#fffbeb",
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
            "effect": "warm_glow",
            "intensity": "medium",
            "colors": {
                "primary": "#fef3c7",
                "secondary": "#fed7aa"
            },
            "animation_speed": "slow"
        },
        "component_style": {
            "border_radius": "lg",
            "shadows": "elevated",
            "card_style": "warm",
            "button_style": "rounded",
            "glow_enabled": true,
            "glow_intensity": "medium",
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
        "meta_description": "Discover events, dining, and culture in College Park, GA - home to more Black-owned restaurants than any other place in America. Experience Gullah-Geechee heritage, soul food, and historic Main Street charm.",
        "nav_labels": {
            "feed": "Feed",
            "events": "Events",
            "spots": "Places"
        },
        "hero": {
            "enabled": true,
            "title": "Soul Food Capital of America",
            "subtitle": "Celebrate Black culture, Gullah-Geechee heritage, and historic Main Street dining",
            "style": "warm"
        }
    }'
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    filters = EXCLUDED.filters,
    branding = EXCLUDED.branding,
    settings = EXCLUDED.settings,
    status = 'active';

-- Update Atlanta portal to include College Park neighborhoods
-- This ensures College Park events show up in the metro Atlanta feed too
UPDATE portals
SET filters = jsonb_set(
    filters,
    '{neighborhoods}',
    COALESCE(filters->'neighborhoods', '[]'::jsonb) ||
    '[
        "Historic College Park",
        "Downtown College Park",
        "Main Street District",
        "College Park Old Town",
        "West End College Park",
        "East Point Border",
        "College Park Heights",
        "Airport Area"
    ]'::jsonb
),
updated_at = NOW()
WHERE slug = 'atlanta'
AND NOT (filters->'neighborhoods' ? 'Historic College Park');

-- Add comment explaining the cultural significance
COMMENT ON COLUMN portals.branding IS 'Visual identity. College Park uses warm, soulful colors (deep reds, golds, earth tones) to celebrate Black culture and Gullah-Geechee heritage - distinct from Marietta (corporate blues) and Decatur (artsy oranges).';
